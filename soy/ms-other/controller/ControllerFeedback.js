const debug = require("debug")("ControllerFeedback");
const ModelFeedback = require("../model/ModelFeedback");

module.exports.getAll = async (req, res) => {
  debug("get all feedbacks")
  const feedbacks = await ModelFeedback.readAll()
  if(feedbacks){
    res.status(200).json(feedbacks)
  }else{
    res.status(404).json({message: "Could not find any feedback"})
  }
}

module.exports.getAllWithStats = async (req, res) => {
  debug("get all with stats feedbacks")
  const feedbacks = await ModelFeedback.readAllWithStats()
  if(feedbacks){
    res.status(200).json(feedbacks)
  }else{
    res.status(404).json({message: "Could not find any feedback"})
  }
}

module.exports.getOneFeedback = async (req, res) => {
  debug("get one feedback")
  const feedback = await ModelFeedback.read(req.params.userId, req.params.exerciseId)
  if(feedback){
    res.status(200).json(feedback)
  }else{
    res.status(404).json({message: "Could not find feedback"})
  }
}

module.exports.getFeedbacksOfUser = async (req, res) => {
  debug("get feedbacks of user")
  const feedbacks = await ModelFeedback.readForUser(req.params.userId)
  if(feedbacks){
    res.status(200).json(feedbacks)
  }else{
    res.status(404).json({message: "Could not find feedbacks"})
  }
}

module.exports.getFeedbacksOfExercise = async (req, res) => {
  debug("get feedbacks of exercise")
  const feedbacks = await ModelFeedback.readForExercise(req.params.exerciseId)
  if(feedbacks){
    res.status(200).json(feedbacks)
  }else{
    res.status(404).json({message: "Could not find feedbacks"})
  }
}

module.exports.createFeedback = async (req, res) => {
  debug('create a feedback')
  let data = {
    user_id: req.body.user_id,
    ex_id: req.body.ex_id,
    level: req.body.level,
    theme: req.body.theme,
    beneficial: req.body.beneficial,
    comment: req.body.comment
  }

  const feedback = new ModelFeedback(data)
  const resp = await feedback.save()
  if(resp){
    res.status(201).json(data)
  }else{
    res.status(400).json({message: "could not create feedback"})
  }
}

module.exports.updateFeedback = async (req, res) => {
  debug('update a feedback')

  let data = {
    user_id: req.params.userId,
    ex_id: req.params.exerciseId,
    level: req.body.level,
    theme: req.body.theme,
    beneficial: req.body.beneficial,
    comment: req.body.comment
  }

  const exists = await ModelFeedback.read(req.params.userId, req.params.exerciseId)

  if(exists){

    const feedback = new ModelFeedback(data)
    const resp = await feedback.update()

    if(resp){
      res.status(201).json(data)
    }else{
      res.status(400).json({message: "could not update the feedback"})
    }
    

  }else{
    res.status(404).json({message: "could not find the feedback to update"})
  }

}

module.exports.getStatsOfExercise = async (req, res) => {
  debug('getting stats for exercise')
  const ex_id = req.params.exerciseId

  const avg = await ModelFeedback.readAVGForExercise(ex_id)
  const count = await ModelFeedback.readCOUNTForExercise(ex_id)

  if(avg && count){
    res.status(200).json({...avg, ...count})
  }
  else{
    res.status(500).json({message: "error getting stats"})
  }

}
