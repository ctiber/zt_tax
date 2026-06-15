"use strict";
const debug = require("debug")("ModelSequence");
const Model = require("./Model");
const ModelSequenceExercise = require("./ModelSequenceExercise");
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
        Object.assign({}, { seq_id: item.seq_id, description: item.description, p_id: item.p_id }),
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
