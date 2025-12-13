const catchAsync = require("../utils/catchAsync");
const serverServices = require("../services/server.services");
const fetch = require("node-fetch");
const FormData = require("form-data");

const keys = process.env;
const baseUrl = `${keys.DASHBOARD_PROTOCOL}://${keys.DASHBOARD_SERVER}:${keys.DASHBOARD_PORT}`;

const whatsappBot = require("../bot/whatsapp.bot");

exports.getFile = catchAsync(async function (req, res) {
  const path = req.query.path;
  const response = await serverServices.getFromServer(
    `${baseUrl}/${process.env.BASEPATH}/uploads/${path}?access_token=${process.env.BOT_TOKEN}`
  );
  // console.log("URL=>", `${baseUrl}/uploads/${path}`);
  const responseContentType = response.headers.get("content-type");
  // console.log(responseContentType, "RESPONSE CONTENT TYPE")
  const contentType = responseContentType;
  res.set({ "Content-Type": contentType });
  response.body.pipe(res);
});

exports.getWhatsappFile = catchAsync(async function (req, res) {
  const mediaId = req.params.mediaId?.split(".")[0];
  const response = await whatsappBot.downloadMedia(mediaId);

  res.set({
    "Content-Type": response.headers.get("Content-Type"),
    "Content-Length": response.headers.get("Content-Length"),
    "Content-Disposition": response.headers.get("Content-Disposition"),
  });
  response.body.pipe(res);
});

exports.uploadFile = catchAsync(async function (req, res) {
  try {
    console.log(
      req.body,
      req.file,
      "consoling request body and query of file>>>",
      req.query
    );
    let url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/media/singleLivechat`;
    if (req.query.type.startsWith("image/")) {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/media/singleLivechat`;
    } else if (req.query.type.startsWith("audio")) {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/files/audioUploadLivechat`;
    } else if (req.query.type.startsWith("video")) {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/files/videoUploadLivechat`;
    } else {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/files/pdfUploadLivechat`;
    }

    const panelKey = process.env.CONTROL_PANEL_KEY;

    if (!req.file) {
      throw new Error("File is required");
    }

    let type = req.query.type.startsWith("image/")
      ? "LIVE_CHAT_IMAGE"
      : req.query.type.startsWith("audio")
      ? "LIVE_CHAT_AUDIO"
      : req.query.type.startsWith("video")
      ? "LIVE_CHAT_VIDEO"
      : "LIVE_CHAT_FILE";

    const formData = new FormData();
    formData.append("file", req.file.buffer, req.file.originalname);
    formData.append("type", type);

    console.log(
      formData,
      "consoling bodydata and url before posting>>>",
      url,
      type
    );

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        apikey: panelKey,
      },
    });

    const data = await response.json();

    console.log(data, "data after post file>>>");

    const fileBaseUrl = process.env.FILE_BASE_URL;
    res.status(200).json({ data: data.data });
  } catch (error) {
    console.error("Error in uploading file: ", error);
  }
});

exports.deleteFile = catchAsync(async function (req, res) {
  let url = `${baseUrl}/${keys.BASEPATH}/uploads/upload`;

  url = Object.keys(req.query).includes("from_chatbot")
    ? `${url}&access_token=${process.env.ADMIN_TOKEN}`
    : `${url}&access_token=${req.headers.authorization}`;

  const response = await serverServices.postToServer(url, req.body);

  const data = await response.json();

  res.status(response.status).json({ data });
});
