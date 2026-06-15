var express = require("express");
var router = express.Router();

const accessControl = require("../middlewares/accessControl");
const roleControl = require("../middlewares/checkRole");
const ControllerLang = require("../controller/ControllerLang");
const { nextTick } = require("async");
const connection = accessControl.checkConnection;
const role = roleControl.checkRole;
const debug = require('debug')('lang')


// ========= API ========== Micro-services =====

router.get(
  "/API/langs",
  function (req, res) {
    ControllerLang.getLangs(req, res);
  }
);

router.get(
  "/API/lang/:langCode",
  function (req, res) {
    ControllerLang.getOneLang(req, res);
  }
);

module.exports = router;
