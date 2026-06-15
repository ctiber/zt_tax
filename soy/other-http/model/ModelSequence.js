"use strict";
const debug = require("debug")("ModelSequence");
const Model = require("./Model");
const ModelSequenceExercise = require("./ModelSequenceExercise");
const ModelPlageSession = require("./ModelPlageSession")
const ModelPlageUser = require('./ModelPlageUser')
const ModelDB = require("./ModelDB");

class ModelSequence extends Model {
  // Constructor
  constructor(data) {
    super();
    this.seq_id = data.seq_id;
    this.author_user_id = data.author_user_id;
    this.p_id = data.p_id;
    this.description = data.description;

    // Reference to generic model global variable
    this.dbName = ModelSequence.dbName;
    this.keys = ModelSequence.keys;
    this.locKey = ModelSequence.locKey;
  }


  /**
   * Executes sql requests for updating the sequence
   * @param {Client} client client for accessing the database
   * @param {any[]} exercises optional array of exercises. If specified, exercises of the sequence will be updated to those exercises
   */
  async updateBis(){
    // 1 argument = only sequence modified
    debug("executing with "+ arguments.length+" arguments")
    if(arguments.length === 1 && typeof arguments[0] === "object"){
      const client = arguments[0]
      
      const sql = `UPDATE ${this.dbName} SET author_user_id = $1, p_id = $2, description = $3 WHERE seq_id = $4`
      let response = await client.query(sql, [this.author_user_id, this.p_id, this.description, this.seq_id])
      return response.rowCount === 1;
    }
    // 2 arguments = exercises modified too
    else if(arguments.length === 2 && typeof arguments[0] === "object" && Array.isArray(arguments[1])){
      const client = arguments[0]
      const exercises = arguments[1] // {exercise_id, rank, min_rating}

      const sessionLinked = await ModelPlageSession.readBySeq(this.seq_id)
      let usedInSession = sessionLinked !== undefined
      debug("used in session : "+usedInSession)
      let sessionStarted = usedInSession ? new Date(sessionLinked.start_date).getTime() < Date.now() : undefined
      let sessionEnded = usedInSession ? new Date(sessionLinked.end_date).getTime() < Date.now() : undefined

      // Update sequence first
      debug("updating sequence first")
      if(!(await this.updateBis(client))){ throw new Error("error trying to update the sequence")}

      // Update exercises
      const exercisesInDb = await ModelSequenceExercise.getAllExercises(this.seq_id)
      if(!exercisesInDb) throw new Error("error trying to read exercises in sequence")

      debug("starting comparing")
      for(let i = 0; i < exercisesInDb.length ; i++){
        const foundExIndex = exercises.findIndex( (ex) => ex.exercise_id === exercisesInDb[i].ex_id)
        if(foundExIndex !== -1){ // We update
          if(exercisesInDb[i].rank !== exercises[foundExIndex].rank && ( usedInSession && sessionStarted)) throw new Error("Impossible to modify the rank of the exercise because session has already started")

          if(  (usedInSession && !sessionEnded) &&  (Number(exercisesInDb[i].min_rating) < Number(exercises[foundExIndex].min_rating) )) throw new Error("Impossible to modify the min_rating higher than the old value or the session has ended")

          let data = {
            seq_id: exercisesInDb[i].seq_id,
            ex_id: exercisesInDb[i].ex_id,
            rank: exercises[foundExIndex].rank,
            min_rating: exercises[foundExIndex].min_rating,
          };

          let seqEx = new ModelSequenceExercise(data)
          const resp = await seqEx.update()
          if(!resp) throw new Error("error trying to update a sequence_exercise")

          exercises.splice(foundExIndex, 1) // we delete from array to say its treated
        }else{ // Did not found so it was deleted
          if(usedInSession && sessionStarted) throw new Error("Impossible to delete an exercise because session has already started")
          //const resp = await ModelSequenceExercise.delete(exercisesInDb[i].seq_id, exercisesInDb[i].ex_id)
          if(!resp) throw new Error("error trying to delete a sequence_exercise")

        }

      }

      if(exercises.length > 0) debug("adding new exercises")
      for(let i = 0; i < exercises.length ; i++){
        // If we have anything, then its new we add it
        if(usedInSession && sessionStarted) throw new Error("Impossible to add an exercise because session has already started")

        let data = {
          seq_id: this.seq_id,
          ex_id: exercises[i].exercise_id,
          rank: exercises[i].rank,
          min_rating: exercises[i].min_rating,
        };
        let seqEx = new ModelSequenceExercise(data)
        const resp = await seqEx.save()
        if(!resp) throw new Error("error trying to save a new sequence_exercise")

      }

    }
    else{
      throw new Error("arguments error in updateBis")
    }

    return true
  }

  /**
   * Updates a sequence
   * @param {any[]} exercises optional array of exercises. If specified, exercises of the sequence will be updated to those exercises
   * @returns `true` if transaction success, `false` otherwise
   */
  async update(){
    debug("updating sequence")
    const client = ModelDB.connect_to_db();
    try{
      await client.query('BEGIN')

      if(arguments.length === 0){ // Update only sequence
        await this.updateBis(client)
      }
      else if(arguments.length === 1 && Array.isArray(arguments[0])){ // Update sequence and its exercises
        const exercises = arguments[0]
        await this.updateBis(client, exercises)
      }else{
        throw new Error("arguments error in update")
      }

      debug("committing transaction")
      await client.query('COMMIT')

      return {
        success: true,
        message: undefined
      };
    }
    catch(err){
      debug('error trying to update a sequence :' +err)
      debug('rollbacking transaction')
      await client.query('ROLLBACK')
      return {
        success: false,
        message: err.message
      };
    }
    finally{
      client.end()
    }

  }


  static async read(seq_id) {
    debug("Get the sequence with the id "+seq_id);
    const client = await ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + ModelSequence.dbName + " WHERE seq_id=$1::int;";
      const tabEx = await client.query(sql, [seq_id]);
      debug("read sequence : got answer from db");
      //debug(tabEx);
      if (tabEx.rowCount == 0) {
        debug("non existing of empty sequence");
        return null
      }
      else {return tabEx.rows[0]; }
    } catch (err) {
      debug("read sequence : " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }

  static async readWithJoin(seq_id){
    debug("Get the sequence with the id "+seq_id);
    const client = await ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + ModelSequence.dbName + " s, sequence_exercises se WHERE s.seq_id=$1::int AND se.seq_id = s.seq_id;";
      const tabEx = await client.query(sql, [seq_id]);
      debug("read sequence : got answer from db");
      //debug(tabEx);
      if (tabEx.rowCount == 0) {
        debug("non existing of empty sequence");
        return null
      }
      else {return tabEx.rows; }
    } catch (err) {
      debug("read sequence : " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }



  static async getAllSequences() {
    let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    debug("Get all sequence");
    const ids = await this.getAllSequencesId();
    let tabSeq = new Map();
    let cpt = 0;
    ids.forEach(async (item, index, array) => {
      call(item, ModelSequenceExercise.getAllExercises, tabSeq);
    });

    while (cpt !== ids.size) {
      await sleep(500);
      return tabSeq;
    }

    async function call(item, getAllExercises, tabSeq) {
      let seq = await getAllExercises(item.seq_id).catch((err) => console.log(err));
      tabSeq.set(
        Object.assign({}, { seq_id: item.seq_id, author: item.author_user_id , description: item.description, p_id: item.p_id }),
        seq
      );
      cpt++;
      if (cpt === ids.length) {
        return tabSeq;
      }
    }
  }

  static async getAllSequencesId() {
    debug("Get all sequence Ids");
    const client = await ModelDB.connect_to_db();
    try {
      const sql =
        "SELECT DISTINCT seq_id, description, author_user_id, p_id FROM " + ModelSequence.dbName + " ORDER BY seq_id;";
      const tabEx = await client.query(sql, []);
      debug("getAllSequenceId: SUCCESS");
      return tabEx.rows;
    } catch (err) {
      debug("getAllSequenceId: " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }

  static async copySequence(sequenceId, newAuthorId, newSequenceDescription, doCopyExercises){
    const client = ModelDB.connect_to_db()
    try{
      await client.query('BEGIN')
      let response = {}
      const seq = await client.query(`SELECT * FROM sequences WHERE seq_id = $1::int`, [sequenceId])
      const seqExs = await client.query('SELECT * FROM sequence_exercises WHERE seq_id = $1::int', [sequenceId])
      // copy seq
      const copySeq = await client.query('INSERT INTO sequences(description, author_user_id, p_id) VALUES ($1, $2::int, $3::int) RETURNING *', [newSequenceDescription, newAuthorId, seq.rows[0].p_id])

      response = {...copySeq.rows[0]}
      const resp = await ModelPlageUser.read(response.author_user_id)
      delete response.author_user_id
      response.author = {user_id: resp.user_id, firstname: resp.firstname, lastname: resp.lastname}
      response.exercises = []
      response.sequence_id = response.seq_id
      for(let i = 0 ; i < seqExs.rows.length ; i++){
        const seqEx = seqExs.rows[i]
        let copyExRes
        if(doCopyExercises){
          const exRes = await client.query(`SELECT * FROM exercise WHERE ex_id = $1::int`, [seqEx.ex_id])
          const ex = exRes.rows[0]
          // copy ex
          copyExRes = await client.query('INSERT INTO exercise (template_statement, template_archive, state, author, name, statement_creation_script, marking_script, locale, ref_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *'
          , [ex.template_statement, ex.template_archive, ex.state, newAuthorId, ex.name+"_"+Math.floor(Math.random()*16777215).toString(16), ex.statement_creation_script, ex.marking_script, ex.locale, ex.ref_id]) 
        }
        
        // copy seqEx
        const copySeqEx = await client.query('INSERT INTO sequence_exercises (seq_id, ex_id, rank, min_rating) VALUES ($1::int,$2::int,$3,$4)'
        , [copySeq.rows[0].seq_id, copyExRes ? copyExRes.rows[0].ex_id : seqEx.ex_id, seqEx.rank, seqEx.min_rating])

        response.exercises.push(copySeqEx.rows[0])
      }


      await client.query('COMMIT')

      return response
    }
    catch(e){
      await client.query('ROLLBACK')
      throw e
    }
    finally{
      client.end()
    }
  }
}

ModelSequence.dbName = "sequences"; //Sequence
ModelSequence.keys = [
  ["seq_id", "int"], // Primary key first
  ["author_user_id", "int"],
  ["p_id", "int"],
  ["description", "text"],
];
ModelSequence.locKey = undefined;

module.exports = ModelSequence;
