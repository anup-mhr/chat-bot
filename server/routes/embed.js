const express = require("express");
const router = express.Router();
const embedController = require("../controller/embed");

router.get("/", embedController.embedScripted);

module.exports = router;
