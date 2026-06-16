'use strict';

const debug = require("debug")("ModelSequenceExercise");
const Model = require("./Model");
const ModelDB = require("./ModelDB");

class ModelSequenceExercise extends Model {
  // Constructor
  constructor(data) {
    super();
    this.seq_id = data.seq_id;
    this.ex_id = data.ex_id;
    this.rank = data.rank;
    this.min_rating = data.min_rating;

    // Reference to generic model global variable
    this.dbName = ModelSequenceExercise.dbName;
    this.keys = ModelSequenceExercise.keys;
    this.locKey = ModelSequenceExercise.locKey;
  }

  static async getAllExercises(seq_id) {
    debug("Get all exercise for a sequence list");
    const client = await ModelDB.connect_to_db();
    try {
      const sql =
        "SELECT se.seq_id, ex_id, min_rating, rank FROM sequence_exercises se, sequences s WHERE s.seq_id = se.seq_id AND se.seq_id=$1::int ORDER BY rank;";
      const tabEx = await client.query(sql, [seq_id]);
      debug("getAllExercices: SUCCESS");
      return tabEx.rows;
    } catch (err) {
      debug("getAllExercices: " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }

  static async delete(seq_id, ex_id){
    const client = ModelDB.connect_to_db();
    try{
      const sql = `DELETE FROM ${this.dbName} WHERE seq_id=$1::int AND ex_id=$2::int RETURNING *;`
      const query = await client.query(sql, [seq_id, ex_id])
      return query.rows
    }catch (err) {
      debug("delete: " + err.stack);
      return false;
    } finally {
      client.end()
    }
  }
}

ModelSequenceExercise.dbName = "sequence_exercises"; 
ModelSequenceExercise.keys = [
  ["seq_id", "int"], // Primary key first
  ["ex_id", "int"],
  ["rank", "int"],
  ["min_rating", "decimal(4,2)"],
];
ModelSequenceExercise.locKey = undefined;

module.exports = ModelSequenceExercise;
