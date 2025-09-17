const catchAsync = require("../utils/catchAsync");
const fetch = require("node-fetch");
const serverServices = require("../server.services");
require("dotenv").config();

const baseUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}`;

exports.getFile = catchAsync(async function (req, res) {
  const path = req.query.path;
  const response = await serverServices.getFromServer(
    `${baseUrl}/${process.env.BASEPATH}/uploads/${path}?access_token=${process.env.BOT_TOKEN}`
  );
  const responseContentType = response.headers.get("content-type");
  const contentType = responseContentType;
  res.set({ "Content-Type": contentType });
  response.body.pipe(res);
});
