const debug = require("debug")("ControllerStudentStatement");
const Model = require("../model/Model");
const ModelExercise = require("../model/ModelExercise");
const ModelPlageSession = require("../model/ModelPlageSession");
const ModelStudentStatement = require("../model/ModelStudentStatement");
const ModelSequence = require("../model/ModelSequence")
const ModelExerciseProduction = require("../model/ModelExerciseProduction")

module.exports.create = async function (req, res) {
  debug("Create a StudentStatement");
  let data;
  const session = await ModelPlageSession.read(req.params.businessSessionId)
  const ex = await ModelExercise.readById(req.params.exerciseId)
  if(!ex){
    res.status(404).json({message: "Could not find exercise for this session"})
    return;
  }
  if (req.params) {
    data = {
      ps_id: req.params.businessSessionId,
      user_id: req.params.userId,
      ex_id: req.params.exerciseId,
      availability_date: session.start_date,
      deadline_date: session.end_date,
      statement: ex.template_statement,// temporarily puts the template statement
      is_sended: false,
      file: ex.template_archive // temporarily puts the template archive file
    };
  } else {
    data = {
      ps_id: req.body.ps_id,
      user_id: req.body.user_id,
      ex_id: req.body.ex_id,
      availability_date: req.body.availability_date,
      deadline_date: req.body.deadline_date,
      statement: req.body.statement,
      is_sended: req.body.is_sended,
      file: req.body.file,
    };
  }

  debug("D availability_date = ",data.availability_date )

  let seqs = await ModelSequence.readWithJoin(session.seq_id)
  seqs = seqs.sort((a, b) => Number(a.rank) - Number(b.rank))

  const now = Date.now();
  const start = Date.parse(session.start_date)
  const end = Date.parse(session.end_date) + 86400000
  debug ("now,start,end="+now+" "+start+ " " +end)

  if(!(start <= now && now <= end)){
    debug('Outside of session [start , end] dates')
    if(start < now) 
      res.status(500).json({message: "Session is already over"})
    else res.status(500).json({message: "Session is not yet available"})
    return;
  }

  if(session.is_timed){
    debug('Case of a TIMED SESSION')
    // Do not allow creation if it's not the correct day
  
    let dist = now/86400000 - start/86400000
    let day = Math.floor(dist) + 1
    debug("Gap in #days of session = "+day)

    for(let i = 1 ; i < seqs.length ; i++){
      if(seqs[i].ex_id === ex.ex_id){
        debug("ok  "+ex.ex_id+" is "+i+"ieme exercise of the sequence, rank "+seqs[i].rank)
        debug(" day ="+day)
        if(seqs[i].rank === day){
          debug("ok day")
          debug(" availability_date <- ",data.availability_date )
        }else{
          res.status(500).json({message: "This is not the right day to do this exercise"})
          return;
        }
      }
    }
  }else{
    debug('Untimed session')
    // Test if the student got a good score in the previous exercise of the sequence
    for(let i = 1 ; i < seqs.length ; i++){
      if(seqs[i].ex_id === ex.ex_id){
        const eps = await ModelExerciseProduction.readStuExList(req.params.userId, seqs[i-1].ex_id)
        let max = 0;
        for(let j = 0 ; j < eps.length ; j++){
          if(Number(eps[j].score) > max ) max = Number(eps[j].score)
        }
        if(Number(seqs[i-1].min_rating) > max) {
          res.status(500).json({message: "Insufficient score on the previous exercise"});
          return;
        }
      }
    }
  }
  
  // Everything is fine -> we'll create the student statement
  await ModelStudentStatement.generateSudentStatement(data.ps_id, data.ex_id, data.user_id, async (persoStatement, persoArchive, err) => {
    if(err){
      res.status(500).json(err.toString())
      return;
    }
    else{
      debug("updating json object with html_statement and archive generated for this user")
      debug('Resulting archive file is called '+persoArchive.name)
      data.statement = persoStatement
      data.file = JSON.stringify(persoArchive)
      
      debug("Avail_date = "+data.availability_date)
      debug("deadline_date = "+data.deadline_date)

      data.created = new Date().toISOString();
      debug("Created initial date :"+new Date().toISOString())
      debug("Created toISOstring date is "+data.created)
      const studentStatement = new ModelStudentStatement(data);
      // Storing result into DB:
      const save = await studentStatement.save();
      if (save) {
        debug('New statement successfully saved into DB')
        const createdStudentStatement = await ModelStudentStatement.read(
          data.ps_id,
          data.user_id,
          data.ex_id
        );
        createdStudentStatement.file = JSON.parse(createdStudentStatement.file) // converting the file from DB (a String) into a JSON object
        res.status(201).json(createdStudentStatement);
      } else {
        res.status(500).end();
      }
    }
  })

};

module.exports.read = async function (req, res) {
  debug("Read a StudentStatement by ps_id, user_id and ex_id");
  const studentStatement = await ModelStudentStatement.read(
    req.params.businessSessionId,
    req.params.userId,
    req.params.exerciseId
  );
  if (studentStatement) {
    debug("read one student statement: SUCCESS");
    debug("statement for user "+studentStatement.user_id)
    studentStatement.file = JSON.parse(studentStatement.file)
    res.status(200).json(studentStatement);
  } else {
    debug("no stud statement found, creating one");
    //res.status(500).end();
    this.create(req, res)
  }
};

module.exports.update = async function (req, res) {
  debug("Update a StudentStatement");

  if (!req.body) {
    //Bad request
    res.status(400).end();
  } else {
    //Check if ids are right
    const studentStatement = await ModelStudentStatement.read(
      req.params.businessSessionId,
      req.params.userId,
      req.params.exerciseId
    );

    if (studentStatement) {
      const data = {
        ps_id: req.params.businessSessionId,
        user_id: req.params.userId,
        ex_id: req.params.exerciseId,
        availability_date: req.body.availability_date,
        deadline_date: req.body.deadline_date,
        is_sended: req.body.is_sended,
        statement: req.body.statement,
        file: req.body.file,
      };
      const studentStatementUpdated = new ModelStudentStatement(data);
      const success = await studentStatementUpdated.update();
      if (success) {
        //Get the new studentStatement
        const newStudentStatement = await ModelStudentStatement.read(
          req.params.businessSessionId,
          req.params.userId,
          req.params.exerciseId
        );
        //Return the new studentStatement
        res.status(200).json(newStudentStatement);
      } else {
        res.status(500).end();
      }
    } else {
      //Not found
      res.status(404).end();
    }
  }
};

module.exports.deleteOneStudentStatement = async (req, res) => {
  const ps_id = req.params.businessSessionId
  const ex_id = req.params.exerciseId
  const user_id = req.params.userId



  const productions = await ModelExerciseProduction.readStuExList(user_id, ex_id, ps_id)
  if(!productions) {res.status(500).json({message: "Error fetching productions"}); return}

  for(let i = 0; i < productions.length; i++){
    await ModelExerciseProduction.delete(productions[i].ep_id)
  }

  const studentStmts = await ModelStudentStatement.delete(ps_id, user_id, ex_id)
  if(!studentStmts) {
    res.status(200).json({message: "No student statement to delete"}); return
  }


  res.status(200).json({message: "Student statement was correctly deleted !"})
}