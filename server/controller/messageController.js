const catchAsync = require("../utils/catchAsync");
const serverServices = require("../services/server.services");

const keys = process.env;
const baseUrl = `${keys.DASHBOARD_PROTOCOL}://${keys.DASHBOARD_SERVER}:${keys.DASHBOARD_PORT}`;

const { accessLogger } = require("../logger/main");

exports.getMessages = catchAsync(async function (req, res) {
  const url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/history/get-message-history?sender=${req.query.user_id}&type=${req.query.type}&organization_id=${req.query.org_id}`;
  const panelKey = process.env.CONTROL_PANEL_KEY;

  let headers = {
    "Content-Type": "application/json",
    apikey: panelKey,
    authorization: `Bearer ${req.query.token}`,
  };
  // let url = `${baseUrl}/${keys.BASEPATH}/visitors/${req.query.user_id}/messages?filter={"page":${req.query.start}}`;
  console.log(url, "url at getMessage>>>", headers);
  // url = Object.keys(req.query).includes("from_chatbot")
  //   ? `${url}&access_token=${process.env.ADMIN_TOKEN}`
  //   : `${url}&access_token=${req.headers.authorization}`;
  const response = await serverServices.getFromServer(url, headers);
  const data = await response.json();
  accessLogger.log({
    level: "info",
    timestamp: new Date(),
    message: {
      title: "Successfully fetched messages",
    },
  });

  res.status(response.status).json({ data });
});

exports.getMessagesWithVisitors = catchAsync(async function (req, res) {
  let url = `${baseUrl}/${keys.BASEPATH}/visitors/source?user_id=${req.query.user_id}&filter={"limit":20}&access_token=${process.env.ADMIN_TOKEN}&organizationId=${process.env.ORGANIZATION_ID}&source=web`;

  const response = await serverServices.getFromServer(url, { "Content-Type": "application/json" });

  const data = await response.json();

  accessLogger.log({
    level: "info",
    timestamp: new Date(),
    message: {
      title: "Successfully fetched visitors messages",
    },
  });

  return res.status(200).json({ data });
});

exports.getMessageByMid = catchAsync(async function (req, res) {
  const filter = '{"where":{"metadata":"{\\"mid\\":\\"' + req.query.mid + '\\"}"}}';
  const url = `${baseUrl}/${keys.BASEPATH}/messages?filter=${filter}&access_token=${req.headers.authorization}`;
  const response = await serverServices.getFromServer(url, { "Content-Type": "application/json" });

  const data = await response.json();

  accessLogger.log({
    level: "info",
    timestamp: new Date(),
    message: {
      title: "Successfully fetched message by mid",
    },
  });

  res.status(response.status).json({ data });
});
