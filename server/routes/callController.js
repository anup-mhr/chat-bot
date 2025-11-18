const express = require("express");
const router = express.Router();
const callController = require("../controller/callController");

router.get("/getInitialSettings", callController.getCallSettings);
router.post("/forFinalSettings", callController.finalCallSettings);
router.post("/getPrompt", callController.promptGetters);

module.exports = router;
