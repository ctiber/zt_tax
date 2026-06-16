"use strict";
const debug = require( "debug" )( "ModelLang" );
const Model = require( "./Model" );
const ModelDB = require( "./ModelDB" );


class ModelLang extends Model {


  // Constructor
  constructor( data ) {
    super();
    this.code = data.code;
    this.name = data.name;
    this.flag = data.flag;

    this.dbName = ModelLang.dbName;
    this.keys = ModelLang.keys;
    this.locKey = ModelLang.locKey;
  }
  
  static async read( code ) {
    const client = await ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + this.dbName + " WHERE " + "code = $1;";
      const res = await client.query( sql, [ code ] );
      debug( "read : SUCCESS" );
      return res.rows[ 0 ];
    } catch ( err ) {
      debug( "read : ERROR " + err.stack );
      return false;
    } finally {
      client.end();
    }
  }
 

}

ModelLang.dbName = "lang";
ModelLang.keys = [
  [ "code", "varchar" ],
  [ "name", "varchar" ],
  [ "flag", "bytea" ],
];
ModelLang.locKey = "code";

module.exports = ModelLang;
