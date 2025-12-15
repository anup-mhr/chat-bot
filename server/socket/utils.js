// const { postQuery } = require("../services/message.service");
const ServerServices = require("../services/server.services");

// localdata
const localData = require("../localDataJson/localrundata");

// bots
const { messengerBot, instagramBot } = require("../bot/facebook.bot");
const whatsappBot = require("../bot/whatsapp.bot");
const viberBot = require("../bot/viber.bot");

const REDIS_KEY = `${process.env.ORGANIZATION_ID}:users`;
const { client } = require("../utils/redis");
// const telegramBot = require("../bot/telegram.bot");

const handledSetTimeout = (callback, timeout) => {
  setTimeout(async () => {
    try {
      await callback();
    } catch (error) {
      console.log("ERROR IN SET TIMEOUT => ", error);
    }
  }, timeout);
};

const sanitizeMessage = (message) => {
  const attachment = message.attachment;
  return {
    ...message,
    type: typeof message.type === "string" ? message.type : "invalidMessage",
    ...(attachment
      ? {
          attachment: {
            ...attachment,
            type:
              typeof attachment.type === "string" ? attachment.type : "unknown",
            payload:
              typeof attachment.payload === "string" ||
              typeof attachment.payload === "object"
                ? attachment.payload
                : "invalid attachment",
          },
        }
      : {}),
  };
};

const getUserData = async (userId, requesterRole = null) => {
  if (!userId || typeof userId !== "string") {
    return {};
  }
  const userData = await client.hget(REDIS_KEY, userId);
  let userDispId = userId.replaceAll("_", " ").toUpperCase();
  if (requesterRole) {
    userDispId = ["agent", "Agent"].includes(requesterRole)
      ? "Agent"
      : userId.replaceAll("_", " ").toUpperCase();
  }
  return {
    name:
      userData?.name ||
      (userData?.first_name || userData?.last_name
        ? `${userData?.first_name + " " || ""}${userData?.last_name || ""}`
        : userId.toString().replaceAll("_", " ").toUpperCase()),
    role: userData?.role,
    id: userData?.id,
    uniqueId: userId,
  };
};

//checking user exist in db
const saveUserInDashboard = async (id, branch_id) => {
  const url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/leads/senderId/${id}?branchId=${branch_id}`;
  const panelKey = process.env.CONTROL_PANEL_KEY;

  let headers = {
    "Content-Type": "application/json",
    apikey: panelKey,
  };
  ServerServices.getFromServer;

  let response = await ServerServices.getFromServer(url, headers);
  let data = await response.json();
  if (response.status === 200) {
    return {
      name: data.data.first_name,
      email: data.data.email,
      phone: data.data.phone,
      source: data.data.source_group,
    };
  } else {
    console.log("Error in fetching user from control panel");
    return {
      name: "",
      email: "",
      phone: "",
      source: "",
    };
  }
};

const flattenAttachmentPayload = (message) => {
  if (
    message.attachment &&
    typeof message.attachment === "object" &&
    message.attachment.payload
  ) {
    return {
      ...message,
      attachment: {
        ...message.attachment,
        payload:
          typeof message.attachment.payload === "object" &&
          message.attachment.payload.path
            ? message.attachment.payload.path
            : message.attachment.payload,
      },
    };
  }
  return message;
};

const sendOfflineMessage = async (message, metadata, source) => {
  console.log({ message, metadata, source }, "sendOfflineMessage called>>>");
  const bot = {
    fb: messengerBot,
    instagram: instagramBot,
    viber: viberBot,
    whatsapp: whatsappBot,
  }[source];
  if (
    !bot ||
    !bot.handleResponseMessageoffline ||
    typeof bot.handleResponseMessageoffline !== "function"
  ) {
    console.log(
      "Bot or handleResponseMessage function not found for source:",
      source
    );
    return null;
  }
  return bot.handleResponseMessageoffline(
    message,
    metadata,
    metadata.receipent
  );
};

const saveSessionInDashboard = async (data) => {
  // let url = `https://${process.env.DASHBOARD_SERVER}/${process.env.BASEPATH}/visitors/userId?userId=${id}&access_token=${process.env.ADMIN_TOKEN}`;
  const url = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}/${process.env.BASEPATH}/sessions/addBulkSession?access_token=${process.env.BOT_TOKEN}`;

  const headers = {
    "Content-Type": "application/json",
  };

  return ServerServices.postToServer(url, data, headers)
    .then(async (data) => {
      let dataJson = await data.json();
      console.log("SAVE SESSION IN DASHBOARD => ", dataJson);
      return data;
    })
    .catch((error) => {
      console.log("ERROR IN SAVE SESSION IN DASHBOARD => ", error);
    });
  // console.log(url, {data}, (await response.json()))
};

const bypassRasa = async function (socket, message, userID, metadata) {
  let emitted = true;

  if (message === "Get Started") {
    socket.emit("message:received", localData.menu);
  } else if (message === "test") {
    socket.emit("message:received", localData.loc_test);
  } else if (message === "/customer_rating") {
    return await localData["/customer_rating"](metadata.agentId);
  }
  // else if (message === "test") {
  //   socket.emit("message:received", localData.viewPremiumDue);
  // } else if (message === "test2") {
  //   socket.emit("message:received", localData.viewPremiumDue2);
  // }

  // else if (message === 'menu') {
  //   socket.emit('message_received', localData.hamburgerheader);
  // }

  // else if (message === 'Products') {
  //   socket.emit('message_received', localData.products);
  // }
  // else if (message === 'Money Back Plan') {
  //   socket.emit('message_received', localData.moneyBackPlan);
  // }
  // else if (message === 'Endowment Plan') {
  //   socket.emit('message_received', localData.endowmentPlan);
  // }
  // else if (message === 'Retirement Plan') {
  //   socket.emit('message_received', localData.retirementPlan);
  // }
  // else if (message === 'Term') {
  //   socket.emit('message_received', localData.term);
  // }
  // else if (message === 'Whole Life Plans') {
  //   socket.emit('message_received', localData.wholeLifePlan);
  // }
  // else if (message === "Woman's Plan") {
  //   socket.emit('message_received', localData.womanPlan);
  // }
  // else if (message === "Child's Plan") {
  //   socket.emit('message_received', localData.childPlan);
  // }

  // // Policy services

  // else if (message === 'Policy Services') {
  //   socket.emit('message_received', localData.policy);
  // }
  // else if (message === 'Due Policies') {
  //   socket.emit('message_received', localData.DuePolicy);
  // }
  // else if (message === 'Edit Profile') {
  //   socket.emit('message_received', localData.edit_profile_policy);
  // }
  // else if (message === 'View Detail') {
  //   socket.emit('message_received', localData.ViewDetails);
  // }
  // else if (message === 'Pay mode Change') {
  //   socket.emit('message_received', localData.PaymodeChange);
  // }
  // else if (message === 'Occupation') {
  //   socket.emit('message_received', localData.OccupationChange);
  // }
  // else if (message === 'Nominee') {
  //   socket.emit('message_received', localData.NomineeChange);
  // }
  // else if (message === 'Mobile Number') {
  //   socket.emit('message_received', localData.MobileNumberChange);
  // }
  // else if (message === 'Policy Revival') {
  //   socket.emit('message_received', localData.PolicyReviveRequest);
  // }
  // else if (message === 'Lapsed Policy') {
  //   socket.emit('message_received', localData.CheckLapsePolicy);
  // }
  // else if (message === 'Transaction History') {
  //   socket.emit('message_received', localData.TransactionHistory);
  // }
  // else if (message === 'Premium Calculation') {
  //   socket.emit('message_received', localData.premium_calculations);
  // }

  // //--------------------

  // else if (message === 'Branch') {
  //   socket.emit('message_received', localData.branch);
  // }

  // // Agency
  // else if (message === 'Agency') {
  //   socket.emit('message_received', localData.agency);
  // }
  // else if (message === 'Become Agent') {
  //   socket.emit('message_received', localData.be_agent);
  // }
  // else if (message === 'License Renewal') {
  //   socket.emit('message_received', localData.license);
  // }
  // else if (message === 'Edit Profiles') {
  //   socket.emit('message_received', localData.edit_profile_agency);
  // }
  // else if (message === 'View Details') {
  //   socket.emit('message_received', localData.view_detail_agency);
  // }
  // else if (message === 'Personal Details') {
  //   socket.emit('message_received', localData.ViewDetails);
  // }
  // else if (message === 'Commission Details') {
  //   socket.emit('message_received', localData.ViewDetails);
  // }
  // else if (message === 'Business Details') {
  //   socket.emit('message_received', localData.ViewDetails);
  // }
  // else if (message === 'PAN number') {
  //   socket.emit('message_received', localData.editPAN);
  // }
  // else if (message === 'Account number') {
  //   socket.emit('message_received', localData.editAccNumber);
  // }

  // // --------------

  // // Claim and Loan

  // else if (message === 'Claim & Loan') {
  //   socket.emit('message_received', localData.claim_loan);
  // }
  // else if (message === 'Claim Process') {
  //   socket.emit('message_received', localData.claim_process);
  // }
  // else if (message === 'Death Claim Process') {
  //   socket.emit('message_received', localData.death_process);
  // }
  // else if (message === 'Accidental Claim Process') {
  //   socket.emit('message_received', localData.accident_process);
  // }
  // else if (message === 'Documents Required for Claim') {
  //   socket.emit('message_received', localData.doc_claim);
  // }
  // else if (message === 'Death Claim Document') {
  //   socket.emit('message_received', localData.death_doc);
  // }
  // else if (message === 'Accidental Claim Document') {
  //   socket.emit('message_received', localData.accident_doc);
  // }
  // else if (message === 'File a Claim') {
  //   socket.emit('message_received', localData.file_claim);
  // }
  // else if (message === 'Claim settlement time') {
  //   socket.emit('message_received', localData.settlement_time);
  // }
  // else if (message === 'Contact Claim Department') {
  //   socket.emit('message_received', localData.contact_claim_department);
  // }

  // // -------------------

  // else if (message === 'Payment') {
  //   socket.emit('message_received', localData.payment);
  // }

  // else if (message === 'testDetail') {
  //   socket.emit('message_received', localData.detailDrawer);
  // }
  // else if (message === "test") {
  //   socket.emit("message:received", localData.viewPremiumDue);
  // }
  // else if (message === "iframe") {
  //   socket.emit("message_received", localData.iframeLoad);
  // } else if (message === "ignore-livechat") {
  //   socket.emit("message_received", "Livechat request cancelled");
  // }
  else {
    emitted = false;
  }

  return emitted;
};

module.exports = {
  saveUserInDashboard,
  saveSessionInDashboard,
  bypassRasa,
  sanitizeMessage,
  getUserData,
  handledSetTimeout,
  sendOfflineMessage,
  flattenAttachmentPayload,
};
