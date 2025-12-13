const catchAsync = require("../utils/catchAsync");
const serverServices = require("../services/server.services");
const xss = require("xss");

const baseUrl = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}`;
const loggerModule = require("../logger/main");

exports.login = catchAsync(async function (req, res) {
  const url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/auth/live-chat/login`;
  const panelKey = process.env.CONTROL_PANEL_KEY;

  let headers = {
    "Content-Type": "application/json",
    apikey: panelKey,
  };

  const bodyData = {
    email: xss(req.body.identifier),
    password: xss(req.body.password),
  };

  // const url = `${baseUrl}/rest/v1/Users/login`;

  // const bodyData = {
  //   ref: "livechat",
  //   username: req.sanitize(req.body.identifier),
  //   password: req.sanitize(req.body.password),
  // };

  // const headers = {
  //   "Content-Type": "application/json",
  // };

  const response = await serverServices.postToServer(url, bodyData, headers);

  const data = await response.json();

  if (data?.data?.department) {
    delete data.data.department;
  }

  // if (data?.data?.organizationId !== process.env.NEW_ORGANIZATION_ID) {
  //   throw new Error("User not found with the given credentials");
  // }

  res.status(response.status).json({ msg: data.data });
});
