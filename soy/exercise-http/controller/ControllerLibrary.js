const debug = require("debug")("ControllerLibrary");


module.exports.getPlageLibPy = async function (req, res) {
  debug("Sending PlageLib.py");
  const path = __dirname + "/../lib/Python/plageLib.py";
  res.download(path);
};
