const debug = require("debug")("ControllerThanks");
const ModelThanks = require("../model/ModelThanks");

module.exports.getAll = async (req, res) => {
  debug("get all thanks")
  const thanks = await ModelThanks.readAll()
  if(thanks){
    res.status(200).json(thanks)
  }else{
    res.status(404).json({message: "Could not find any thank"})
  }
}

module.exports.create = async (req, res) => {
  debug("saving thank")
  let data = {
    thanking_user_id: req.session.user_id,
    thanked_users_id: req.body.users,
    ex_id: req.body.ex_id,
    ps_id: req.body.ps_id,
    timestamp: new Date(Date.now())
  }
  const resp = await ModelThanks.saveMultiple(data)
  if(resp !== false){
    res.status(201).json({count: resp})
  }else{
    res.status(500).json({message: "Could not create thank"})
  }
}

module.exports.getNbrOfThanks = async (req, res) => {
  debug("couting thanks...")
  const thanks = await ModelThanks.countNbrThanked(req.params.userId)
  if(thanks){
    res.status(200).json(thanks)
  }else{
    res.status(500).json({message: "Server error counting thanks"})
  }
}