const crypto = require("crypto");
const { getUserData } = require("./utils");

const getUserName = async (userId, requesterRole = null) => {
  let visitorName =
    (await getUserData(userId, requesterRole)?.name) || typeof userId === "number" ? userId + " " : userId;
  console.log("visitorName>>>>>", visitorName);
  return visitorName;
};

module.exports = {
  rasaServerDown: {
    id: crypto.randomUUID(),
    type: "rasaServerDown",
    text: "To serve you better please connect with a live agent or request a callback by clicking the button below.",
    buttons: [
      {
        title: "Talk to Live Agent",
        payload: "livechat:request:all",
      },
      {
        title: "Get a Callback",
        payload: "/call_back",
      },
    ],
  },
  alreadyEngaged: async (requestId, engagedWith, userId) => ({
    id: crypto.randomUUID(),
    type: "livechatAlreadyEngaged",
    text: `${requestId ? `${await getUserName(requestId)} is` : "You are"} already talking with ${
      engagedWith === userId ? "you" : await getUserName(engagedWith)
    }`,
  }),

  alreadyRequested: async (requestId, requester, userId) => ({
    id: crypto.randomUUID(),
    type: "livechatAlreadyRequested",
    text: `${requester === userId ? "You have" : (await getUserName(requester)) + " has"} already requested ${
      requestId ? await getUserName(requestId) : ""
    }`,
  }),
  alreadyRequestedself: async (requestId, requester, userId) => ({
    id: crypto.randomUUID(),
    type: "livechatAlreadyRequested",
    text: `You have already requested for a live chat. Please wait...`,
  }),

  notYetRequested: async (rejectId) => ({
    id: crypto.randomUUID(),
    type: "livechatNotRequested",
    text: rejectId ? `${await getUserName(rejectId)} has not requested yet` : "You have not received a request yet.",
  }),

  notAvailable: (category) => ({
    id: crypto.randomUUID(),
    type: "livechatNotAvailable",
    text: `Sorry! No one is available in ${category.toUpperCase()} department for livechat.`,
  }),

  incomingRequest: async (requesterRole, userId, expiry, source, attachedMessage) => ({
    id: crypto.randomUUID(),
    type: `livechatIncomingRequest`,
    ping: true,
    notification: true,
    agentName: `${await getUserName(userId)}` || `Live Agent`,
    message: attachedMessage,
    text: `${await getUserName(userId, requesterRole)} has requested live chat. Please accept.`, // ${requesterRole || "User"}   within ${expiry} to start a live chat session.
    buttons: [
      {
        title: "Accept",
        payload: `livechat:accept:${JSON.stringify({ visitorId: userId, source })}`,
      },
      {
        title: "Reject",
        payload: `livechat:reject:${userId}`,
      },
    ],
  }),

  sentRequest: () => ({
    id: crypto.randomUUID(),
    type: "livehchatSentRequest",
    text: `A request to live chat has been sent`,
  }),

  expiredRequest: async (requestId) => ({
    id: crypto.randomUUID(),
    type: "livechatExpiredRequest",
    text: `Your request to live chat ${requestId ? "with " + (await getUserName(requestId)) : ""} has expired.`,
  }),
  expiredRequestOpposite: async (role, requestId) => ({
    id: crypto.randomUUID(),
    type: "livechatExpiredRequestOpp",
    text: `A live chat request from ${requestId} has expired.`,
  }),

  livechatStart: async (userId, sessionTime, fromId, isTranferred, isIntervened, attachedMessage) => ({
    id: crypto.randomUUID(),
    type: "livechatStarted",
    message: attachedMessage,
    text: isTranferred
      ? fromId
        ? `Agent ${await getUserName(fromId)} has transferred livechat with ${await getUserName(userId)} to you`
        : `Your conversation has been transferred to another Human Agent.`
      : isIntervened
      ? fromId
        ? `You have taken over chat session of ${await getUserName(userId)}`
        : `Your conversation has been taken over by a Human Agent.`
      : // `Hello, I am ${await getUserName(userId)}. How may i help you?`
        `Your conversation has been assigned to a Human Agent.`, // The session will last for ${sessionTime}
    uiMsg: `Conversation transferred to ${await getUserName(userId)}`,
  }),

  livechatReject: async (userId) => ({
    id: crypto.randomUUID(),
    type: "livechatRejected",
    text: `${userId ? `${await getUserName(userId)} has` : "You have"} rejected live chat request.`,
  }),

  livechatExpire: async (id, forced, name) => ({
    id: crypto.randomUUID(),
    type: "livechatExpired",
    text: `Your live chat with ${name ? name : await getUserName(id)} has ${forced ? "ended" : "expired"}.`,
    uiMsg: `Conversation ended with ${await getUserName(id)}`,
  }),

  transferRequest: async (requesterId, visitorId, expiry, source) => ({
    id: crypto.randomUUID(),
    type: "livechatTransferRequest",
    ping: true,
    notification: true,
    text: `Agent ${await getUserName(requesterId)} has requested to transfer livechat with ${await getUserName(
      visitorId
    )} to you. Please accept within ${expiry} to continue the session.`,
    buttons: [
      {
        title: "Accept",
        payload: `livechat:transferAccept:${JSON.stringify({ visitorId, source })}`,
      },
      {
        title: "Reject",
        payload: `livechat:transferReject:${visitorId}`,
      },
    ],
  }),

  transferSuccess: async (transferId, agentId) => ({
    id: crypto.randomUUID(),
    type: "livechatTransferSuccess",
    text: `Live chat with User ${await getUserName(transferId)} has been transferred to Agent ${await getUserName(
      agentId
    )}`,
  }),

  transferFailure: async (visitorId, agentId) => ({
    id: crypto.randomUUID(),
    type: "livechatTransferFailure",
    text: `Your request to transfer livechat with ${await getUserName(
      visitorId
    )} has been rejected by ${await getUserName(agentId)}`,
  }),

  transferFailed: async (transferId, agentId) => ({
    id: crypto.randomUUID(),
    type: "livechatTransferFailed",
    text: `Live chat with User ${await getUserName(transferId)} could not be transferred to Agent ${await getUserName(
      agentId
    )}`,
  }),

  notEngaged: async (engangedId) => ({
    id: crypto.randomUUID(),
    type: "livechatNotEngaged",
    text: `You are not engaged in ${
      engangedId ? "live chat with " + (await getUserName(engangedId)) : "any live chat session."
    }`,
  }),

  notActive: (toUser = false) => ({
    id: crypto.randomUUID(),
    type: "notActive",
    text: toUser ? "The agent is no more active" : "You are not active. Please toggle your status.",
  }),

  userNotFound: (userId) => ({
    id: crypto.randomUUID(),
    type: "userNotFound",
    text: `The user you are trying to interact with, ${userId}, is not connected right now.`,
  }),

  newMessage: async (visitorId, message, source) => ({
    id: crypto.randomUUID(),
    type: "livechatNewMessage",
    notification: true,
    text: `${await getUserName(visitorId)} has sent you a message: ${message}`,
    buttons: [
      {
        title: "Go to Conversation",
        payload: `livechat:newMessage:${JSON.stringify({ visitorId, source })}`,
      },
    ],
  }),

  parseLivechatPayload(message) {
    if (!message?.payload) return "Invalid payload";
    const payload = message.payload;
    if (payload.startsWith("livechat:accept:")) {
      try {
        const dataPart = payload.replace("livechat:accept:", "");
        const data = JSON.parse(dataPart);
        return `Livechat request from ${data.visitorId} has been accepted.`;
      } catch {
        const visitorId = payload.split("livechat:accept:")[1];
        return `Livechat request from ${visitorId} has been accepted.`;
      }
    } else if (payload.startsWith("livechat:reject:")) {
      try {
        const dataPart = payload.replace("livechat:reject:", "");
        const data = JSON.parse(dataPart);
        return `Livechat request from ${data.visitorId} has been rejected.`;
      } catch {
        const visitorId = payload.split("livechat:reject:")[1];
        return `Livechat request from ${visitorId} has been rejected.`;
      }
    }
    return message.text || message.payload;
  },
};
