const fetch = require("node-fetch");
const { client } = require("../utils/redis");
const catchAsync = require("../utils/catchAsync");
require("dotenv").config();

let Baseurl = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}`;
exports.getPlatformSettings = catchAsync(async function (req, res) {
  let organization = req.query.organization;
  let usedField = req.query.usedField;
  let queryParams = req.query.queryParams;
  let url = `${Baseurl}/api/platformSetting?${queryParams}=${usedField}&channel=web`;
  console.log(url, "checkurlplatform>>>");
  let response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.CONTROL_PANEL_KEY,
    },
  });
  let result = await response.json();
  console.log(result, "result>>>");
  return res.send(result);
});
exports.getOrgUi = catchAsync(async function (req, res) {
  let organization = req.query.organization;
  let branch = req.query.branch || null;
  let sender = req.query.sender;
  let region = req.query.region || null;
  console.log({ organization, branch, region }, "checkobjeec>>");
  let url = `${Baseurl}/api/bot/get-bot/${organization}${
    branch ? (branch !== "all" ? `?branch=${branch}` : "") : `?region=${region}`
  }`;
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
    org_data = {
      Bot_Logo: null,
      Welcome_Message: `Hello, I am your virtual assistant. What can I help you with today?`,
      organization_name: "Keep me",
      chatbot_name: "Bot",
      header_Name: "Bot",
      org_id: organization,
      branch_id: branch === "all" ? null : branch,
      region_id: region,
      primaryColor: "#5CCC9D",
      secondaryColor: "#376b7e",
    };
  } else {
    org_data = {
      header_Logo:
        result?.data?.headerMedia?.path || result?.data?.media?.path || null,
      header_Name: result?.data?.header || result.data?.client?.name || null,
      bot_Logo: result?.data?.media?.path || null,
      Welcome_Message:
        !result.data.welcomeMessage ||
        result.data.welcomeMessage === "<p><br></p>"
          ? `Welcome to ${result.data.client.name}. What can I help you with today?`
          : result.data.welcomeMessage,
      // organization_name: result.data.client.name,
      // chatbot_name: result.data?.client?.name || "Bot",
      org_id: organization,
      // branch_id: branch === "all" ? null : branch,
      branch_id: branch,
      region_id: region,
      gdpr: result.data.gdpr,
      // type: result.data.branch?.type || null,
      // details: { client: { ...result.data.client },branch: typeof result.data.branch === "object" ? { ...result.data.branch } : {}
      // },
      country:
        result.data.branch?.country ||
        result.data.client?.country ||
        result.data.region ||
        "",
      primaryColor: result.data.primaryColor || "#5CCC9D",
      secondaryColor: result.data.secondaryColor || "#376b7e",
      // prompt:result.data.prompt || null
    };

    const redisKey = `llmDetails:${
      branch ? (branch === "all" ? organization : branch) : region
    }`;
    let llmDetails = {
      organization_name: result.data.client.name,
      chatbot_name: result.data?.client?.name || "Bot",
      welcome_message:
        result.data.welcomeMessage ||
        `Welcome to ${result.data.client.name}. What can I help you with today?`,
      org_id: organization,
      branch_id: branch === "all" ? null : branch,
      type: result.data.branch?.type || null,
      venue_id: result.data.branch?.venueId || null,
      twilio: result.data.twilio || null,
      details: {
        client: { ...result.data.client },
        branch:
          typeof result.data.branch === "object"
            ? { ...result.data.branch }
            : {},
      },
      prompt: result.data.prompt || null,
      openAiKeys: result.data.openApi || null,
      bookingSlot: result.data.branch?.bookingTimeSlot || null,
      multipleBooking: result.data.branch?.multipleBooking || null,
      bookingCount: result.data.branch?.bookingCount || null,
      slotDuration: result.data.branch?.slotDuration || null,
      useRegion:
        result.data?.useRegion === undefined ? true : result.data?.useRegion,
    };
    console.log(llmDetails, "forRedis>>>");
    await client.hset(redisKey, "llmDetails", llmDetails, 7200);
  }

  console.log(org_data, "org_data>>>");

  return res.send(org_data);
});
exports.getBranch = catchAsync(async function (req, res) {
  try {
    let region = req.query.region;
    let url = `${Baseurl}/api/branches/branches-list?region=${region}`;
    // let url = `https://0a61-103-163-182-174.ngrok-free.app/api/branches/branches-list?region=67445b6a00e18b32203fe222`;
    console.log(url, "url>>>");
    let response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.CONTROL_PANEL_KEY,
      },
    });
    let result = await response.json();
    let branchList = [];
    result.data.branches.forEach((data) => {
      branchList.push({ branchName: data.name, branchId: data._id });
    });
    console.log(branchList, "checkBranch>>>>");
    res.send(branchList);
  } catch (error) {
    res.send([]);
  }
});
exports.checkUrl = catchAsync(async function (req, res) {
  let organization = req.query.organization;
  let userUrl = req.query.userUrl;
  try {
    let url = `${Baseurl}/api/bot/bot-url/${organization}?webUrl=${userUrl}`;
    console.log(url, "url>>>");
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
    if (result.success === false) {
      org_data = {
        success: false,
      };
    } else {
      org_data = {
        success: true,
        header_Logo:
          result?.data?.headerMedia?.path || result?.data?.media?.path || null,
        header_Name: result?.data?.header || result.data?.client?.name || null,
        bot_Logo: result?.data?.media?.path || null,
        Welcome_Message:
          !result.data.welcomeMessage ||
          result.data.welcomeMessage === "<p><br></p>"
            ? `Welcome to ${result.data.client.name}. What can I help you with today?`
            : result.data.welcomeMessage,
        org_id: organization,
        branch_id: result.data.branch,
        gdpr: result.data.gdpr,
        country:
          result.data.branch?.country ||
          result.data.client?.country ||
          result.data.region ||
          "",
        primaryColor: result.data.primaryColor || "#5CCC9D",
        secondaryColor: result.data.secondaryColor || "#376b7e",
      };

      const redisKey = `llmDetails:${
        result.data.branch
          ? result.data.branch === "all"
            ? organization
            : result.data.branch
          : region
      }`;
      let llmDetails = {
        organization_name: result.data.client.name,
        chatbot_name: result.data?.client?.name || "Bot",
        welcome_message:
          result.data.welcomeMessage ||
          `Welcome to ${result.data.client.name}. What can I help you with today?`,
        org_id: organization,
        branch_id: result.data.branch === "all" ? null : result.data.branch,
        type: result.data.branch?.type || null,
        venue_id: result.data.branch?.venueId || null,
        twilio: result.data.twilio || null,
        details: {
          client: { ...result.data.client },
          branch:
            typeof result.data.branch === "object"
              ? { ...result.data.branch }
              : {},
        },
        prompt: result.data.prompt || null,
      };

      await client.hset(redisKey, "llmDetails", llmDetails, 7200);
    }

    console.log(org_data, "org_data>>>");

    return res.send(org_data);
  } catch (error) {
    console.log("Error on url>>", error);
  }
});
exports.flushRedis = catchAsync(async function (req, res) {
  let redisKey = req.query.redisKey;
  await client.del(redisKey);
  return res.send("done");
});
