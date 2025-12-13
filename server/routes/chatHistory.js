const express = require("express");
const router = express.Router();
const authController = require("../controller/chatAuthController");
const visitorController = require("../controller/visitorController");
const messageController = require("../controller/messageController");
const fileController = require("../controller/fileController");
const catchAsync = require("../utils/catchAsync");

router.post("/login", authController.login);
router.get("/visitors", visitorController.getVisitors);
router.get("/messages", messageController.getMessages);
router.get("/whatsappFile/:mediaId", fileController.getWhatsappFile);
router.get("/file", fileController.getFile);
router.get("/messageByMid", messageController.getMessageByMid);
router.get("/visitors/count", visitorController.getVisitorCount);
router.get("/visitor/conversation", messageController.getMessagesWithVisitors);

router.post(
  "/error",
  catchAsync(async (req, res) => {
    const { title, username } = req.body;

    res.status(200).send({});
  })
);

module.exports = router;
