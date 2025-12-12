const { client } = require("./utils/redis");
const ServerServices = require("./server.services");
const FormData = require("form-data");
require("dotenv").config();
const fetch = require("node-fetch");
require("dotenv").config();

const baseUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}`;

async function generateAIResponse(
  message,
  redisDetails,
  sender,
  source,
  userDetails,
  attachment
) {
  let redisKey;
  console.log(userDetails, "branchSelected", redisDetails);
  if (redisDetails?.branchSelected) {
    redisKey = `llmDetails:${redisDetails.branchSelected}`;
  } else {
    redisKey = `llmDetails:${
      redisDetails?.branch_id
        ? redisDetails.branch_id === "all"
          ? redisDetails.org_id
          : redisDetails.branch_id
        : redisDetails.region_id
    }`;
  }

  let details = await client.hget(redisKey, "llmDetails");

  if (Object.keys(details).length < 1) {
    let apiCallUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/ui/getOrganizationUi?organization=${redisDetails.org_id}`;
    if (redisDetails.branchSelected) {
      apiCallUrl += `&branch=${redisDetails.branchSelected}`;
    } else {
      if (redisDetails.branch_id) {
        apiCallUrl += `&branch=${redisDetails.branch_id}`;
      } else if (redisDetails.region_id) {
        apiCallUrl += `&region=${redisDetails.region_id}`;
      }
    }

    await fetch(apiCallUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    details = await client.hget(redisKey, "llmDetails");
  }

  console.log(
    details,
    "details to  pass in llM from generateAIResponse",
    message
  );
  let submetadata = {};

  if (!message && !attachment) {
    return;
  } else {
    let excludePayload = ["lead", "Starting Menu", "About Us"].includes(
      message
    );
    if (!excludePayload) {
      submetadata = {
        phone_number: userDetails.phone || "",
        first_name: userDetails.name ? userDetails.name.split(" ")[0] : "",
        last_name:
          userDetails.name && userDetails.name.includes(" ")
            ? userDetails.name.substring(userDetails.name.indexOf(" ") + 1)
            : "",
        gdprLlm: redisDetails.gdpr ? String(redisDetails.gdpr) : "",
      };
      console.log(submetadata, "submetdtaa>>>");
      if (details.type) {
        submetadata.type = details.type;
      }
      if (userDetails.subject) {
        submetadata.subject = userDetails.subject;
      }
      if (userDetails.to_email) {
        submetadata.organization_email = userDetails.to_email;
      }
    } else {
      return;
    }
  }

  let openAi = `${process.env.OpenUrl}${
    attachment ? "llm/palmmindaudio" : "llm/generate/response/chat/completions"
  }`;

  let body = {
    query: attachment ? attachment.payload.path : message,
    organization_name: details.organization_name || "",
    chatbot_name: details.chatbot_name || "",
    stream: false,
    sender: sender + "",
    agent: source,
    welcome_message: details.welcome_message || "",
    details: details.details || {},
    useRegion: details.useRegion,
    metadata: {
      ...submetadata,
    },
  };

  if (details.venue_id) {
    body.venue_id = details.venue_id;
  }
  if (details.prompt) {
    body.prompt = details.prompt;
  }
  if (details.org_id) {
    body.org_id = details.org_id;
  }
  if (details.region) {
    body.region_id = details.region;
  }

  if (details.api_key) {
    body.api_key = details.api_key;
  }

  if (details.twilio) {
    body.twilio = details.twilio;
  }
  if (details.bookingSlot) {
    body.bookingSlot = details.bookingSlot;
  }
  if (details.slotDuration) {
    body.duration = details.slotDuration;
  }
  if (details.multipleBooking) {
    body.multipleBooking = details.multipleBooking;
  }
  if (details.bookingCount) {
    body.bookingCount = details.bookingCount;
  }
  if (details.branch_id) {
    body.branch = details.branch_id;
  }
  if (details.configType) {
    body.configType = details.configType;
  }
  if (details.whatsappNumber) {
    console.log("enterr whatsapp>>");
    body.whatsapp_number = details.whatsappNumber;
  }
  if (source === "facebook") {
    console.log();
    console.log({ metadata, body });
    console.log();
    body.pg_id = metadata.pg_id;
  }

  console.log(JSON.stringify(body), "body to  pass in llM");

  const headers = {
    "Content-Type": "application/json",
    "file-type": "txt",
    apiKey: process.env.OPENAI_KEY,
  };

  const response = await ServerServices.postToServer(openAi, body, headers);
  let responseData = await response.json();
  console.log(responseData, "called>>>>", message, attachment);

  return responseData;

  await new Promise((resolve) =>
    setTimeout(resolve, 1000 + Math.random() * 2000)
  );

  const responses = [
    "I understand your question. Let me help you with that.",
    "That's an interesting point. Here's what I think...",
    "I can definitely assist you with that. Let me provide some information.",
    "Thank you for asking! Here's my response to your query.",
    "I see what you're looking for. Let me explain this for you.",
  ];

  return (
    responses[Math.floor(Math.random() * responses.length)] +
    " " +
    `You asked: "${message}". This is a simulated responsse. In a real implementation, you would integrate with an AI service like OpenAI, Claude, or other AI providers.`
  );
}

async function uploadFile(audio, filename, filetype) {
  try {
    let url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/media/singleLivechat`;
    if (filetype.startsWith("image/")) {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/media/singleLivechat`;
    } else if (filetype.startsWith("audio")) {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/files/audioUploadLivechat`;
    } else if (filetype.startsWith("video")) {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/files/videoUploadLivechat`;
    } else {
      url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/files/pdfUploadLivechat`;
    }

    const panelKey = process.env.CONTROL_PANEL_KEY;

    if (!audio) {
      throw new Error("audio is required");
    }

    let type = filetype.startsWith("image/")
      ? "LIVE_CHAT_IMAGE"
      : filetype.startsWith("audio")
      ? "LIVE_CHAT_AUDIO"
      : filetype.startsWith("video")
      ? "LIVE_CHAT_VIDEO"
      : "LIVE_CHAT_FILE";

    const formData = new FormData();
    formData.append("file", audio, filename);
    formData.append("type", type);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        apikey: panelKey,
      },
    });

    const data = await response.json();
    return { ...data.data };
  } catch (error) {
    console.error("Error in uploading file: ", error);
  }
}

module.exports = { generateAIResponse, uploadFile };
