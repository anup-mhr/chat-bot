const { client } = require("./utils/redis");
const ServerServices = require("./server.services");
const FormData = require("form-data");
require("dotenv").config();
const fetch = require("node-fetch");
require("dotenv").config();
async function generateAIResponse(
  message,
  redisDetails,
  sender,
  source,
  userDetails,
  attachment
) {
  let redisKey;
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
    body.whatsapp_number = details.whatsappNumber;
  }
  if (source === "facebook") {
    body.pg_id = metadata.pg_id;
  }

  const headers = {
    "Content-Type": "application/json",
    "file-type": "txt",
    apiKey: process.env.OPENAI_KEY,
  };

  const response = await ServerServices.postToServer(openAi, body, headers);
  let responseData = await response.json();

  return responseData;
}

async function uploadFile(audio, filename, filetype) {
  try {
    const baseUrl = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api`;
    const panelKey = process.env.CONTROL_PANEL_KEY;

    if (!audio) throw new Error("audio is required");

    const typeMap = {
      image: "LIVE_CHAT_IMAGE",
      audio: "LIVE_CHAT_AUDIO",
      video: "LIVE_CHAT_VIDEO",
      default: "LIVE_CHAT_FILE",
    };

    const endpointMap = {
      image: "media/singleLivechat",
      audio: "files/audioUploadLivechat",
      video: "files/videoUploadLivechat",
      default: "files/pdfUploadLivechat",
    };

    const baseType = filetype.split("/")[0];
    const type = typeMap[baseType] || typeMap.default;
    const endpoint = endpointMap[baseType] || endpointMap.default;
    const url = `${baseUrl}/${endpoint}`;

    // Build FormData
    const formData = new FormData();
    formData.append(
      "file",
      audio,
      type === "LIVE_CHAT_IMAGE"
        ? { filename, contentType: filetype }
        : filename
    );
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
