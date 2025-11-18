const express = require("express");
const {
  userLeadsController,
  getUserLeads,
} = require("../controller/userDetail");

const router = express.Router();

router.post("/userLeads", userLeadsController);
router.get("/userLeads", getUserLeads);

module.exports = router;
