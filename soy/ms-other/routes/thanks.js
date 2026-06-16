var express = require("express");
var router = express.Router();

const accessControl = require("../middlewares/accessControl");
const roleControl = require("../middlewares/checkRole");
const ControllerThanks = require("../controller/ControllerThanks");
const connection = accessControl.checkConnection;
const role = roleControl.checkRole;
const debug = require('debug')('thanks')


// ========= API ========== Micro-services =====

router.get(
  "/API/thanks",
  connection,
  function (req, res) {
    ControllerThanks.getAll(req, res);
  }
);

router.get(
  "/API/user/:userId/thanks",
  connection,
  function(req, res) {
    ControllerThanks.getNbrOfThanks(req, res)
  }
)

router.post(
  "/API/thanks",
  connection,
  function(req, res) {
    ControllerThanks.create(req, res)
  }
)

module.exports = router;
