const { postToServer } = require("./server.services");
const { errorLogger } = require("../logger/main");

const systemLogger = async (level, message, metaData, status, tag) => {
  // system logger
  try {
    const baseUrl = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}`;

    let url = `${baseUrl}/rest/v1/SystemLoggers`;

    let headers = {
      "Content-Type": "application/json",
      Authorization: process.env.ADMIN_TOKEN,
    };
    let payload = {
      level: level,
      message: message || "system logger message",
      organizationId: process.env.ORGANIZATION_ID,
      statusCode: status,
      tags: tag,
      source: "liveChat",
      metadata: metaData,
    };
    const logger = await postToServer(url, payload, headers);
    console.log(logger, "system logger response");
  } catch (err) {
    let messageJSON = {
      title: `${tag} error`,
      botName: "CG-bot",
    };
    errorLogger.log({
      level: "error",
      timeStamp: new Date(),
      message: messageJSON,
    });
    console.log(messageJSON, "error Response");
  }
};
exports.loggerInfo = function (message, metaData, status = 500, tag = "") {
  return systemLogger("info", message, metaData, status, tag);
};
exports.loggerError = function (message, metaData, status = 500, tag = "") {
  return systemLogger("error", message, metaData, status, tag);
};