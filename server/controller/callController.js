const catchAsync = require("../utils/catchAsync");
const fetch = require("node-fetch");
const { encrypt } = require("../crypto.services");
let Baseurl = process.env.CONTROL_PANEL_URL;
let middleWareUrl = process.env.MIDDLEWARE_URL;
exports.getCallSettings = catchAsync(async function (req, res) {
  let organization = req.query.organization;
  let branch = req.query.branch || null;
  let sender = req.query.sender;
  let region = req.query.region || null;
  console.log({ organization, branch, region }, "checkobjeec>>");
  let url = `${Baseurl}/api/bot/get-bot/${organization}?branch=${branch}`;
  console.log(url, "checkurl>>>");
  let response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.CONTROL_PANEL_KEY,
    },
  });
  let result = await response.json();
  console.log(result, "result>>>");
  let org_data = {};
  if (result.success === false || !result.data) {
    res.status(400).send({
      success: false,
      message: "Errror fetching data from dashboard",
    });
  } else {
    org_data = {
      details: {
        timezone:
          result.data?.branch?.timezone || result.data?.client?.timezone,
        regionId: result.data?.branch?.region,
        slotDuration: result.data?.branch?.slotDuration,
        bookingTimeSlot: result.data?.branch?.bookingTimeSlot,
        multipleBooking: result.data?.branch?.multipleBooking,
        apiKey: encrypt(result.data?.openApi?.apiKey),
      },
      fromNumber: result.data?.twilio?.callNumber || null,
      clientId: organization,
      locationId: branch,
      chatbotName: result.data?.name,
      orgName: result.data?.client?.name,
      assistantId: result?.data?.vapi?.assistantId,
      assistandPrivateKey: result?.data?.vapi?.assistantPublicKey,
      callType: "webcall",
      prompt: result?.data?.confirmationPrompt || null,
    };
  }

  console.log(org_data, "org_data>>>");

  return res.status(200).send(org_data);
});

exports.finalCallSettings = catchAsync(async function (req, res) {
  let finalApiCallUrl = `${middleWareUrl}/api/booking_slots`; //`https://f1f4-2400-1a00-4b45-e18a-2bcb-a102-1a92-61e9.ngrok-free.app/api/booking_slots`;

  let responseFinal = await fetch(finalApiCallUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      authorization: process.env.MIDDLEWARE_URL_API_KEY,
    },
    body: JSON.stringify({
      clientId: req.body.clientId,
      locationId: req.body.locationId,
      timezone: req.body.timezone,
      bookingSlots: req.body.bookingSlots,
      multipleBooking: req.body.multipleBooking,
      slotDuration: req.body.slotDuration,
    }),
  });

  let finalresponse = await responseFinal.json();
  return res.status(200).send(finalresponse);
});

exports.promptGetters = catchAsync(async function (req, res) {
  let chatbotName = req.body.chatbotName;
  let orgName = req.body.orgName;
  let timezone = req.body.timezone;
  let organization = req.body.organization;
  let prompt = req.body.prompt;

  let url = `${middleWareUrl}/llm-vapi/get-prompt`;
  console.log(url, "checkurl>>>");

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: process.env.MIDDLEWARE_URL_API_KEY,
    },
    body: JSON.stringify({
      chatbotName: chatbotName,
      organization: organization,
      orgName: orgName,
      time_zone: timezone,
      type: "webCallPrompt",
      prompt: prompt,
    }),
  });

  let result = await response.json();
  console.log(result, "result>>>");

  return res.status(200).send(result);
});
