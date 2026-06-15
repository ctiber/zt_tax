const debug = require("debug")("ControllerSequenceAPI");
const ModelSequence = require("../model/ModelSequence");
const ModelPlageSession = require("../model/ModelPlageSession");
const ModelExercise = require("../model/ModelExercise");
const ModelSequenceExercise = require("../model/ModelSequenceExercise");


module.exports.readAll = async function (req, res) {
  const sequences = await ModelSequence.getAllSequences();
  if (sequences) {
    let result = [];
    for (const [key, val] of sequences.entries()) {
      //There we receive a Map from the model, we need to make it an array
      let seq = {
        sequence_id: key.seq_id,
        exercises: [],
        description: key.description,
        profile_id: key.p_id,
      };

      val.forEach((ex) => {
        let seqExercise = {
          exercise_id: ex.ex_id,
          rank: ex.rank,
          min_rating: ex.min_rating,
        };
        seq.exercises.push(seqExercise);
      });
      result.push(seq);
    }
    result.sort((a, b) => {
      //Then sort the array by sequence id
      return a.sequence_id - b.sequence_id;
    });
    res.status(200).json(result); // if all went well, send back the json
  } else {
    res.status(500).end();
  }
};

/**
 *
 * Creates a sequence of exercises
 */
module.exports.create = async function (req, res) {
  debug("Create a sequence ");
  var exercises;
  //Pour les tests Postman (Json et non string)
  if (typeof req.body.exercises == "string") {
    exercises = JSON.parse(req.body.exercises);
  } else {
    exercises = req.body.exercises;
  }
  debug("Exos of sequence: " + JSON.stringify(exercises));
  // Creates the first exercise to obtain a sequence id
  let seqData = {
    seq_id: undefined,
    author_user_id: req.session.user_id,
    p_id: req.body.profile_id,
    description: req.body.description
  }
  let sequence = new ModelSequence(seqData);
  let idSeq = await sequence.save();
  debug("Put first exo in table and get new seq id=" + idSeq);

  if (!idSeq) {
    //The creation didn't succeed
    res.status(500).json({message: "Error in sequence creation"});
  }

  seqData.seq_id = idSeq

  let success = true; //Will be used to check if all the exercises have been saved

  // prepare info for other exos of the sequence, re-using the same sequence id
  exercises.forEach(async (exo) => {
    let data = {
      seq_id: idSeq, 
      ex_id: exo.exercise_id,
      rank: exo.rank,
      min_rating: exo.min_rating,
    };
    let sequence_exercise = new ModelSequenceExercise(data);
    idSeqEx = await sequence_exercise.save(); // put in table other exos
    if (!idSeqEx) {
      success = false;
    }
  });
  if (success) {
    res.status(201).json({ ...seqData, exercises: ModelSequenceExercise.getAllExercises(idSeq) });
  } else {
    res.status(500).end();
  }
};

module.exports.copySequence = async function (req, res) {
  debug("Copy a sequence ");
  try{
    const resp = await ModelSequence.copySequence(req.params.sequenceId, req.session.user_id, req.body.description, req.query.exercises === 'true')
    res.status(201).json(resp)
  }
  catch(err){
    res.status(500).json({message: err.detail})
  }
}

/**
 *
 * Retrieve one sequence, given its id
 */
module.exports.read = async function (req, res) {
  debug("API Get a sequence list");
  const seq = await ModelSequence.read(req.params.sequenceId);
  const exList = await ModelSequenceExercise.getAllExercises(seq.seq_id)
  if (exList[0]) { // if got some exercises (sequence exists)
    //Formating the result :
    let sequence = {
      sequence_id: seq.seq_id,
      exercises: [
        {
          exercise_id: exList[0].ex_id,
          rank: exList[0].rank,
          min_rating: exList[0].min_rating,
        },
      ],
      profile_id: seq.p_id,
      description: seq.description,
      author_user_id: seq.author_user_id
    };
    exList.shift(); //remove first element
    for (i = 0; i < exList.length; i++) {
      //Loop to fill all the remaining exercises
      sequence.exercises.push({
        exercise_id: exList[i].ex_id,
        rank: exList[i].rank,
        min_rating: exList[i].min_rating,
      });
    }
    res.status(200).json(sequence);
  } else {
    res.status(404).end();
  }
};

/**
 *
 * Update a sequence of exercises
 */
module.exports.update = async function (req, res) {
  debug("updated()");

  let sequence_id = req.params.sequenceId;

  debug("req.params.sequenceId=" + sequence_id);

  // get exercises indicated by user
  debug("Updating");
  var exercises;
  if (typeof req.body.exercises == "string") {
    exercises = JSON.parse(req.body.exercises);
  } else {
    exercises = req.body.exercises;
  }
  debug(exercises);

  // We start by deleting tuples corresponding to previous list (and ranks) of exercises.
  debug("Trying to delete rows concerning seq_id " + sequence_id);
  //TODO : Call the controller function instead ???
  //let done = await ModelSequence.delete(sequence_id);

  const oldSeq = await ModelSequence.read(sequence_id)

  

  
    let updatedSequence = {
      seq_id: sequence_id,
      author_user_id: oldSeq.author_user_id,
      p_id: req.body.profile_id,
      description: req.body.description,
    };
    
    const newSeq = new ModelSequence(updatedSequence)
    await newSeq.update()

    updatedSequence.exercises = []

    const seqExs = await ModelSequenceExercise.getAllExercises(sequence_id)
    for(let i = 0 ; i < seqExs.length ; i++){
      const seqEx = seqExs[i]
      await ModelSequenceExercise.delete(seqEx.seq_id, seqEx.ex_id)
    }

    let success = true;

    // Then prepare info for inserting exos of the sequence, re-using the same sequence id
    exercises.forEach(async (exo) => {
      if (parseInt(exo.rank) > 0) {
        // if exo with strictly positive rank (=> Data received from the req is OK)
        debug("exo " + exo.exercise_id + " is OK (rank " + exo.rank + ")");
        let data = {
          seq_id: sequence_id, // same seq id as coming with in function
          ex_id: exo.exercise_id,
          rank: exo.rank,
          min_rating: exo.min_rating,
        };

        //This is the data we want to send back as response to the request
        //This is not part of the business logic
        updatedSequence.exercises.push({
          exercise_id: data.ex_id,
          rank: data.rank,
          min_rating: data.min_rating,
        });

        let sequenceEx = new ModelSequenceExercise(data);
        done = await sequenceEx.save(); // put in table other exos
        if (!done) {
          success = false;
        }
      } else {
        //Wrong parameters (=> Data received from req is NOT OK)
        debug("exo " + exo.exercise_id + " NOT OK(rank " + exo.rank + ")");
        res.status(400).end();
        return;
      }
    });
    if (success) {
      res.status(200).json(updatedSequence);
    }
  //}
};


module.exports.delete = async function (req, res) {
  debug("Asked to delete a sequence");
  const user = req.session;

  
  const seqExs = await ModelSequenceExercise.getAllExercises(req.params.sequenceId)
  for(let i = 0 ; i < seqExs.length ; i++){
    const seqEx = seqExs[i]
    await ModelSequenceExercise.delete(seqEx.seq_id, seqEx.ex_id)
  }
  const success = await ModelSequence.delete(req.params.sequenceId);
  if (success) {
    res.status(200).end();
  } else {
    res.status(404).end({message: "Could not delete sequence"});
  }
 
};


module.exports.readAllSequenceExercises = async function (req, res) {
  const sequenceData = await ModelSequence.read(req.params.sequenceId);
  if (sequenceData) {
    let exercises = [];
    for (i = 0; i < sequenceData.length; i++) {
      let ex = await ModelExercise.readById(sequenceData[i].ex_id);
      let exercise = new ModelExercise(ex);
      let id = exercises.push(exercise);
    }
    res.status(200).json(exercises);
  } else {
    //Sequence not found
    res.status(404).end();
  }
};
