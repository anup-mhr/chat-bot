var express = require("express");
var router = express.Router();
const fetch = require("node-fetch");
const keys = process.env;
const baseUrl = `${keys.DASHBOARD_PROTOCOL}://${keys.DASHBOARD_SERVER}:${keys.DASHBOARD_PORT}`;
const catchAsync = require("../utils/catchAsync");

/* GET users listing. */

router.get("/post", function (req, res) {
  let url = `${baseUrl}/${keys.BASEPATH}/Users/liveChat`;
  // console.log("error");
  let responseHeader = {};
  fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.authorization,
    },
  })
    .then((data) => {
      responseHeader.statusCode = data.status;
      responseHeader.status = data.ok;
      responseHeader.text = data.statusText;
      return data.json();
    })
    .then((data) => {
      // console.log("response data", data);
      res.status(responseHeader.statusCode).json({
        header: responseHeader,
        data: data,
      });
    })
    .catch((err) => {
      res.status(responseHeader.statusCode || 500).json({
        header: responseHeader,
        error: err,
      });
    });
});

router.patch(
  "/:id",
  catchAsync(async function (req, res) {
    // const url = `${baseUrl}/${keys.BASEPATH}/Users/${req.params.id}`;
    // const response = await fetch(url, {
    //   method: "PATCH",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: req.headers.authorization,
    //   },
    //   body: JSON.stringify(req.body),
    // });
    // const data = await response.json();
    // console.log(data)
    res.status(200).send({
      active: true,
      firstname: "Roshan",
      lastname: "Dangol",
      availability: true,
      login_failed_attempt: 0,
      locked: false,
      archive: false,
      loginCount: 118,
      lastLogin: "2025-08-26T10:59:08.583Z",
      liveChatLoginCount: 115,
      username: "roshan@gmail.com",
      email: "roshan@gmail.com",
      id: "68ad494a5e4af4c82438e669",
      createdDate: "2025-08-24T04:02:03.961Z",
      updatedDate: "2025-08-27T03:24:35.575Z",
      createdBy: "6858ce31ae4b17e12d61b976",
      updatedBy: "68ad494a5e4af4c82438e669",
      organizationId: "68a3ef87f687afab583e5f67",
      role: "admin",
    });
  })
);

router.get(
  "/:token",
  catchAsync(async function (req, res) {
    // const url = `${baseUrl}/${keys.BASEPATH}/Users/${req.params.id}`;

    const url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/client-teams/live-chat`;
    const panelKey = process.env.CONTROL_PANEL_KEY;

    let headers = {
      "Content-Type": "application/json",
      apikey: panelKey,
      authorization: `Bearer ${req.params.token}`,
    };

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    });
    const data = await response.json();
    res.status(response.status).send({ ...data.data });
  })
);

//
module.exports = router;
