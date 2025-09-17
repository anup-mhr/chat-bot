const express = require("express");
const router = express.Router();
const fileController = require("../controller/chatHistory");

router.get("/file", fileController.getFile);

module.exports = router;
