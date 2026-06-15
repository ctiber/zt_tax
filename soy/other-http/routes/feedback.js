var express = require("express");
var router = express.Router();

const accessControl = require("../middlewares/accessControl");
const roleControl = require("../middlewares/checkRole");
const ControllerFeedback = require("../controller/ControllerFeedback");
const connection = accessControl.checkConnection;
const role = roleControl.checkRole;
const debug = require('debug')('feedback')


// ========= API ========== Micro-services =====

router.get(
  "/API/feedbacks",
  connection,
  function (req, res) {
    ControllerFeedback.getAll(req, res);
  }
);

router.get(
  "/API/feedbacks/stats",
  connection,
  function (req, res) {
    ControllerFeedback.getAllWithStats(req, res);
  }
);

router.get(
  "/API/feedbacks/user/:userId",
  connection,
  function (req, res) {
    ControllerFeedback.getFeedbacksOfUser(req, res);
  }
);

router.get(
  "/API/feedbacks/exercise/:exerciseId",
  connection,
  function (req, res) {
    ControllerFeedback.getFeedbacksOfExercise(req, res);
  }
);

router.get(
  "/API/feedback/user/:userId/exercise/:exerciseId",
  connection,
  function (req, res) {
    ControllerFeedback.getOneFeedback(req, res);
  }
);

router.post(
  "/API/feedback",
  connection,
  function (req, res) {
    ControllerFeedback.createFeedback(req, res)
  }
)

router.put(
  "/API/feedback/user/:userId/exercise/:exerciseId",
  connection,
  function (req, res) {
    ControllerFeedback.updateFeedback(req, res)
  }
)

router.get(
  "/API/feedback/exercise/:exerciseId/stats",
  connection,
  function (req, res) {
    ControllerFeedback.getStatsOfExercise(req, res)
  }
)

module.exports = router;
