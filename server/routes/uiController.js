var express = require("express");
var router = express.Router();
const uiController = require("../controller/uiController");

router.get("/getOrganizationUi", uiController.getOrgUi);
router.get("/getBranch", uiController.getBranch);
router.get("/checkPlatformSettings", uiController.getPlatformSettings);

module.exports = router;
