const { client } = require("../utils/redis");
const Handlers = require("./handlers");
const eventsMap = require("./eventsMap");

const { loggerInfo, loggerError } = require("../services/logger.services");

const USER_REDIS_KEY = `${process.env.ORGANIZATION_ID}:users`;
const SESSION_REDIS_KEY = `${process.env.ORGANIZATION_ID}:sessions`;
const PAYLOAD_ACCEPT_ACTIONS = [
  "accept",
  "reject",
  "end",
  "request",
  "transferRequest",
  "transferAccept",
  "transferReject",
];

// socket error handler
const withErrorHandler = (action) =>
  async function (...args) {
    const eventName = action.replace(
      /([a-z][A-Z])/,
      (x) => `${x[0]}:${x[1].toLowerCase()}`
    );
    try {
      const data = await this(...args);
      const mapFunction = eventsMap[action];
      if (!mapFunction || typeof mapFunction !== "function") {
        return;
      }
      const metadata = {
        action,
        ...((await mapFunction(data)) || {}),
      };
      loggerInfo(action, metadata, 200, eventName);
    } catch (error) {
      console.log(`ERROR IN SOCKET HANDLER ${action} => `, error);
      loggerError(error?.message || error, { action }, null, eventName);
      const callback = args.find((arg) => typeof arg === "function");
      return callback ? callback() : null;
    }
  };

async function handleSocketPayload(payload) {
  console.log(payload, "consoling payloads from handle socket payload");
  try {
    let [type, action, ...args] = payload.split(":");
    if (!type || !action) {
      return false;
    }
    if (args.join(":").includes("{")) {
      try {
        args = Object.values(JSON.parse(args.join(":")));
      } catch (error) {
        args = args;
      }
    }
    const eventName = type + action[0].toUpperCase() + action.slice(1);
    if (type === "livechat" && this._PAYLOAD_ACCEPT_ACTIONS.includes(action)) {
      await withErrorHandler(eventName).bind(this[eventName].bind(this))(
        ...args
      );
      return true;
    }
    return false;
  } catch (error) {
    console.log("ERROR IN HANDLE SOCKET PAYLOAD => ", payload, error);
    return false;
  }
}

// Socket.IO logic
const activeSessions = new Map();

exports.init = function (io) {
  client.del(USER_REDIS_KEY);
  client.del(SESSION_REDIS_KEY);

  io.use(function (socket, next) {
    try {
      next();
    } catch (error) {
      console.log("ERROR IN SOCKET REQUEST => ", error);
      socket.disconnect();
    }
  });

  io.sockets.on("connection", function (socket) {
    socket.on("error", (error) => {
      console.error("Socket error for", socket.id, ":", error);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    socket.on("disconnect", (reason) => {
      activeSessions.delete(socket.id);
      console.log("Client disconnected:", reason);
    });
    activeSessions.set(socket.id, {
      connectedAt: new Date(),
      messageCount: 0,
    });
    const handlers = new Handlers(
      io,
      socket,
      USER_REDIS_KEY,
      PAYLOAD_ACCEPT_ACTIONS
    );
    handlers.handleSocketPayload = handleSocketPayload;
    Object.keys(eventsMap).forEach((action) => {
      const eventName = action.replace(
        /([a-z][A-Z])/,
        (x) => `${x[0]}:${x[1].toLowerCase()}`
      );
      socket.on(
        eventName,
        withErrorHandler(action).bind(handlers[action].bind(handlers))
      );
    });
  });
};
