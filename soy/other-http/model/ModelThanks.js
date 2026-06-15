"use strict";
const debug = require( "debug" )( "ModelThanks" );
const Model = require( "./Model" );
const ModelDB = require( "./ModelDB" );


class ModelThanks extends Model {


  // Constructor
  constructor( data ) {
    super();
    this.thanking_user_id = data.thanking_user_id;
    this.thanked_user_id = data.thanked_user_id;
    this.ex_id = data.ex_id;
    this.ps_id = data.ps_id;
    this.timestamp = data.timestamp;
    this.comment = data.comment;

    this.dbName = ModelThanks.dbName;
    this.keys = ModelThanks.keys;
    this.locKey = ModelThanks.locKey;
  }
  
  static async read( thanking_user_id, thanked_user_id, ex_id, ps_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "thanking_user_id = $1 AND thanked_user_id = $2 AND ex_id = $3 AND ps_id = $4;";
      const res = await client.query( sql, [ thanking_user_id, thanked_user_id, ex_id, ps_id ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readThanks( thanking_user_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "thanking_user_id = $1;";
      const res = await client.query( sql, [ thanking_user_id ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readThanksInSession( thanking_user_id, ps_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "thanking_user_id = $1 AND ps_id = $2;";
      const res = await client.query( sql, [ thanking_user_id, ps_id ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async readThanksInSessionForExercise( thanking_user_id, ps_id, ex_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "thanking_user_id = $1 AND ex_id = $2 AND ps_id = $3;";
      const res = await client.query( sql, [ thanking_user_id, ex_id, ps_id ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async countNbrThanked( thanked_user_id ) {
    const client = ModelDB.connect_to_db();
    try {
      const sql = "SELECT count(*) FROM " + this.dbName + " WHERE " + "thanked_user_id = $1;";
      const res = await client.query( sql, [ thanked_user_id ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }

  static async saveMultiple( data ) {
    const client = ModelDB.connect_to_db()
    try{
      await client.query('BEGIN')
      let count = 0;
      for(let i = 0; i < data.thanked_users_id.length ; i++){
        if(data.thanked_users_id[i] !== data.thanking_user_id){
          const sql = "INSERT INTO thanks(thanking_user_id, thanked_user_id, ex_id, ps_id, timestamp) VALUES($1,$2,$3,$4,$5)"
          try{
            const res = await client.query(sql, [ data.thanking_user_id, data.thanked_users_id[i], data.ex_id, data.ps_id, data.timestamp ])
            count++;
          }catch(e){
            if(e.constraint !== "thanks_pkey") throw e
          }
        }

      }

      await client.query('COMMIT')
      return count
    }catch(err){
      await client.query('ROLLBACK')
      debug("could not save multiple, cancelling" + err.stack)
      return false;
    }finally{
      client.end()
    }
  }

}


ModelThanks.dbName = "thanks";
ModelThanks.keys = [
  [ "thanking_user_id", "int" ],
  [ "thanked_user_id", "int" ],
  [ "ex_id", "int" ],
  [ "ps_id", "int" ],
  [ "timestamp", "timestamptz" ],
];
ModelThanks.locKey = undefined;

module.exports = ModelThanks;
