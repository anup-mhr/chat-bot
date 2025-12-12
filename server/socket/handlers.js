const {
  postMessage,
  postQuery,
  postLivechatUnhandled,
  postRate,
  createVisitor,
} = require("../services/message.service");
const { client } = require("../utils/redis");
const {
  saveUserInDashboard,
  bypassRasa,
  saveSessionInDashboard,
  handledSetTimeout,
  sendOfflineMessage,
  sanitizeMessage,
  flattenAttachmentPayload,
} = require("./utils");
const RasaAPI = require("../utils/rasa");
const messages = require("./messages");
const crypto = require("crypto");
const { loggerInfo, loggerError } = require("../services/logger.services");
const { generateAIResponse, uploadFile } = require("../rasa");

// redis livechat::users [only stores active or requested users]
// {
//     [id]: {
//          category: "sales" | "after_sales" | "info" | "all",
//          role: "User" | "Agent",
//          engagedWith [only for engaged user]: [id],
//          requester [only for requested user]: [id],
//          waiting [only for requesting user]: true | false | undefined,
//          status : active | passive,
//          source : "fb" | "web" | "instagram" ,
//          name: name of user to be set in metadata,
//          location: [only for user with location],
//          navigationHistory: { [timestamp]: [link] }[],
//          sessionHistory: { [timestamp] : [eventName::data]}[]
//                          *valid events: joined, sentRequest, receivedRequest, acceptedRequest, rejectedRequest, transferedChat, startedChat, endedChat, left*
//     },
// }

// socket user message and metadata format:
// message = {type, text, buttons, data, ...}
// metadata = {sender, receipent, time, mid, ...}

class Handlers {
  constructor(io, socket, userRedisKey, payloadAcceptActions) {
    this._io = io;
    this._socket = socket;
    this._userRedisKey = userRedisKey;
    // this._sessionRedisKey = sessionRedisKey;
    this._user = null;
    this._source = null;
    this._LIVECHAT_REQUEST_EXPIRY = 180; //seconds;
    this._TRANSFER_REQUEST_EXPIRY = 15; //seconds;
    this._LIVECHAT_SESSION_EXPIRY = 1 * 60 * 60; //seconds;
    this._PAYLOAD_ACCEPT_ACTIONS = payloadAcceptActions;
    // to remove user data after 1 hour of inactivity [necessary for facebook bots]
    this._removeDataTimeout;
    this._sessionData = {};
    this.lastMessageType = null;
    this.lastResponseMessage = null;
  }

  serverMetadata(receipent = this._user) {
    return {
      time: Date.now(),
      sender: "server",
      source: this._source,
      receipent,
    };
  }

  setRemoveDataTimeout(seconds = 1 * 60 * 60) {
    if (this._removeDataTimeout) {
      clearTimeout(this._removeDataTimeout);
    }
    this._removeDataTimeout = handledSetTimeout(() => {
      // client.hdel(this._userRedisKey, this._user);
      this._socket.disconnect();
    }, seconds * 1000);
  }

  async disconnect() {
    this.disconnectHandler();
  }

  async disconnectHandler() {
    const isSomeDeviceConnected =
      this._io.sockets.adapter.rooms[this._user]?.length > 0;
    if (isSomeDeviceConnected) {
      return null;
    }
    const userData = await client.hget(this._userRedisKey, this._user);
    if (userData.role === "User") {
      userData.connected = false;
      await client.hset(this._userRedisKey, this._user, { ...userData });
    } else if (userData.role === "Agent") {
      client.hdel(this._userRedisKey, this._user);
    }

    if (userData.role === "Agent") {
      const users = await client.hgetall(this._userRedisKey);
      await Promise.all(
        Object.entries(users)
          .filter(([_, data]) => data.engagedWith === this._user)
          .map(async ([visitor]) => {
            await this.livechatExpire(visitor, this._user, true, false);
            await this.userSetSession(
              `endedChat::${this._user}::${this._user}`,
              visitor
            );
          })
      );
      const agentSession = {
        agent: this._user,
        organizationId: process.env.ORGANIZATION_ID,
        createdDate: userData.connected,
        source: userData.source?.replace("-agent", "") || "web",
        events: [
          {
            event: "joined",
            data: userData.category,
            timestamp: userData.connected,
          },
          {
            event: "left",
            data: userData.category,
            timestamp: Date.now(),
          },
        ],
      };
      return saveSessionInDashboard([agentSession]);
    }

    await this.userBroadcast();

    if (!userData.id || !userData.source) {
      return null;
    }

    const defaultSession = {
      visitor: userData.id,
      organizationId: process.env.ORGANIZATION_ID,
      source: userData.source,
    };

    const subSessionHistory = Object.entries(
      userData?.sessionHistory || {}
    ).map(([timestamp, eventData]) => {
      const [event, data, engagedWith] = eventData.split("::");
      return { event, data, engagedWith, timestamp: parseInt(timestamp) };
    });
    const sessionData = [
      ...subSessionHistory,
      ...(userData.engagedWith
        ? [
            {
              event: "endedChat",
              data: "self",
              engagedWith: userData.engagedWith,
              timestamp: Date.now(),
            },
          ]
        : []),
      {
        event: "left",
        data: userData.category,
        timestamp: Date.now(),
        engagedWith: userData.engagedWith || "bot",
      },
    ];
    // the following code breaks events into sessions grouped by engagedWith
    let sessions = [];
    let runningAgent = "";

    for (const eventData of sessionData.sort(
      (a, b) => a.timestamp - b.timestamp
    )) {
      const currentAgent = eventData.engagedWith || "bot";
      delete eventData.engagedWith;

      if (currentAgent !== runningAgent) {
        sessions = [
          { agent: currentAgent, ...defaultSession, events: [eventData] },
          ...sessions,
        ];
      } else {
        sessions
          .find(({ agent }) => agent === currentAgent)
          .events.push(eventData);
      }

      runningAgent = currentAgent;
      if (eventData.event === "transferredChat") {
        sessions = [
          { agent: eventData.data, ...defaultSession, events: [eventData] },
          ...sessions,
        ];
        runningAgent = eventData.data;
      }
    }

    // await client.hset(this._sessionRedisKey, this._user, sessionData)
    return saveSessionInDashboard(
      sessions.reverse().map((session) => ({
        ...session,
        createdDate: (session.events || [])[0]?.timestamp,
      }))
    );
  }

  async userSetStatus(status = "passive") {
    console.log(status, "checkstatus>>>>:::");
    await client.hset(this._userRedisKey, this._user, { status });
    if (status === "passive") {
      const allUsers = await client.hgetall(this._userRedisKey);
      const engagedIds = Object.entries(allUsers).filter(
        ([_, data]) => data.engagedWith === this._user
      );
      await Promise.all(
        engagedIds.map(async ([engagedId, _]) => {
          await this.livechatExpire(engagedId, this._user, true, false);
          await this.userSetSession(
            `endedChat::${this._user}::${this._user}`,
            engagedId
          );
        })
      );
    }
    await this.userBroadcast();
  }

  async userGetData(callback) {
    const data = await client.hget(this._userRedisKey, this._user);
    return callback(data);
  }

  async userSetSession(newSessionEvent, visitorId) {
    const userData = await client.hget(this._userRedisKey, this._user);
    if (userData.role === "User") {
      visitorId = this._user;
    }
    if (!visitorId || !newSessionEvent) {
      return null;
    }
    const sessionHistory = { [Date.now()]: newSessionEvent };
    await client.hset(this._userRedisKey, visitorId, { sessionHistory }, [
      "sessionHistory",
    ]);
  }

  async userSetData(data) {
    console.log(data, "data from userSetData>>>");
    const validKeys = [
      "name",
      "origin",
      "phoneNumber",
      "first_name",
      "last_name",
      "username",
      "id",
      "mobileNumber",
      "email",
      "location",
      "latitude",
      "longitude",
      "navigationHistory",
      "sessionHistory",
      "osInfo",
      "broswerInfo",
      "profile_pic",
      "updatedDate",
      "mobile",
    ];
    const navigationHistory = data.newLink
      ? { [Date.now()]: data.newLink }
      : undefined;
    if (data.newLink) {
      const userData = await client.hget(this._userRedisKey, this._user);
      await this.userSetSession(
        `navigation::${data.newLink}::${userData.engagedWith || "bot"}`,
        this._user
      );
    }
    if (navigationHistory) {
      data.navigationHistory = navigationHistory;
    }
    Object.keys(data).forEach((key) => {
      if (!validKeys.includes(key)) {
        delete data[key];
      }
    });

    const redisResponse = await client.hset(
      this._userRedisKey,
      this._user,
      data,
      ["navigationHistory"]
    );
    await this.userBroadcast();
  }

  async formFilled(llmFields, visitorId) {
    const visitorData = await client.hget(this._userRedisKey, visitorId);
    console.log(visitorData, "visitor Data from form filled>>>", visitorId);
    if (visitorData) {
      this.userSetData({ ...visitorData });
    }
  }

  async userJoin(
    userId,
    category = "all",
    role = "User",
    source = "web",
    botUserData = {},
    llmFields,
    profileDetails,
    callback = (value) => value
  ) {
    console.log(llmFields, "llm:::>>", source);
    if (!userId || (this._user && this._user !== userId)) {
      return callback(false);
    }
    if (!this._source && !source) {
      return callback(false);
    }

    this._user = userId;
    this._source = this._source || source;
    const user = await client.hget(this._userRedisKey, this._user);
    console.log(user, "usercheckkkk>>>", this._user);
    if (user.joined) {
      this._socket.to(this._user).emit("user:alreadyJoined", userId);
    }
    // user.category && this._socket.leave(user.category);
    category = user.category || category;
    role = user.role || role;
    [this._user, category, role].forEach((room) => this._socket.join(room));

    if (role === "Agent") {
      await client.hdel(this._userRedisKey, this._user);
      await client.hset(this._userRedisKey, this._user, {
        category,
        role,
        source: this._source,
        status: "active",
        connected: user.connected || Date.now(),
        AgentDetails: llmFields,
      });
      this._socket.join("all");
      return callback(true);
    }
    if (role === "User") {
      createVisitor(userId, llmFields, source);
    }

    // const data = await saveUserInDashboard(this._user, this._source, botUserData, llmFields);
    // console.log(data, "data from saveUserInDashboard>>>");

    let data = await client.hget(this._userRedisKey, this._user);
    let jsondata = {
      name: data?.name || "",
      email: data?.email || "",
      mobile: data?.mobile || "",
    };

    if (source === "fb" || source === "instagram") {
      callback(true);
      jsondata = {
        clientDetails: {
          name:
            `${profileDetails.first_name} ${profileDetails.last_name}` || "",
          email: profileDetails.email || "",
          profile_pic: profileDetails.profile_pic || "",
        },
      };
    }
    await client.hset(this._userRedisKey, this._user, {
      category,
      role,
      source: this._source,
      joined: true,
      connected: true,
      ...jsondata,
      UserConnectedDetails: botUserData || {
        org_id: llmFields?.org_id,
        branch_id: llmFields?.branch_id,
        region_id: llmFields?.region_id,
      },
    });
    await this.userSetData({ ...jsondata.clientDetails, ...jsondata });
    await this.userSetSession(
      `joined::${category}::${user.engagedWith || "bot"}`
    );
    await this.broadcastToAgents("livechat:userConnect", {
      source: this._source,
      userId: this._user,
    });
    const finalUser = await client.hget(this._userRedisKey, this._user);
    return callback(finalUser);
  }

  async userBroadcast(req_type) {
    const users = await client.hgetall(this._userRedisKey);
    const visitorsAndAgents = Object.entries(users).map(([userId, data]) => ({
      userId,
      ...data,
    }));

    const agentsOnly = visitorsAndAgents.filter((u) => u.role === "Agent");
    const usersOnly = visitorsAndAgents.filter(
      (u) => u.role === "User" && u.connected === true
    );
    usersOnly.forEach((user) => {
      user.connected = agentsOnly.some((agent) => {
        const agentBranchIds = agent.AgentDetails?.branch_id || [];
        return agentBranchIds.includes(user.UserConnectedDetails?.branch_id);
      });
    });

    agentsOnly.forEach((agent) => {
      agent.connected = true;
    });

    for (const agent of agentsOnly) {
      const agentBranchIds = agent.AgentDetails?.branch_id || [];
      const relevantUsers = usersOnly.filter((user) =>
        agentBranchIds.includes(user.UserConnectedDetails?.branch_id)
      );
      const relevantAgents = agentsOnly.filter((otherAgent) => {
        if (otherAgent.userId === agent.userId) return false;
        const otherAgentBranchIds = otherAgent.AgentDetails?.branch_id || [];
        return otherAgentBranchIds.some((id) => agentBranchIds.includes(id));
      });
      const dataToSend = [...relevantAgents, ...relevantUsers];
      console.log(`${agent.userId} Emitting to agent ${dataToSend}`);
      this._io.to(agent.userId).emit("livechat:users", dataToSend);
    }
    this._io.to("User").emit("livechat:agents", agentsOnly);

    if (req_type) {
      let agents = [];
      visitorsAndAgents.forEach((agent) => {
        if (
          agent.role === "Agent" &&
          (req_type === "all" ? true : agent.category === req_type)
        ) {
          agents.push({ userId: agent.userId, category: agent.category });
        }
      });

      return agents;
    }
  }

  // async userBroadcast(req_type) {
  //   console.log(this._user, "thisusercheck>>>>");

  //   const users = await client.hgetall(this._userRedisKey);
  //   const userSegregate = await client.hget(this._userRedisKey, this._user);
  //   if (userSegregate.role !== "Agent") {
  //     return;
  //   }
  //   console.log(userSegregate, "userSegregate>>>>");

  //   let visitorsAndAgents = Object.entries(users).map(([userId, data]) => ({
  //     userId,
  //     ...data,
  //     connected: true,
  //   }));

  //   console.log(JSON.stringify(visitorsAndAgents), ">visitorsAndAgents>>>>>");

  //   const agentOrgId = userSegregate?.AgentDetails?.org_id;
  //   const agentBranchIds = userSegregate?.AgentDetails?.branch_id || []; // now array
  //   const agentRegionIds = userSegregate?.AgentDetails?.region_id || []; // now array

  //   // 🚫 If agent has no branches, they should not see any visitors
  //   if (!Array.isArray(agentBranchIds) || agentBranchIds.length === 0) {
  //     visitorsAndAgents = [];
  //   } else {
  //     visitorsAndAgents = visitorsAndAgents.filter((user) => {
  //       // keep agent themself if desired
  //       if (user.userId === this._user) return true;

  //       if (user.role !== "User") return false;

  //       const userOrgId = user?.UserConnectedDetails?.org_id;
  //       const userBranchId = user?.UserConnectedDetails?.branch_id;
  //       const userRegionId = user?.UserConnectedDetails?.region_id;

  //       const sameOrg = agentOrgId && userOrgId && agentOrgId === userOrgId;

  //       // ✅ check if user’s branch/region is included in agent arrays
  //       const branchMatch = Array.isArray(agentBranchIds) && userBranchId && agentBranchIds.includes(userBranchId);

  //       const regionMatch = Array.isArray(agentRegionIds) && userRegionId && agentRegionIds.includes(userRegionId);

  //       return sameOrg && (branchMatch || regionMatch);
  //     });
  //     console.log(visitorsAndAgents, "afterfiltering>>>>>");
  //   }

  //   if (userSegregate.role === "Agent") {
  //     console.log(JSON.stringify(visitorsAndAgents), "finalvisitorsAndAgents>>>>");
  //     this._io.to(this._user).emit("livechat:users", visitorsAndAgents);
  //   }

  //   if (req_type) {
  //     let agents = [];
  //     visitorsAndAgents.forEach((agent) => {
  //       if (agent.role === "Agent" && (req_type === "all" ? true : agent.category === req_type)) {
  //         agents.push({ userId: agent.userId, category: agent.category });
  //       }
  //     });
  //     return agents;
  //   }
  // }

  async livechatUsers() {
    const agent = await client.hget(this._userRedisKey, this._user);
    if (agent.role !== "Agent") {
      return null;
    }

    const users = await client.hgetall(this._userRedisKey);
    console.log(users, "keydifff>>>>", agent);

    const categoryUsers = [];

    Object.entries(users).forEach(([userId, data]) => {
      const userJson = { userId, ...data, connected: true };
      categoryUsers.push(userJson);
    });

    const uniqueIds = [...new Set(categoryUsers.map((user) => user.userId))];
    let uniqueUsers = uniqueIds.map((userId) =>
      categoryUsers.find((user) => user.userId === userId)
    );

    // ✅ Agent's details for comparison
    const agentOrgId = agent?.AgentDetails?.org_id;
    const agentBranchId = agent?.AgentDetails?.branch_id;
    const agentRegionId = agent?.AgentDetails?.region_id;

    // ✅ Filter users matching org & branch/region logic
    uniqueUsers = uniqueUsers.filter((user) => {
      if (user.role === "Agent") return false; // Exclude agents if desired

      const userOrgId = user?.UserConnectedDetails?.org_id;
      const userBranchId = user?.UserConnectedDetails?.branch_id;
      const userRegionId = user?.UserConnectedDetails?.region_id;

      const sameOrg = agentOrgId && userOrgId && agentOrgId === userOrgId;

      // Branch or region matching logic
      const sameBranch =
        agentBranchId && userBranchId && agentBranchId === userBranchId;
      const sameRegion =
        !agentBranchId &&
        !userBranchId &&
        agentRegionId &&
        userRegionId &&
        agentRegionId === userRegionId;

      return sameOrg && (sameBranch || sameRegion);
    });

    console.log(uniqueUsers, "USersssunique::>>");

    this._socket.emit("livechat:users", uniqueUsers);
  }

  async sendMessagesAtInterval(data, userId, llmfields, secondsToWait = 3) {
    console.log(data, "dtaaaa>>>");
    const indexWiseResponse = async (counter) => {
      const responseMessage = data[counter].responseMessage || data[counter];
      this._io
        .to(userId)
        .emit(
          "message:received",
          responseMessage,
          this.serverMetadata(userId),
          userId
        );
      const postMessageData = responseMessage.custom || responseMessage;
      const postText =
        postMessageData.title ||
        postMessageData.text ||
        postMessageData.bodyText ||
        postMessageData.message ||
        postMessageData.type ||
        postMessageData.Text ||
        postMessageData.Type ||
        JSON.stringify(responseMessage);
      const agentMessage = {
        type: "botMessage",
        text: postText,
        id: crypto.randomUUID(),
      };
      await this.broadcastToAgents(
        "message:received",
        agentMessage,
        this.serverMetadata(userId),
        userId
      );
      // postMessage(
      //   postText,
      //   undefined,
      //   { ...this.serverMetadata(userId), payload: postMessageData.payload },
      //   userId,
      //   "bot",
      //   "bot",
      //   llmfields
      // );
    };
    if (!data.length) {
      return;
    }
    await indexWiseResponse(0);
    if (data.length === 1) {
      return;
    }
    let counter = 1;
    const sendMessageInterval = setInterval(async () => {
      await indexWiseResponse(counter);
      counter++;
      if (counter === data.length) {
        clearInterval(sendMessageInterval);
      }
    }, secondsToWait * 1000); // convert seconds to miliseconds
  }

  async livechatRequest(
    requestId,
    onlyOppositeRole = true,
    attachedMessage,
    intervene = false
  ) {
    console.log(
      { requestId, onlyOppositeRole, attachedMessage, intervene },
      "inlivechatrequest>>>"
    );
    const requester = await client.hget(this._userRedisKey, this._user);
    console.log(requester, "inlivechatrequest::::::");
    if (requester.role === "User") {
      console.log("livechatRequest One");
      // revert from here
      const oppositeRole = requester.role === "User" ? "Agent" : "User";
      const allUsers = await client.hgetall(this._userRedisKey);
      const category =
        (requester.role === "User" && requestId) || requester.category || "all";
      const isSomeoneAvailable = Object.values(allUsers).some(
        (user) =>
          (!onlyOppositeRole || user.role === oppositeRole) &&
          (category === "all" || user.category === category) &&
          (user.role === "User" || user.status === "active")
      );
      if (!isSomeoneAvailable) {
        console.log("livechatRequest One.1");
        // let isActive = await this.checkIsAgentActiveOrNot(category);
        // const rasaResponse = await RasaAPI.getIntentRequest(
        //   "/talk_with_agent",
        //   { source: this._source || "web", sender: this._user },
        //   isActive
        // );
        // const data = Array.isArray(rasaResponse) ? rasaResponse : [rasaResponse];
        let data = [
          {
            message:
              "Sorry, No one is available to chat right now. Please try again later.",
            responseMessage: {
              message:
                "Sorry, No one is available to chat right now. Please try again later.",
            },
          },
        ];
        return this.sendMessagesAtInterval(data, this._user);
        //return this._io.to(this._user).emit("message:received", messages.notAvailable(category), this.serverMetadata());
      }
      // revert to here
      if (requester.init_req === this._user) {
        console.log("livechatRequest One.2");
        console.log(
          { requester, user: this._user },
          "checkalreadyrequested>>>"
        );
        const selfalreadyRequested = await messages.alreadyRequestedself();
        return this._io
          .to(this._user)
          .emit(
            "message:received",
            selfalreadyRequested,
            this.serverMetadata(),
            this._user
          );
      }
      await client.hset(this._userRedisKey, this._user, {
        init_req: this._user,
      });
      this.setRemoveDataTimeout();
    }
    const category =
      (requester.role === "User" && requestId) || requester.category || "all";
    const requestee = await client.hget(this._userRedisKey, requestId);
    console.log(requestee, "requestee>>>", requester);

    if (requester.role === "User" && requester.engagedWith) {
      console.log("livechatRequest Two");
      const alreadyEngagedMessage = await messages.alreadyEngaged(
        null,
        requester.engagedWith,
        this._user
      );
      this._io
        .to(this._user)
        .emit(
          "message:received",
          alreadyEngagedMessage,
          this.serverMetadata(),
          this._user
        );
      return;
    }

    // two types of request can be sent:
    // 1. with requestId targeted to particular user [helpful for agents] or some category [helpful for users]
    // 2. without requestId open to any one available in given category [helpful for users]
    // if onlyOppositeRole is true searches for users of opposite roles when requestId is absent

    const oppositeRole = requester.role === "User" ? "Agent" : "User";
    const allUsers = await client.hgetall(this._userRedisKey);

    if (requester.role === "User") {
      console.log("livechatRequest Three");
      const isSomeoneAvailable = Object.values(allUsers).some(
        (user) =>
          (!onlyOppositeRole || user.role === oppositeRole) &&
          (category === "all" || user.category === category) &&
          (user.role === "User" || user.status === "active")
      );
      if (!isSomeoneAvailable) {
        console.log("livechatRequest three.1");
        let isActive = await this.checkIsAgentActiveOrNot(category);
        const rasaResponse = await RasaAPI.getIntentRequest(
          "/talk_with_agent",
          { source: this._source || "web", sender: this._user },
          isActive
        );
        const data = Array.isArray(rasaResponse)
          ? rasaResponse
          : [rasaResponse];
        return this.sendMessagesAtInterval(data, this._user);
        //return this._io.to(this._user).emit("message:received", messages.notAvailable(category), this.serverMetadata());
      }
      await client.hset(this._userRedisKey, this._user, {
        waiting: true,
        rejectedAgents: [],
      });

      this.available_agents = await this.userBroadcast(requestId);

      await this.userSetSession(`sentRequest::${category}`);
    }

    if (requestee.engagedWith) {
      console.log("livechatRequest four");
      const alreadyEngagedMessage = await messages.alreadyEngaged(
        requestId,
        requestee.engagedWith,
        this._user
      );
      this._socket.emit(
        "message:received",
        alreadyEngagedMessage,
        this.serverMetadata(),
        this._user
      );
      return;
    }
    if (requestee.requester) {
      console.log("livechatRequest five");
      const alreadyRequestedMessage = await messages.alreadyRequested(
        requestId,
        requestee.requester,
        this._user
      );
      this._socket.emit(
        "message:received",
        alreadyRequestedMessage,
        this.serverMetadata(),
        this._user
      );
      return;
    }

    if (requester.role === "Agent" && requestee.role === "User" && intervene) {
      console.log("livechatRequest six");
      return this.livechatStart(
        requestId,
        this._user,
        this._user,
        false,
        true,
        attachedMessage
      );
    }

    const requestExpiry = `${parseInt(
      this._LIVECHAT_REQUEST_EXPIRY / 60
    )} minutes`;
    const incomingRequestMessage = await messages.incomingRequest(
      requester.role,
      this._user,
      requestExpiry,
      requester.source,
      attachedMessage
    );

    if (requester.role === "Agent" && requestId) {
      console.log("livechatRequest seven");
      this._io
        .to(requestId)
        .emit(
          "message:received",
          incomingRequestMessage,
          this.serverMetadata(requestId),
          this._user
        );

      if (requestee.role === "User") {
        await client.hset(this._userRedisKey, requestId, {
          requester: this._user,
        });
        await this.userSetSession(`receivedRequest::${this._user}`, requestId);
      }
      // setTimeout(() => {
      //   postMessage(
      //     incomingRequestMessage.text,
      //     undefined,
      //     { ...this.serverMetadata(requestId) },
      //     requestId,
      //     requester.source === "web-agent" ? "agent" : "web",
      //     requestId
      //   );
      // }, 100);
      await this.userBroadcast();
    } else if (onlyOppositeRole) {
      console.log("livechatRequest eight");
      const oppositeUsers = Object.entries(allUsers).filter(
        ([_, data]) =>
          (category === "all" || data.category === category) &&
          data.role === oppositeRole &&
          (data.role === "User" || data.status === "active")
      );
      console.log(
        JSON.stringify(oppositeUsers),
        "oppppusersss>>>>>>",
        requester
      );

      const requesterBranchId = requester?.UserConnectedDetails?.branch_id;

      if (requesterBranchId) {
        oppositeUsers.forEach(([userId, data]) => {
          const agentBranchIds = data?.AgentDetails?.branch_id || [];
          const isSameBranch = agentBranchIds.includes(requesterBranchId);
          if (isSameBranch) {
            this._io
              .to(userId)
              .emit(
                "message:received",
                incomingRequestMessage,
                this.serverMetadata(userId),
                this._user
              );
          }
        });
      }
    } else {
      console.log("livechatRequest nine");
      this._socket
        .to(category)
        .to("all")
        .emit(
          "message:received",
          incomingRequestMessage,
          this.serverMetadata(requestId),
          this._user
        );
    }

    this._io
      .to(this._user)
      .emit(
        "message:received",
        messages.sentRequest(),
        this.serverMetadata(),
        this._user
      ); // broadcast event to all
    this._io.to(this._user).emit("livechatRequest:sent");
    setTimeout(() => {
      postMessage(
        messages.sentRequest().text,
        undefined,
        { ...this.serverMetadata(this._user) },
        requestee.role === "User"
          ? requestId
          : requestee.role === "Agent"
          ? this._user
          : this._user,
        requester.source === "web-agent"
          ? "agent"
          : requester.source === "fb"
          ? "fb"
          : "web",
        this._user,
        null,
        null,
        null,
        this._userRedisKey
      );
      // if (requestee.role === "User") {
      //   console.log(this._user, "I am user role", requestId);
      //   postMessage(
      //     messages.sentRequest().text,
      //     undefined,
      //     { ...this.serverMetadata(this._user) },
      //     this._user,
      //     "bot",
      //     requestId
      //   );
      // } else if (requestee.role === "Agent") {
      //   console.log(this._user, "I am agent role", requestId);
      //   postMessage(
      //     messages.sentRequest().text,
      //     undefined,
      //     { ...this.serverMetadata(this._user) },
      //     this._user,
      //     "bot",
      //     this._user
      //   );
      // }
    }, 100);
    handledSetTimeout(async () => {
      const userData = await client.hget(this._userRedisKey, this._user);
      console.log(userData, "userdataaa>>>");
      let acceptedIndiv = userData.acceptedIndiv || [];
      let rejectedIndiv = userData.rejectedIndiv || [];
      console.log(acceptedIndiv, "checkkkacept>>");
      if (acceptedIndiv.length > 0) {
        await client.hset(this._userRedisKey, this._user, {
          acceptedIndiv: undefined,
        });
        return;
      }
      if (rejectedIndiv.length > 0) {
        await client.hset(this._userRedisKey, this._user, {
          rejectedIndiv: undefined,
        });
        return;
      }

      await client.hset(this._userRedisKey, this._user, {
        init_req: undefined,
      });
      this._io.to(this._user).emit("livechatRequest:expire");
      const expiredRequestMessage = await messages.expiredRequest(requestId);

      console.log(userData, "role><><", this._user);

      const expiredRequestMessageOpposite =
        await messages.expiredRequestOpposite(userData.role, this._user);
      console.log("inexpire>>>>", {
        msg: expiredRequestMessageOpposite.text,
        user: requestId,
        usred: this._user,
      });

      this._io
        .to(this._user)
        .emit(
          "message:received",
          expiredRequestMessage,
          this.serverMetadata(),
          this._user
        );
      setTimeout(() => {
        postMessage(
          expiredRequestMessage.text,
          undefined,
          { ...this.serverMetadata(this._user) },
          requestId === "all" ? this._user : requestId,
          requester.source === "fb"
            ? "fb"
            : requester.source === "web-agent"
            ? "agent"
            : "web",
          requestId === "all" ? this._user : requestId,
          null,
          null,
          null,
          this._userRedisKey
        );
      }, 100);

      let req_expire;

      if (userData.role === "Agent") {
        const requestUser = await client.hget(this._userRedisKey, requestId);
        if (this._user !== requestUser.requester) {
          return null;
        }
        if (acceptedIndiv.length > 0) {
          return;
        }
        // setTimeout(() => {
        //   postMessage(
        //     expiredRequestMessageOpposite.text,
        //     undefined,
        //     { ...this.serverMetadata(requestId) },
        //     requestId,
        //     "bot",
        //     requestId
        //   );
        // }, 100);
        this._io
          .to(requestId)
          .emit(
            "message:received",
            expiredRequestMessageOpposite,
            this.serverMetadata(),
            this._user
          );
        req_expire = {
          Agent_name: this._user || userData.name,
          Visitor_name: requestUser.name,
          Visitor_id: requestId,
          Visitor_source: requestUser.source,
          Event: "agentReqExpired",
        };
        postLivechatUnhandled(req_expire, this._userRedisKey);
        await client.hset(this._userRedisKey, requestId, {
          requester: undefined,
        });
      }

      if (userData.role === "User") {
        const rejectedAgents = userData.rejectedAgents || [];
        if (acceptedIndiv.length > 0) {
          return;
        }
        this.available_agents.forEach((indiv_agent) => {
          if (rejectedAgents.includes(indiv_agent.userId)) {
            return;
          }

          req_expire = {
            Agent_name: indiv_agent.userId,
            Visitor_name: userData.name,
            Visitor_id: this._user,
            Visitor_source: userData.source,
            Event: "userReqExpired",
          };
          this._io
            .to(indiv_agent.userId)
            .emit(
              "message:received",
              expiredRequestMessageOpposite,
              this.serverMetadata(),
              this._user
            );
          postLivechatUnhandled(req_expire, this._userRedisKey);
        });
        if (!userData.waiting) {
          return null;
        }
      }

      await client.hset(this._userRedisKey, this._user, {
        waiting: undefined,
        rejectedAgents: undefined,
        acceptedIndiv: undefined,
      });
      await this.userBroadcast();

      let userDatas = await client.hget(this._userRedisKey, this._user);
      loggerInfo(
        "expiredlivechat",
        {
          user: this._user,
          userDatas: userDatas,
          metadata: userData,
        },
        200,
        "expiredlivechat"
      );
    }, this._LIVECHAT_REQUEST_EXPIRY * 1000); //ms
    return { requester: this._user, requestee: requestId || category };
  }

  async livechatAccept(acceptId) {
    const acceptor = await client.hget(this._userRedisKey, this._user);
    const acceptedIndiv = acceptor.acceptedIndiv || [];
    if (!acceptedIndiv.includes(this._user)) {
      acceptedIndiv.push(this._user);
    }

    await client.hset(this._userRedisKey, acceptId, { acceptedIndiv });

    if (acceptor.role === "User") {
      this.setRemoveDataTimeout();
    }
    const accepted = await client.hget(this._userRedisKey, acceptId);

    console.log(acceptId, acceptor, "or><><accept<><>ed", accepted);

    acceptId = acceptId || acceptor.requester;

    if (
      !acceptId ||
      (acceptor.role === "User" && acceptor.requester !== acceptId)
    ) {
      this._socket.emit(
        "message:received",
        await messages.notYetRequested(acceptId),
        this.serverMetadata(),
        this._user
      );
      return;
    }

    if (accepted.engagedWith) {
      const alreadyEngagedMessage = await messages.alreadyEngaged(
        acceptId,
        accepted.engagedWith,
        this._user
      );
      this._socket.emit(
        "message:received",
        alreadyEngagedMessage,
        this.serverMetadata(),
        this._user
      );
      return;
    }

    if (acceptor.role === "Agent") {
      await client.hset(this._userRedisKey, acceptId, { init_req: undefined });
      if (!accepted.waiting) {
        this._socket.emit(
          "message:received",
          await messages.notYetRequested(acceptId),
          this.serverMetadata(),
          this._user
        );
        return;
      }
    }

    if (acceptor.role === "Agent" && acceptor.status !== "active") {
      this._socket.emit(
        "message:received",
        messages.notActive(),
        this.serverMetadata(),
        this._user
      );
      return;
    }

    const agentId = acceptor.role === "User" ? acceptId : this._user;
    const userId = agentId === acceptId ? this._user : acceptId;
    acceptor.role === "User" &&
      (await this.userSetSession(`acceptedRequest::${acceptId}`));
    await this.livechatStart(userId, agentId);

    // system logger
    return { acceptee: acceptId, acceptor: this._user };
  }

  async livechatReject(rejectId) {
    const rejector = await client.hget(this._userRedisKey, this._user);

    let reject;
    if (rejector.role === "User") {
      reject = {
        Agent_name: rejector.requester,
        Visitor_name: rejector.name,
        Visitor_id: this._user,
        Visitor_source: rejector.source,
        Event: "userReject",
      };
      this.setRemoveDataTimeout();
      postLivechatUnhandled(reject, this._userRedisKey);

      const rejectedIndiv = rejector.rejectedIndiv || [];
      if (!rejectedIndiv.includes(this._user)) {
        rejectedIndiv.push(this._user);
      }

      await client.hset(this._userRedisKey, rejectId, { rejectedIndiv });
    }

    if (rejector.role === "Agent") {
      const rejectedUser = await client.hget(this._userRedisKey, rejectId);
      console.log(rejectedUser, "rejectedUser>>>", rejectId);
      reject = {
        Agent_name: this._user || rejector.name,
        Visitor_name: rejectedUser.name,
        Visitor_id: rejectId,
        Visitor_source: rejectedUser.source,
        Event: "agentReject",
      };

      const rejectedAgents = rejectedUser.rejectedAgents || [];
      rejectedAgents.push(this._user);
      await client.hset(this._userRedisKey, rejectId, { rejectedAgents });
      postLivechatUnhandled(reject, this._userRedisKey);
    }
    rejectId = rejectId || rejector.requester;

    if (
      !rejectId ||
      (rejector.role === "User" && rejector.requester !== rejectId)
    ) {
      this._socket.emit(
        "message:received",
        await messages.notYetRequested(rejectId),
        this.serverMetadata(),
        this._user
      );
      return;
    }

    const rejected = await client.hget(this._userRedisKey, rejectId);
    if (rejected.engagedWith) {
      const alreadyEngagedMessage = await messages.alreadyEngaged(
        rejectId,
        rejected.engagedWith,
        this._user
      );
      this._socket.emit(
        "message:received",
        alreadyEngagedMessage,
        this.serverMetadata(),
        this._user
      );
      return;
    }

    await client.hset(this._userRedisKey, this._user, { requester: undefined });

    // send rejected message only to agents
    rejected.role === "Agent" &&
      this._io
        .to(rejectId)
        .emit(
          "message:received",
          await messages.livechatReject(this._user),
          this.serverMetadata(rejectId),
          this._user
        );
    let rejectMsg = await messages.livechatReject();
    this._io
      .to(this._user)
      .emit("message:received", rejectMsg, this.serverMetadata(), this._user);
    rejector.role === "User" &&
      (await this.userSetSession(`rejectedRequest::${rejectId}`));
    setTimeout(() => {
      postMessage(
        rejectMsg.text,
        undefined,
        { ...this.serverMetadata(this._user) },
        this._user,
        "bot",
        rejected.role === "User"
          ? rejectId
          : rejected.role === "Agent"
          ? this._user
          : this._user
      );
    }, 100);
    this._io.to(this._user).emit("livechat:reject");

    await this.userBroadcast();

    return { rejectee: rejectId, rejector: this._user };
  }

  async livechatStart(
    visitorId,
    agentId,
    fromId = "",
    isTranferred = false,
    isIntervened = false,
    attachedMessage
  ) {
    const agentUser = await client.hget(this._userRedisKey, agentId);
    const visitorUser = await client.hget(this._userRedisKey, visitorId);
    console.log(agentUser, "I am triggered livechatStart", visitorUser);

    if (agentUser.status !== "active") {
      this._io
        .to(visitorId)
        .emit(
          "message:received",
          messages.notActive(true),
          this.serverMetadata(visitorId),
          this._user
        );
      await client.hset(this._userRedisKey, visitorId, {
        requester: undefined,
        waiting: false,
        engagedWith: undefined,
      });
      await this.userBroadcast();
      this._io
        .to(agentId)
        .emit(
          "message:received",
          messages.notActive(),
          this.serverMetadata(agentId),
          this._user
        );
      return;
    }

    await this.userSetSession(
      `${
        isTranferred ? "transferred" : isIntervened ? "intervened" : "started"
      }Chat::${agentId}::${visitorUser.engagedWith || agentId}`,
      visitorId
    );

    await client.hset(this._userRedisKey, visitorId, {
      requester: undefined,
      waiting: undefined,
      engagedWith: agentId,
      category: agentUser.category || "all",
    });

    const sessionTime = `${parseInt(
      this._LIVECHAT_SESSION_EXPIRY / 60
    )} minutes`;
    const livechatStartMessage = await messages.livechatStart(
      agentId,
      sessionTime,
      "",
      isTranferred,
      isIntervened,
      attachedMessage
    );
    this._io
      .to(visitorId)
      .emit(
        "message:received",
        livechatStartMessage,
        this.serverMetadata(visitorId),
        this._user
      );

    setTimeout(() => {
      postMessage(
        `${livechatStartMessage.text}(${agentUser.name}, ${agentUser.category})`,
        undefined,
        { ...this.serverMetadata(visitorId) },
        visitorId,
        visitorUser.source === "fb"
          ? "fb"
          : visitorUser.source === "instagram"
          ? "instagram"
          : "web",
        visitorId,
        null,
        null,
        null,
        this._userRedisKey
      );
    }, 100);
    console.log("visitorID:::>>>>>started", { visitorId, agentId });
    this._io.to(visitorId).emit("livechat:started");

    this._io
      .to(agentId)
      .emit(
        "message:received",
        await messages.livechatStart(
          visitorId,
          sessionTime,
          fromId,
          isTranferred,
          isIntervened
        ),
        this.serverMetadata(agentId),
        this._user
      );

    // const allUsers = await client.hgetall(this._userRedisKey);

    // Object.entries(allUsers).forEach(([id, userData]) => {
    //   if (userData.role === 'Agent') {
    //     this._socket.to(id).emit("livechat:close", JSON.stringify({ visitorId, source: visitorUser.source }))
    //   }
    // })
    this._io
      .to("Agent")
      .emit(
        "livechat:close",
        JSON.stringify({ visitorId, source: visitorUser.source })
      );
    await this.userBroadcast();

    handledSetTimeout(async () => {
      const { engagedWith } = await client.hget(this._userRedisKey, visitorId);
      if (!engagedWith || engagedWith !== agentId) {
        return null;
      }
      await this.livechatExpire(visitorId, agentId, false);
    }, this._LIVECHAT_SESSION_EXPIRY * 1000); //ms
  }

  async livechatTransferRequest(transferId, agentId, transferedByID) {
    const agentData = await client.hget(this._userRedisKey, agentId);
    const visitorData = await client.hget(this._userRedisKey, transferId);

    if (agentData.role !== "Agent" || visitorData.engagedWith !== this._user) {
      this._socket.emit(
        "message:received",
        await messages.transferFailed(transferId, agentId),
        this.serverMetadata()
      );
      return;
    }

    if (visitorData.requestedTransferTo?.includes(agentId)) {
      const alreadyRequestedMessage = await messages.alreadyRequested(
        agentId,
        this._user,
        visitorData.engagedWith,
        true
      );
      this._socket.emit(
        "message:received",
        alreadyRequestedMessage,
        this.serverMetadata(),
        this._user
      );
      return;
    }

    console.log(
      agentData,
      "consoling transfered data>>>",
      visitorData,
      transferId,
      agentId,
      transferedByID
    );

    const visitorDataBranchId = visitorData?.UserConnectedDetails?.branch_id;

    if (visitorDataBranchId) {
      const agentBranchIds = agentData?.AgentDetails?.branch_id || [];
      const isSameBranch = agentBranchIds.includes(visitorDataBranchId);
      if (isSameBranch) {
        await client.hset(this._userRedisKey, transferId, {
          requestedTransferTo: [
            ...(visitorData.requestedTransferTo || []),
            agentId,
          ],
        });

        const expiryTime = `${this._TRANSFER_REQUEST_EXPIRY} seconds`;

        this._io
          .to(agentId)
          .emit(
            "message:received",
            await messages.transferRequest(
              this._user,
              transferId,
              expiryTime,
              visitorData.source
            ),
            this.serverMetadata(agentId),
            this._user
          );

        await this.userBroadcast();

        handledSetTimeout(async () => {
          await client.hset(this._userRedisKey, transferId, {
            requestedTransferTo: visitorData.requestedTransferTo?.filter(
              (agent) => agent !== agentId
            ),
          });
          await this.userBroadcast();
          // const allUsers = await client.hgetall(this._userRedisKey);
          // Object.entries(allUsers).forEach(([id, userData]) => {
          //   if (userData.role === 'Agent') {
          //     this._socket.to(id).emit("livechat:close", JSON.stringify({ visitorId: transferId, source: visitorData.source }));
          //   }
          // })
          this._io.to("Agent").emit(
            "livechat:close",
            JSON.stringify({
              visitorId: transferId,
              source: visitorData.source,
            })
          );
        }, this._TRANSFER_REQUEST_EXPIRY * 1000);

        return { requester: visitorData?.engagedWith, requestee: agentId };
      } else {
        // this._io
        //   .to(agentId)
        //   .emit("message:received", await messages.transferFailedBranches(transferId, agentId), this.serverMetadata());
        this._io
          .to(transferedByID)
          .emit(
            "message:received",
            await messages.transferFailedBranches(transferId, agentId),
            this.serverMetadata()
          );
      }
    }
  }

  async livechatTransferAccept(visitorId) {
    const visitorData = await client.hget(this._userRedisKey, visitorId);

    if (!visitorData.requestedTransferTo?.includes(this._user)) {
      return this._socket.emit(
        "message:received",
        await messages.notYetRequested(),
        this.serverMetadata(),
        this._user
      );
    }

    if (visitorData.engagedWith) {
      this._io
        .to(visitorData.engagedWith)
        .emit(
          "message:received",
          await messages.transferSuccess(visitorId, this._user),
          this.serverMetadata(visitorData.engagedWith),
          this._user
        );
    }

    await client.hset(this._userRedisKey, visitorId, {
      requestedTransferTo: undefined,
    });

    await this.livechatStart(
      visitorId,
      this._user,
      visitorData.engagedWith,
      true
    );

    return { acceptee: visitorData?.engagedWith, acceptor: this._user };
  }

  async livechatTransferReject(visitorId) {
    const visitorData = await client.hget(this._userRedisKey, visitorId);

    if (!visitorData.requestedTransferTo?.includes(this._user)) {
      return this._socket.emit(
        "message:received",
        await messages.notYetRequested(),
        this.serverMetadata(),
        this._user
      );
    }

    if (visitorData.engagedWith) {
      this._io
        .to(visitorData.engagedWith)
        .emit(
          "message:received",
          await messages.transferFailure(visitorId, this._user),
          this.serverMetadata(visitorData.engagedWith),
          this._user
        );
    }

    await client.hset(this._userRedisKey, visitorId, {
      requestedTransferTo: visitorData.requestedTransferTo?.filter(
        (agent) => agent !== this._user
      ),
    });

    await this.userBroadcast();

    return { rejectee: visitorData?.engagedWith, rejector: this._user };
  }

  async livechatExpire(visitorId, agentId, forced = true, broadcast = true) {
    const visitor = await client.hget(this._userRedisKey, visitorId);
    if (visitor.engagedWith !== agentId) {
      return null;
    }
    await client.hset(this._userRedisKey, visitorId, {
      engagedWith: undefined,
      waiting: undefined,
    });

    const ended = await client.hget(this._userRedisKey, agentId);
    const message = await messages.livechatExpire(agentId, forced, ended.name);
    this._io
      .to(visitorId)
      .emit(
        "message:received",
        message,
        this.serverMetadata(visitorId),
        this._user
      );
    this._io.to(visitorId).emit("livechat:ended");
    if (!forced) {
      await this.userSetSession("endedChat::auto::" + visitor.engagedWith);
    }
    this._io
      .to(agentId)
      .emit(
        "message:received",
        await messages.livechatExpire(visitorId, forced),
        this.serverMetadata(agentId),
        this._user
      );
    //for storing agent rating from rasa
    const senderUser = await client.hget(this._userRedisKey, visitorId);
    console.log(ended, "visitorId>>>endd", senderUser);
    let responseMessage = await postMessage(
      message.text,
      undefined,
      undefined,
      visitorId,
      senderUser.source === "fb"
        ? "fb"
        : senderUser.source === "instagram"
        ? "instagram"
        : "web",
      visitorId,
      {
        organization_id: senderUser.UserConnectedDetails.org_id,
        branch: senderUser.UserConnectedDetails.branch_id,
        sender: visitorId,
      },
      null,
      null,
      this._userRedisKey
    );

    this.callRasa(
      "/customer_rating",
      {
        agentId,
        livechat_end: true,
        visitorId,
        source: senderUser.source,
        sender: visitorId,
      },
      "/customer_rating",
      visitorId,
      responseMessage
    );
    console.log(agentId, "agentIdforrating>>>");

    if (!broadcast) {
      return null;
    }
    await this.userBroadcast();
  }

  async livechatEnd(visitorId) {
    const userData = await client.hget(this._userRedisKey, this._user);

    if (userData.role === "Agent") {
      const engagedData =
        visitorId && (await client.hget(this._userRedisKey, visitorId));
      if (!engagedData || engagedData.engagedWith !== this._user) {
        this._io
          .to(this._user)
          .emit(
            "message:received",
            await messages.notEngaged(visitorId),
            this.serverMetadata(),
            this._user
          );
        return;
      }
      await this.livechatExpire(visitorId, this._user, true, false);
      await this.userSetSession(
        `endedChat::${this._user}::${this._user}`,
        visitorId
      );
      return await this.userBroadcast();
    }

    if (!userData.engagedWith) {
      this._io
        .to(this._user)
        .emit(
          "message:received",
          await messages.notEngaged(),
          this.serverMetadata(),
          this._user
        );
      return;
    }

    await this.livechatExpire(this._user, userData.engagedWith);
    await this.userSetSession(`endedChat::self::${userData.engagedWith}`);
    this._io.to(this._user).emit("livechat:ended");
  }

  async broadcastToAgents(event, ...data) {
    // send user or agent sent messages to agents of same category for live monitoring
    // in this implementation messages are sent wheather or not the user or agent is engaged in live chat
    const allUsers = await client.hgetall(this._userRedisKey);
    const senderUser = allUsers[this._user] || {};
    Object.entries(allUsers).forEach(([userId, { role, category }]) => {
      if (role === "Agent" && ["all", category].includes(senderUser.category)) {
        this._socket.to(userId).emit(event, ...data);
      }
    });
  }

  async messageSent(message, metadata, llmfields) {
    // if (message.type === "customer_rating") {
    //   console.log(JSON.stringify(message), "ratingmessage>>>>");
    //   return postRate(message.payload.payload, message.payload.payload.split(":")[0].trim(), message.sender);
    // }
    let guided = message.guided || null;
    const sender = this._user;
    const source = this._source;
    const senderUser = await client.hget(this._userRedisKey, sender);
    const receipent =
      metadata?.receipent || senderUser?.engagedWith || "server";

    let locker = senderUser.role === "Agent" ? receipent : sender;
    const lockKey = `${locker}:lock`;

    // Try to acquire lock for this user
    const acquired = await client.acquireLock(lockKey, 5); // 5 sec TTL
    if (!acquired) {
      // Someone else is already processing -> retry shortly
      setTimeout(() => this.messageSent(message, metadata, llmfields), 50);
      return;
    }

    const branch_id = llmfields?.branch_id || "";
    const organization_id = llmfields?.org_id || "";
    const senderName =
      senderUser?.name ||
      metadata?.name ||
      `${senderUser?.first_name || ""} ${senderUser?.last_name || ""}`;
    console.log(
      sender,
      senderUser,
      senderName,
      "Consoling sender details in messagesent>>>"
    );
    if (!senderUser.name && senderName?.trim()) {
      this.userSetData({ name: senderName });
    }
    const senderUserData = {
      name: senderName.trim(),
      phoneNumber:
        senderUser?.mobileNumber ||
        senderUser?.mobile ||
        metadata?.phoneNumber ||
        "",
      email: senderUser?.email || "",
    };
    metadata = {
      receipent,
      ...metadata,
      sender,
      ...senderUserData,
      source,
      branch_id,
      organization_id,
      time: Date.now(),
    };
    if (guided) {
      metadata.guided = guided;
    }
    if (message.query_offline) {
      metadata.sender = sender;
      metadata.source = source;
      return await this.callRasa(message, metadata, "", sender);
    }
    message.type = message.type || "userMessage";
    message = sanitizeMessage(message);
    message.text =
      message.text ||
      message.title ||
      message.data_type ||
      (message.attachment?.payload ? "" : message);
    message.payload = message.payload || message.text || message.data_type;

    const {
      text,
      payload,
      attachment,
      messageFor,
      messageId: message_id,
    } = message;
    message = flattenAttachmentPayload(message);
    const messageId = crypto.randomUUID();
    if (messageFor) {
      metadata.messageFor = messageFor;
      metadata.messageId = message_id;
    }

    let responseMessage = {};

    if (text === "You were redirected to a link") {
      responseMessage = await postMessage(
        text,
        attachment,
        { ...metadata, payload },
        receipent,
        message.type === "agentMessage" ? "interAgent" : "agent",
        sender,
        llmfields
      );
      return;
    }

    if (
      senderUser.role === "User" &&
      !["formMessageSection", "bot", "isLink", "request_livechat"].some(
        (value) => Object.keys(message).includes(value)
      )
    ) {
      this._socket
        .to(senderUser.engagedWith)
        .emit(
          "message:received",
          await messages.newMessage(
            this._user,
            message.text,
            senderUser.source
          ),
          this.serverMetadata(senderUser.engagedWith),
          this._user
        );
      // senderUser.source?.startsWith("web") &&
      //   this._io.to(this._user).emit("message:received", { id: messageId, ...message }, metadata, this._user);
    }

    // check if this is a proxy for some other socket event (with payload)

    const isSocketEvent =
      typeof this.handleSocketPayload === "function" &&
      !payload?.latitude &&
      (await this.handleSocketPayload(payload));
    const accepted = await client.hget(this._userRedisKey, sender);

    console.log(
      message,
      "inmessagesent>>>>>",
      metadata,
      "llmfields",
      llmfields,
      "lasmessagetype",
      this._user,
      receipent,
      sender,
      "accepted",
      accepted,
      attachment,
      this._source
    );

    if (isSocketEvent) {
      const visitorId = extractVisitorId(message.payload);
      const messageText = messages.parseLivechatPayload(message);
      if (
        message.text != "livechat:request:all" ||
        message.payload != "livechat:request:all"
      ) {
        responseMessage = await postMessage(
          messageText,
          undefined,
          { ...metadata, payload },
          visitorId,
          this._source === "fb"
            ? "fb"
            : this._source === "instagram"
            ? "instagram"
            : message.type === "agentMessage"
            ? "agent"
            : "web",
          this._user,
          llmfields,
          null,
          null,
          this._userRedisKey
        );
      }
      return null;
    }

    function extractVisitorId(payload) {
      try {
        const parts = payload.split(":");
        if (parts[1] === "accept") {
          const jsonStr = parts.slice(2).join(":");
          return JSON.parse(jsonStr).visitorId;
        }
        if (parts[1] === "reject") {
          return parts[2];
        }
        return null;
      } catch (err) {
        console.error("Failed to parse payload:", err);
        return null;
      }
    }

    // check if the message is sent by an agent
    if (senderUser.role === "Agent") {
      const allUsers = await client.hgetall(this._userRedisKey);
      const receivingUser = allUsers[receipent];
      const canSendMessage =
        receivingUser ||
        (message.isOfflineMessage &&
          message.targetSource &&
          message.targetCategory);

      if (!canSendMessage) {
        this._io
          .to(sender)
          .emit(
            "message:received",
            messages.userNotFound(receipent),
            this.serverMetadata(sender),
            this._user
          );
        return;
      }

      let data = await client.hget(this._userRedisKey, `${receipent}:response`);
      let lastResponseMessage = data.responseMessage;
      let lastMessageType = data.lastMessageType;

      if (
        !lastResponseMessage ||
        !lastMessageType ||
        lastMessageType === message.type
      ) {
        responseMessage = await postMessage(
          text,
          attachment,
          message?.targetSource,
          receipent,
          message?.type === "interAgentMessage" ? message.type : "agent",
          sender,
          llmfields,
          null,
          null,
          this._userRedisKey
        );
        await client.hset(this._userRedisKey, `${receipent}:response`, {
          responseMessage,
          lastMessageType: message.type,
        });
      } else if (lastMessageType !== message.type) {
        await postMessage(
          text,
          attachment,
          message?.targetSource,
          receipent,
          message?.type === "interAgentMessage" ? message.type : "agent",
          sender,
          lastResponseMessage,
          null,
          null,
          this._userRedisKey
        );
        await client.hset(this._userRedisKey, `${receipent}:response`, {
          responseMessage: "",
          lastMessageType: "",
        });
      }

      // send message to all relevant agents
      Object.entries(allUsers).forEach(([_id, data]) => {
        if (
          data?.role === "Agent" &&
          (message.type === "interAgentMessage" ||
            ["all", data?.category].includes(
              receivingUser?.category || message.targetCategory
            ))
        ) {
          this._io
            .to(_id)
            .emit(
              "message:received",
              { id: messageId, ...message },
              metadata,
              this._user
            );
        }
      });
      await client.releaseLock(lockKey);
      if (!receivingUser) {
        console.log("sending offline message>>>");
        return sendOfflineMessage(message, metadata, message.targetSource);
      }
      return this._socket
        .to(receipent)
        .emit("message:received", { id: messageId, ...message }, metadata);
    }
    if (source === "fb") {
      this.setRemoveDataTimeout(600);
    } else {
      this.setRemoveDataTimeout();
    }

    //for handling if visitor click button with link and formMessage Section
    if (message && message.hasOwnProperty("isLink")) {
      responseMessage = await postMessage(
        message.text || message.payload,
        undefined,
        { ...metadata, payload },
        receipent,
        "human",
        sender,
        llmfields
      );
      await this.broadcastToAgents(
        "message:received",
        { ...message, id: messageId },
        metadata,
        this._user
      );
      return null;
    }

    if (
      message &&
      ["formMessageSection", "bot"].every((value) =>
        Object.keys(message).includes(value)
      )
    ) {
      const postText = message.title || message.text;
      const agentMessage = {
        type: "botMessage",
        text: postText,
        id: messageId,
      };
      await this.broadcastToAgents(
        "message:received",
        agentMessage,
        this.serverMetadata(sender),
        this._user
      );
      responseMessage = await postMessage(
        text,
        undefined,
        { ...this.serverMetadata(sender), payload },
        sender,
        "bot",
        sender,
        llmfields
      );
      return null;
    }

    if (
      message &&
      ["formMessageSection", "human"].every((value) =>
        Object.keys(message).includes(value)
      )
    ) {
      responseMessage = await postMessage(
        text,
        undefined,
        { ...metadata, payload },
        receipent,
        "human",
        sender,
        llmfields
      );
      await this.broadcastToAgents(
        "message:received",
        { ...message, id: messageId },
        metadata,
        this._user
      );
      return null;
    }

    let data = await client.hget(this._userRedisKey, `${this._user}:response`);
    let lastResponseMessage = data.responseMessage;
    let lastMessageType = data.lastMessageType;

    // handle user sent message
    let isIncludeMessage = [
      "menu",
      "/menu",
      "Menu",
      "dummy_welcome",
      "Get Started",
    ];
    if (senderUser.engagedWith) {
      if (
        !lastResponseMessage ||
        !lastMessageType ||
        lastMessageType === message.type
      ) {
        responseMessage = await postMessage(
          isIncludeMessage.includes(text) ? "Livechat Ended" : text,
          attachment,
          { ...metadata, payload },
          receipent,
          "humanAgent",
          sender,
          llmfields,
          null,
          senderUser?.engagedWith
        );
        await client.hset(this._userRedisKey, `${this._user}:response`, {
          responseMessage,
          lastMessageType: message.type,
        });
      } else if (lastMessageType !== message.type) {
        responseMessage = await postMessage(
          isIncludeMessage.includes(text) ? "Livechat Ended" : text,
          attachment,
          { ...metadata, payload },
          receipent,
          "humanAgent",
          sender,
          lastResponseMessage,
          null,
          senderUser?.engagedWith
        );
        await client.hset(this._userRedisKey, `${this._user}:response`, {
          responseMessage: "",
          lastMessageType: "",
        });
      }
    } else {
      responseMessage = await postMessage(
        isIncludeMessage.includes(text) ? "Starting Menu" : text,
        attachment,
        { ...metadata, payload },
        receipent,
        this._source,
        sender,
        llmfields,
        undefined,
        undefined,
        this._userRedisKey
      );
      await client.hset(this._userRedisKey, `${this._user}:response`, {
        responseMessage: "",
        lastMessageType: "",
      });
    }
    await client.releaseLock(lockKey);

    await this.broadcastToAgents(
      "message:received",
      { ...message, id: messageId },
      metadata,
      this._user
    );
    // stop propagation if sender is user and is engaged in livechat
    if (senderUser.engagedWith) {
      if (["End Livechat", "menu", "/menu", "Menu"].includes(payload)) {
        await this.livechatEnd();
        return null;
      }
      return null;
    }

    // bypass rasa api for local testing
    if (
      ["web", process.env.ANOTHER_HOST_DOMAIN].includes(source) &&
      bypassRasa(this._socket, message.payload, sender, metadata)
    ) {
      return null;
    }
    if (["Lead", "lead"].includes(payload)) {
      return null;
    }
    // fetch response from rasa api
    await this.callRasa(
      message.latitude ? message : message.inputValue ? message : payload,
      metadata,
      text,
      sender,
      responseMessage
    );
  }

  async checkIsAgentActiveOrNot(catagory = null) {
    const users = await client.hgetall(this._userRedisKey);
    const visitorsAndAgents = Object.entries(users).map(([userId, data]) => ({
      userId,
      ...data,
      connected: data.connected || true,
    }));
    const agents = visitorsAndAgents.filter(({ role }) => role === "Agent");
    let activeAgent = agents.filter((agent) => {
      if (catagory) {
        return agent.status === "active" && agent.category === catagory;
      }
      return agent.status === "active";
    });
    if (activeAgent.length > 0) {
      return true;
    } else {
      return false;
    }
  }

  async callRasa(payload, metadata, text, sender, responseMessage) {
    console.log(payload, "checkdatainhandlerss>>>", metadata);
    let source = this._source;
    let isActive = await this.checkIsAgentActiveOrNot();
    const rasaResponse = await RasaAPI.getIntentRequest(
      payload,
      metadata,
      isActive,
      responseMessage
    );
    if (!rasaResponse) {
      return;
    }
    const data = Array.isArray(rasaResponse) ? rasaResponse : [rasaResponse];
    const visitorData = data.find(
      (messageData) =>
        messageData?.visitorData?.name ||
        messageData?.visitorData?.mobile_number ||
        messageData?.visitorData?.email
    )?.visitorData;
    if (visitorData) {
      this.userSetData({ ...visitorData });
    }

    await this.sendMessagesAtInterval(data, sender);

    //let excludeQuery = ["/menu", "/dummy_welcome", "Menu", "End Livechat", "Get Started", "/menu", "menu", "lead"];
    //if (!excludeQuery.includes(text)) {
    //  postQuery(
    //     text,
    //    payload,
    //    source,
    //    data?.some((resData) => resData.isform),
    //    data,
    //    sender
    //  );
    //}
  }

  async userMessage(message, userDetails, details, sender, source, attachment) {
    console.log(
      `Message from ${sender}: ${
        message ? JSON.stringify(message) : JSON.stringify(attachment)
      }`
    );

    // const session = activeSessions.get(socket.id);
    // if (session) {
    //   session.messageCount++;
    // }
    this._io.to(sender).emit("bot:typing");

    const senderUser = await client.hget(this._userRedisKey, sender);
    const receipent = senderUser?.engagedWith || "server";

    const metadata = {
      receipent,
      sender,
      neme: userDetails.name || senderUser?.name || "",
      phoneNumber:
        userDetails.phone ||
        senderUser?.mobileNumber ||
        senderUser?.mobile ||
        "",
      email: userDetails.email || senderUser?.email || "",
      source: this._source,
      branch_id: details.branch_id,
      organization_id: details.org_id,
      time: Date.now(),
    };

    const messageId = crypto.randomUUID();
    console.log(message, "usermessageinhandlers>>>");
    await this.broadcastToAgents(
      "message:received",
      {
        text: message,
        payload: message,
        attachment: attachment,
        type: "userMessage",
        id: messageId,
      },
      metadata,
      sender
    );

    try {
      const aiResponse = await generateAIResponse(
        message,
        details,
        sender,
        source,
        userDetails,
        attachment
      );

      this._io.to(sender).emit("botStop:typing");
      this._io.to(sender).emit("message:received", aiResponse);
      const agentMessage = {
        type: "botMessage",
        text: aiResponse.result || aiResponse.message || "",
        id: crypto.randomUUID(),
      };
      await this.broadcastToAgents(
        "message:received",
        agentMessage,
        this.serverMetadata(sender),
        sender
      );
    } catch (error) {
      console.error("Error generating AI response:", error);
      this._io.to(sender).emit("botStop:typing");
      this._io.to(sender).emit("message:received", {
        message: "I'm sorry, I encountered an error. Please try again.",
        messageId: Date.now().toString(),
      });
    }
  }

  async voiceMessage(audio, sender, filename, type) {
    console.log(`Voice message from ${sender} of ${filename}`);

    // const session = activeSessions.get(socket.id);
    // if (session) {
    //   session.messageCount++;
    // }
    try {
      const voiceResponse = await uploadFile(audio, filename, type);
      this._io.to(sender).emit("voice:response", voiceResponse);
    } catch (error) {
      console.error("Error generating voice response:", error);
      this._io.to(sender).emit("message:received", {
        message:
          "I'm sorry, I couldn't process your voice message. Please try again.",
        messageId: Date.now().toString(),
      });
    }
  }
}

module.exports = Handlers;
