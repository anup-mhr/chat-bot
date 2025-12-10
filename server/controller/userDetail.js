const { newPostToServer, getFromServer } = require("../server.services");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { successResponse } = require("../utils/successResponse");

require("dotenv").config();
exports.userLeadsController = catchAsync(async function (req, res, next) {
  const url = `${process.env.CONTROL_PANEL_URL}/api/leads?branchId=${req.body.llmfields.branch_id}`;
  const panelKey = process.env.CONTROL_PANEL_KEY;

  console.log("request body and query in userlead", req.body);

  leads = {
    sender: req.body.visitorId,
    first_name: req.body.fullname,
    last_name: "",
    phone: "",
    source_group: req.body.source,
    email: req.body.email,
    organization_id: req.body.llmfields.org_id,
    interest: "userLeads",
    description: "userLeads",
    type: "userInterest",
  };

  let headers = {
    "Content-Type": "application/json",
    apikey: panelKey,
  };

  let response = await newPostToServer(url, leads, headers);
  let data = await response;
  console.log(data, "response dat");
  let type = "Your Leads has been submitted successfully.";
  let messageJSON = {
    botName: "Palm-bot",
  };
  if (response.status === 200 || response.success) {
    messageJSON.title = "Leads submitted successfully";

    return successResponse(res, data.data, type, "success", 200);
  } else {
    messageJSON.title = "Problme in submitting Leads";
    return next(new AppError("Something went wrong", 400));
  }
});

exports.getUserLeads = catchAsync(async function (req, res, next) {
  const url = `${process.env.CONTROL_PANEL_URL}/api/leads/senderId/${req.query.sender_id}?branchId=${req.query.branchId}`;
  const panelKey = process.env.CONTROL_PANEL_KEY;

  let headers = {
    "Content-Type": "application/json",
    apikey: panelKey,
  };

  console.log(url, "url backend of getUserLeads");

  let response = await getFromServer(url, headers);
  let data = await response.json();

  console.log(data.data, "response dat");

  if (!data || data.success === false) {
    return res.json({
      success: false,
      message: data?.message || "Something went wrong",
      status: 400,
    });
  }

  return successResponse(
    res,
    data.data,
    "Your Leads has been obtained successfully.",
    "success",
    200
  );
});
