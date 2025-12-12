var express = require("express");
var router = express.Router();
const fetch = require("node-fetch");
const { client } = require("../utils/redis");

const baseUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}`;
const baseUrlHttps = process.env.BASEPATH_HTTPS;
/* GET users listing. */

const defaultSources = [
  {
    value: "web",
    name: "Web",
  },
  {
    value: "fb",
    name: "Facebook",
  },
  {
    value: "whatsapp",
    name: "Whatsapp",
  },
  {
    value: "instagram",
    name: "Instagram",
  },
  {
    value: "viber",
    name: "Viber",
  },
  {
    value: "telegram",
    name: "Telegram",
    icon: "https://cdn.pixabay.com/photo/2020/10/17/13/21/telegram-5662082_1280.png",
  },
];

router.get("/", async function (req, res) {
  // let url = `${baseUrl}/${process.env.BASEPATH}/settings/authUser`;
  // // console.log("error");
  // let responseHeader = {};
  // fetch(url, {
  //   method: "GET",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: req.headers.authorization,
  //   },
  // })
  //   .then((data) => {
  //     // console.log(data, "data while getting organization");
  //     responseHeader.statusCode = data.status;
  //     responseHeader.status = data.ok;
  //     responseHeader.text = data.statusText;
  //     return data.json();
  //   })
  //   .then((data) => {
  // console.log("Getting organization data", data);
  let Baseurl = process.env.CONTROL_PANEL_URL;

  let organization = req.query.org_id;
  let branch = req.query.branch_id?.split(",")[0].trim() || null;
  let region = req.query.region || null;
  const redisKey = `ClientDetails:${organization}`;

  let clientDetails = await client.hget(redisKey, "clientDetails");
  if (!clientDetails || Object.keys(clientDetails).length === 0) {
    let url = `${process.env.CONTROL_PANEL_PROTOCOL}://${Baseurl}/api/bot/get-bot/${organization}${
      branch ? (branch !== "all" ? `?branch=${branch}` : "") : `?region=${region}`
    }`;
    let response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.CONTROL_PANEL_KEY,
      },
    });
    let result = await response.json();
    clientDetails = result?.data?.client;
    await client.hset(redisKey, "clientDetails", result?.data?.client, 7200);
  }

  res.status(200).json({
    data: {
      name: clientDetails?.name || "Palm Mind",
      location: clientDetails?.address || "Pulchowk, Lalitpur",
      availability: false,
      logo: clientDetails?.bot_Logo,
      sources: [
        { value: "web", name: `Web` },
        // { value: "web-elex", name: `${llmDetails.organization_name} Electronics` },
        { value: "fb", name: "Facebook" },
        { value: "whatsapp", name: "Whatsapp" },
        { value: "instagram", name: "Instagram" },
        { value: "viber", name: "Viber" },
        {
          value: "telegram",
          name: "Telegram",
          icon: "https://cdn.pixabay.com/photo/2020/10/17/13/21/telegram-5662082_1280.png",
        },
      ],
    },
  });
  // })
  // .catch((err) => {
  //   // console.log("ERRRORRRR!!!!!!!")
  //   res.status(400).json({
  //     header: responseHeader,
  //     error: err,
  //   });
  // });
});

module.exports = router;
