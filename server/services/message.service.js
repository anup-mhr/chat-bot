const ServerServices = require("./server.services");
const { isQueryUnhandeled } = require("./query.service");
const { client } = require("../utils/redis");

async function postMessage(
  message,
  attachment,
  targetSource,
  receipentId,
  type,
  senderId,
  llmfields,
  llmMetadata,
  engagedwith,
  userRedisKey
) {
  console.log(
    message,
    attachment,
    "message in postMessage>>>",
    receipentId,
    type,
    senderId,
    llmfields,
    llmMetadata,
    engagedwith
  );
  let envLlmFields = {};

  if (!llmfields) {
    const USER_REDIS_KEY = `${process.env.ORGANIZATION_ID}:users`;
    const receiver = await client.hget(USER_REDIS_KEY, receipentId);
    const sender = await client.hget(USER_REDIS_KEY, senderId);
    console.log(
      receiver,
      "consoling receiver and sender when llmfiends undefined",
      sender
    );
    // envLlmFields = {
    //   organization_id:
    //     receiver.role === "User"
    //       ? receiver.UserConnectedDetails?.org_id
    //       : sender.role === "User"
    //       ? sender.UserConnectedDetails?.org_id
    //       : receiver.role === "Agent"
    //       ? receiver.AgentDetails?.org_id
    //       : sender.role === "Agent"
    //       ? sender.AgentDetails?.org_id
    //       : null,
    //   branch_id:
    //     receiver.role === "User"
    //       ? receiver.UserConnectedDetails?.branch_id
    //       : sender.role === "User"
    //       ? sender.UserConnectedDetails?.branch_id
    //       : receiver.role === "Agent"
    //       ? receiver.AgentDetails?.branch_id
    //       : sender.role === "Agent"
    //       ? sender.AgentDetails?.branch_id
    //       : null,
    // };
    envLlmFields = {
      organization_id: process.env.NEW_ORGANIZATION_ID,
      branch_id: process.env.NEW_BRANCH_ID,
    };
    console.log(envLlmFields, "envLLMFields>>>");
  }

  const Baseurl = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/history/create-history`;
  const panelKey = process.env.CONTROL_PANEL_KEY;

  const messageText = Array.isArray(message)
    ? message[0]
    : typeof message === "object"
    ? Object.entries(message)
        .map(([key, value]) => `${key}:${value}`)
        .join(" ")
    : message.toString();

  let BasebodyData = {
    human_message: messageText,
    sender: senderId,
    agent:
      type === "fb" ? "facebook" : type === "instagram" ? "instagram" : "web",
    branch: llmfields?.branch_id
      ? llmfields?.branch_id
      : llmfields?.branch
      ? llmfields?.branch
      : envLlmFields?.branch_id
      ? envLlmFields?.branch_id
      : "null",
    organization_id: llmfields?.org_id
      ? llmfields?.org_id
      : llmfields?.organization_id
      ? llmfields?.organization_id
      : envLlmFields?.organization_id
      ? envLlmFields?.organization_id
      : "null",
  };

  if (engagedwith) {
    BasebodyData.agent = "interAgent";
    BasebodyData.agent_name = receipentId ? receipentId : engagedwith;
  }

  if (type === "agent") {
    BasebodyData.agent_message = messageText;
    BasebodyData.agent_name = senderId;
    BasebodyData.sender = receipentId;
    BasebodyData.agent = "interAgent";
    delete BasebodyData.human_message;
  }

  if (type === "humanAgent") {
    BasebodyData.agent = "interAgent";
  }
  if (llmfields?._id) {
    BasebodyData._id = llmfields?._id;
    if (
      llmfields?.agent === "web" &&
      (type === "agent" || type === "humanAgent")
    ) {
      delete BasebodyData._id;
    }
    if (["bot", "fbBot", "instagramBot"].includes(type)) {
      BasebodyData.ai_message = llmMetadata?.messageFor
        ? `${messageText} for ${llmMetadata.messageFor}`
        : messageText;
      BasebodyData.agent =
        type === "fbBot"
          ? "facebook"
          : type === "instagramBot"
          ? "instagram"
          : "web";
      BasebodyData.human_message;
    }
  }

  if (attachment) {
    BasebodyData.attachment = attachment.payload.mediaId;
    BasebodyData.initiator = type === "agent" ? "agent" : "human";
    delete BasebodyData._id;
  }

  if (type === "interAgentMessage") {
    const sender = await client.hget(userRedisKey, senderId);
    const receiver = await client.hget(userRedisKey, receipentId);
    const senderBranches = sender.AgentDetails?.branch_id || [];
    const receiverBranches = receiver.AgentDetails?.branch_id || [];
    const commonBranches = senderBranches.filter((id) =>
      receiverBranches.includes(id)
    );
    const commonBranchId = commonBranches.length > 0 ? commonBranches[0] : null;
    BasebodyData.agent = "interInterAgent";
    BasebodyData.message = messageText;
    BasebodyData.receiver = receipentId;
    BasebodyData.sender = senderId;
    BasebodyData.branch = commonBranchId
      ? commonBranchId
      : llmfields?.branch_id
      ? llmfields?.branch_id
      : llmfields?.branch
      ? llmfields?.branch
      : envLlmFields?.branch_id
      ? envLlmFields?.branch_id
      : "null";
    delete BasebodyData.human_message;
    delete BasebodyData.initiator;
  }

  // console.log(bodyData)
  // console.log("POSTING MESSAGE", bodyData, url)

  let Baseheaders = {
    "Content-Type": "application/json",
    apikey: panelKey,
  };

  console.log(BasebodyData, "body data to send in dashboard", Baseurl);

  try {
    const response = await ServerServices.newPostToServer(
      Baseurl,
      BasebodyData,
      Baseheaders
    );
    console.log(
      response.data,
      "Response after posting dasboard in postmessage>>>",
      response
    );
    return response.data;
  } catch (err) {
    console.log("Please verify your dashboard server is running or not", err);
  }
}

async function patchMessage(message, text = "unsent message") {
  const host = process.env.DASHBOARD_SERVER;
  const port = process.env.DASHBOARD_PORT;
  const protocol = "http://";
  const path = "/rest/v1/messages?access_token=" + process.env.ADMIN_TOKEN;
  const baseUrl = protocol + host + ":" + port + path;

  const headers = {
    "Content-Type": "application/json",
  };

  try {
    const filter =
      '{"where":{"metadata":"{\\"mid\\":\\"' + message.mid + '\\"}"}}';
    const getResponse = await ServerServices.getFromServer(
      baseUrl + `&filter=${filter}`
    );
    const { data: getData } = await getResponse.json();
    if (!getData.length) {
      throw new Error("message to be patched was not found");
    }
    const patchBody = {
      id: getData[0].id,
      text,
    };
    await ServerServices.httpService(baseUrl, headers, "PATCH", patchBody);
  } catch (err) {
    console.log("Please verify your dashboard server is running or not", err);
  }
}

async function postQuery(
  title,
  payload = "",
  senderId = "web",
  forceHandled = false,
  responseMessage,
  visitorUserId
) {
  // const url = `https://${process.env.DASHBOARD_SERVER}/rest/v1/Organizations/${process.env.ORGANIZATION_ID}/queries`;

  try {
    console.log(responseMessage, "respMsg><><><><><", payload, "title", title);
    payload = title ? title : payload;
    senderId = senderId ? senderId.replace(/-agent/g, "") : "web";
    const url = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}/rest/v1/Organizations/${process.env.ORGANIZATION_ID}/queries`;

    const headers = {
      "Content-Type": "application/json",
      Authorization: process.env.BOT_TOKEN,
    };
    const body = {
      visitorUserId,
      senderId,
      query: title,
      intentId: "",
      handled: "true",
      response: responseMessage,
    };
    await ServerServices.httpService(url, headers, "POST", body);
  } catch (error) {
    console.log("ERROR IN POST QUERY", error);
  }
}

async function postLivechatUnhandled(data) {
  try {
    const url = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}/rest/v1/LiveChats
`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: process.env.BOT_TOKEN,
    };
    console.log("data>>>>", data);
    const body = {
      agent_name: data.Agent_name,
      visitor_name: data.Visitor_name || "Annonymous Visitor",
      visitor_id: data.Visitor_id,
      visitor_source: data.Visitor_source,
      event: data.Event,
      organizationId: process.env.ORGANIZATION_ID,
    };
    let response = await ServerServices.httpService(url, headers, "POST", body);
    let responseData = await response.json();
    console.log(responseData, "dbcheck>>>");
  } catch (err) {
    console.log("ERROR IN POST==>> ", err);
  }
}

async function postRate(query, agentid, senderid) {
  try {
    const rating = query.split(":")[1].trim();
    const Baseurl = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/agentAnalytics/agent/rate`;
    const panelKey = process.env.CONTROL_PANEL_KEY;

    let Baseheaders = {
      "Content-Type": "application/json",
      apikey: panelKey,
    };

    const body = {
      visitor: senderid,
      rating: rating,
      agent: agentid,
    };

    console.log(Baseurl, "Sending rating data >>>", body);

    let response = await ServerServices.httpService(
      Baseurl,
      Baseheaders,
      "POST",
      body
    );
    let responseData = await response.json();

    console.log("Response >>>", responseData);
  } catch (err) {
    console.log("ERROR IN POST RATE >>>", err);
  }
}

async function createVisitor(senderid, llmFields, source) {
  try {
    const Baseurl = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/visitors/create-visitor`;
    const panelKey = process.env.CONTROL_PANEL_KEY;

    let Baseheaders = {
      "Content-Type": "application/json",
      apikey: panelKey,
    };

    const body = {
      sender: senderid,
      organization_id: llmFields.org_id,
      branch: llmFields.branch_id,
      agent: source,
    };
    await ServerServices.httpService(Baseurl, Baseheaders, "POST", body);
  } catch (err) {
    console.log("ERROR IN create visitor>>>", err);
  }
}

exports.postMessage = postMessage;
exports.patchMessage = patchMessage;
exports.postQuery = postQuery;
exports.postRate = postRate;
exports.createVisitor = createVisitor;
exports.postLivechatUnhandled = postLivechatUnhandled;
