"use strict";
const debug = require( "debug" )( "ModelFeedback" );
const Model = require( "./Model" );
const ModelDB = require( "./ModelDB" );


class ModelFeedback extends Model {


  // Constructor
  constructor( data ) {
    super();
    this.user_id = data.user_id;
    this.ex_id = data.ex_id;
    this.level = data.level;
    this.theme = data.theme;
    this.beneficial = data.beneficial;
    this.comment = data.comment;

    this.dbName = ModelFeedback.dbName;
    this.keys = ModelFeedback.keys;
    this.locKey = ModelFeedback.locKey;
  }
  
  static async read( user_id, ex_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "user_id = $1 AND ex_id = $2;";
      const res = await client.query( sql, [ user_id, ex_id ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }


  static async readForUser( user_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "user_id = $1;";
      const res = await client.query( sql, [ user_id ] );
      debug( "read : SUCCESS" );
      return res.rows;
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readForExercise( ex_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "ex_id = $1;";
      const res = await client.query( sql, [ ex_id ] );
      debug( "read : SUCCESS" );
      return res.rows;
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readAVGForExercise( ex_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT AVG(level) FROM " + this.dbName + " WHERE " + "ex_id = $1;";
      const res = await client.query( sql, [ ex_id ] );
      debug( "read : SUCCESS" );
      return res.rows[0];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readCOUNTForExercise( ex_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT COUNT(*) FROM " + this.dbName + " WHERE " + "ex_id = $1;";
      const res = await client.query( sql, [ ex_id ] );
      debug( "read : SUCCESS" );
      return res.rows[0];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readAllWithStats() {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT e.ex_id, avg(f.level), COUNT(f.ex_id) FROM " + this.dbName + " f RIGHT OUTER JOIN exercise e ON f.ex_id = e.ex_id GROUP BY e.ex_id;";
      const res = await client.query( sql );
      debug( "read : SUCCESS" );
      return res.rows;
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  async update() {
    const client = ModelDB.connect_to_db()
    try {
      const sql = "UPDATE " + this.dbName + " SET level=$1, theme=$2, beneficial=$3, comment=$4 WHERE ex_id = $5 AND user_id = $6 RETURNING *;";
      const res = await client.query( sql , [this.level, this.theme, this.beneficial, this.comment, this.ex_id, this.user_id]);
      debug( "read : SUCCESS" );
      return res.rows[0];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }
 
 

}


ModelFeedback.dbName = "feedback";
ModelFeedback.keys = [
  [ "user_id", "int" ],
  [ "ex_id", "int" ],
  [ "level", "int" ],
  [ "theme", "int" ],
  [ "beneficial", "beneficial_type" ],
  [ "comment", "varchar" ],
];
ModelFeedback.locKey = undefined;

module.exports = ModelFeedback;
