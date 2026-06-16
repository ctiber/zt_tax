"use strict";
const axios = require("axios");
//const ConfServ = require("../config/ConfServ");
const fs = require("fs");
const Model = require("./Model");
const debug = require("debug")("ModelExerciseProduction");
const ModelDB = require("./ModelDB");
const PythonShell = require("python-shell");
const ModelStudentStatement = require("../model/ModelStudentStatement");
const ControllerExerciseAPI = require('../controller/ControllerExerciseAPI')

class ModelExerciseProduction extends Model {
  // Constructeur
  constructor(data) {
    super();
    this.ep_id = data.ep_id;
    this.ex_id = data.ex_id;
    this.user_id = data.user_id;
    this.comment = data.comment;
    this.score = data.score;
    this.processing_log = data.processing_log;
    this.working_time = data.working_time;
    this.production_data = data.production_data;
    //this.submission_date = data.submission_date;
    this.ps_id = data.ps_id;

    this.dbName = ModelExerciseProduction.dbName;
    this.keys = ModelExerciseProduction.keys;
    this.locKey = ModelExerciseProduction.locKey;
  }

  static async readExeList(ex_id, ps_id) {
    debug("Read all ExerciseProduction for an exercise");
    const client = await ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + ModelExerciseProduction.dbName + " WHERE ex_id = $1::int AND ps_id = $2::int;";
      const res = await client.query(sql, [ex_id, ps_id]);
      debug("readExeList : SUCCESS");
      return res.rows;
    } catch (err) {
      debug("readExeList : " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }

  static async getStats(ex_id, ps_id) {
    const client = await ModelDB.connect_to_db();
    try {
      const sql =
        "SELECT ROUND(AVG(score),2), MIN(score), MAX(score), COUNT(*) FROM " +
        ModelExerciseProduction.dbName +
        " WHERE ex_id = $1::int AND ps_id = $2::int;";
      const res = await client.query(sql, [ex_id, ps_id]);
      return res.rows;
    } catch (err) {
      return false;
    } finally {
      client.end();
    }
  }

  // Get the best score for a user on a exercise (over its different productions)
  static async getBest(ex_id, user_id, ps_id) {
    const client = await ModelDB.connect_to_db();
    try {
      const sql =
        "SELECT MAX(score) FROM " +
        ModelExerciseProduction.dbName +
        " WHERE ex_id = $1::int AND user_id=$2::int AND ps_id = $3::int;";
      const res = await client.query(sql, [ex_id, user_id, ps_id]);
      return res.rows[0];
    } catch (err) {
      return false;
    } finally {
      client.end();
    }
  }

  static async readStuList(user_id, ps_id) {
    debug("Read all ExerciseProductions for a student (for all exercises)");
    const client = await ModelDB.connect_to_db();
    try {
      const sql = "SELECT * FROM " + ModelExerciseProduction.dbName + " WHERE user_id = $1::int AND ps_id = $2::int;";
      const res = await client.query(sql, [user_id, ps_id]);
      debug("readStuList : SUCCESS");
      return res.rows;
    } catch (err) {
      debug("readStuList : " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }

  static async readStuExList(user_id, ex_id, ps_id) {
    debug("Read all ExerciseProduction for a student (for one exercise)");
    const client = await ModelDB.connect_to_db();
    try {
      const sql =
        "SELECT * FROM " +
        ModelExerciseProduction.dbName +
        " ep, exercise e WHERE ep.ex_id=e.ex_id AND ep.user_id = $1::int AND ep.ex_id = $2::int AND ep.ps_id = $3::int;";
      const res = await client.query(sql, [user_id, ex_id, ps_id]);
      debug("readStuList : SUCCESS");
      return res.rows;
    } catch (err) {
      debug("readStuList : " + err.stack);
      return false;
    } finally {
      client.end();
    }
  }

  // VB added new 1st param
  static async evaluateStudProduction(ps_id, ex_id, user_id, data_file, callback) {
    debug("Preparing to launch analysis of exercise production");
    let fData = JSON.parse(data_file); // fichier soumis par l'étudiant
    //debug("fData = "+fData)
    debug("evaluateStudProd receives submitted file = " + fData.name);
    var fAnalyzePyScript = undefined;
    let fTemplateArchive = undefined;
    var localeEX = undefined;

    var personalizedHtmlStatement = undefined;
    var personalizedQuestionArchive = undefined;

    // Get the statement given to student

    // cannot go by this route as it renders html and does not return JSON
    //let route = ConfServ.servURL + 'StudentStatement/' + ps_id + '/' + ex_id
    debug("trying to get exerc " + ex_id + " for user " + user_id + " in session " + ps_id);
    const studentStatement = await ModelStudentStatement.read(ps_id, user_id, ex_id);
    if (studentStatement) {
      debug("got a studStatement from DB"); // + JSON.stringify(studentStatement))
    } else {
      // Chouki (2022-04-12) : We can come here if the user forged a request to make  
      // a production for an exercice that is not in a session for which it registered 
      // (the student statement is retrieved using session if, ex id, and ex_id)
      debug("got nothing from DB: " + studentStatement);
    }

    // Get the analysis script for this exercise
    ControllerExerciseAPI.getExercise(ex_id)
      .then((exercise) => {
        fAnalyzePyScript = JSON.parse(exercise.marking_script);
        debug("Analysis script name: " + fAnalyzePyScript.name);
        fTemplateArchive = JSON.parse(exercise.template_archive);
        debug("Template archive name: " + fTemplateArchive.name);
        localeEX = exercise.locale
        debug('Locale of this exercise = ' + localeEX);
        return exercise; // gives exercise to next 'then' (?)
      })
      // new VB
      
      // previously
      .then((exercise) => {
        // to this 'then' (?)
        // Put all files necessary for analysis in a dedicated folder on the file system
        debug("start paths");
        let path = "/storage-fs/" + user_id + "/" + ex_id + "/";
        debug("user_id =" + user_id);
        let fStatementPath = path + "statement.html";
        //let fArchivePath = path + 'archive.tar.gz'
        let fTemplateArchivePath = path + "question.tar.gz";
        //let fDataPath = path + fData.name
        let fSubmittedAnswerPath = path + "submitted.tar.gz";
        let fAnalyzeScriptPath = path + fAnalyzePyScript.name;
        debug("start evaluating");
        fs.mkdir(path, { recursive: true }, function (err) {
          if (!err) {
            // html Statement of exercise for this student
            fs.writeFile(fStatementPath, studentStatement.statement, function (err) {
              if (!err) {
                // template archive of the question
                //fs.writeFile(fTemplateArchivePath, Buffer.from(fTemplateArchive.data), function (err) {
                fs.writeFile(
                  fTemplateArchivePath,
                  Buffer.from(JSON.parse(studentStatement.file).data.data),
                  function (err) {
                    if (!err) {
                      // reponse soumise par l'étudiant
                      fs.writeFile(fSubmittedAnswerPath, Buffer.from(fData.data), function (err) {
                        if (!err) {
                          // fichier de note + remarques
                          fs.writeFile(
                            fAnalyzeScriptPath,
                            Buffer.from(fAnalyzePyScript.data),
                            function (err) {
                              if (!err) {
                                fs.copyFile(
                                  __dirname + "/../lib/Python/plageLib.py",
                                  path + "plageLib.py",
                                  function (err) {
                                    if (!err) {
                                      let options = {
                                        mode: "text",
                                        pythonPath: "/usr/bin/python",
                                        pythonOptions: ["-u"],
                                        scriptPath: path,
                                        args: [
                                          fStatementPath,
                                          fTemplateArchivePath,
                                          fSubmittedAnswerPath,
                                          localeEX,
                                        ],
                                      };
                                      let py_script = fAnalyzePyScript.name;
                                      /* fs.writeFile(path + 'log.txt', '', function (err) {
                                                  if (err) throw err;
                                                  debug('File is created successfully.');
                                                }); */
                                      debug("start python shell command:",py_script,options);
                                      PythonShell.run(py_script, options, function (err, res) {
                                        if (err) {
                                          fs.readFile(path + "log.txt", function (errF, data) {
                                            let msg = err.toString() + "\n";
                                            if (!errF) {
                                              debug(data);
                                              debug("Problem");
                                              msg += data;
                                            } else {
                                              debug("Other pbm: log.txt file not found! " + errF);
                                              msg += errF;
                                            }
                                            debug(err);
                                            callback(msg, undefined);
                                          });
                                        } else if (res) {
                                          debug("Python ran ok: now going to callback with res");
                                          debug("res of analysis is " + res);
                                          callback(undefined, res);
                                        }
                                      });
                                    } else {
                                      debug(err);
                                      callback(err, undefined);
                                    }
                                  }
                                );
                              } else {
                                debug(err);
                                callback(err, undefined);
                              }
                            }
                          );
                        } else {
                          debug(err);
                          callback(err, undefined);
                        }
                      });
                    }
                  }
                );
              }
            });
          } else {
            debug(err);
            callback(err, undefined);
          }
        });
      });
  }

  static async evaluateStudProductionLMS(ex_id, archRep, lmsStudentStatement, callback) {
    debug("Preparing to launch analysis of exercise production");
    let fData = JSON.parse(archRep); // fichier soumis par l'étudiant
    let studentStatement = {
      archive: JSON.stringify(lmsStudentStatement.archive),
      statement: JSON.stringify(lmsStudentStatement.statement),
    };

    debug("evaluateStudProd receives submitted file = " + fData.name);
    var fAnalyzePyScript = undefined;
    let fTemplateArchive = undefined;
 
    // Get the analysis script for this exercise
    let exercise = axios
      .get(process.env.PLAGE_ENV + "api/exercise/" + ex_id)
      .then((exercise) => {
        fAnalyzePyScript = JSON.parse(exercise.data.marking_script);
        debug("Analysis script name: " + fAnalyzePyScript.name);
        fTemplateArchive = JSON.parse(exercise.data.template_archive);
        debug("Template archive name: " + fTemplateArchive.name);
        localeEX = exercise.data.locale
        debug('Locale of this exercise = ' + localeEX);
        return exercise; // gives exercise to next 'then' (?)
      })
      // previously
      .then((exercise) => {
        // to this 'then' (?)
        // Put all files necessary for analysis in a dedicated folder on the file system
        debug("start paths");
        const rndToday = new Date().getTime();
        const rand = Math.random().toString(36).substring(2); //Generate a random identifer
        let path = "/storage-fs/lms-session/" + exercise.ex_id + "/" + rndToday + "/" + rand + "/"; //Shouldn't we remove this from file system when the evaluation is done ?
        const seed = rndToday + "/" + rand; //Maybe usefull later ?
        let fStatementPath = path + "statement.html";
        //let fArchivePath = path + 'archive.tar.gz'
        let fTemplateArchivePath = path + "question.tar.gz";
        //let fDataPath = path + fData.name
        let fSubmittedAnswerPath = path + "submitted.tar.gz";
        let fAnalyzeScriptPath = path + fAnalyzePyScript.name;
        debug("start evaluating");
        fs.mkdir(path, { recursive: true }, function (err) {
          if (!err) {
            // html Statement of exercise for this student
            fs.writeFile(fStatementPath, JSON.parse(studentStatement.statement).data, function (err) {
              if (!err) {
                // template archive of the question
                //fs.writeFile(fTemplateArchivePath, Buffer.from(fTemplateArchive.data), function (err) {
                fs.writeFile(
                  fTemplateArchivePath,
                  Buffer.from(JSON.parse(studentStatement.archive).data),
                  function (err) {
                    if (!err) {
                      // reponse soumise par l'étudiant
                      fs.writeFile(fSubmittedAnswerPath, Buffer.from(fData.data), function (err) {
                        if (!err) {
                          // fichier de note + remarques
                          fs.writeFile(
                            fAnalyzeScriptPath,
                            Buffer.from(fAnalyzePyScript.data),
                            function (err) {
                              if (!err) {
                                fs.copyFile(
                                  __dirname + "/../lib/Python/plageLib.py",
                                  path + "plageLib.py",
                                  function (err) {
                                    if (!err) {
                                      let options = {
                                        mode: "text",
                                        pythonPath: "/usr/bin/python",
                                        pythonOptions: ["-u"],
                                        scriptPath: path,
                                        args: [
                                          fStatementPath,
                                          fTemplateArchivePath,
                                          fSubmittedAnswerPath,
                                          localeEX,
                                        ],
                                      };
                                      let py_script = fAnalyzePyScript.name;
                                      debug("start python shell command");
                                      PythonShell.run(py_script, options, function (err, res) {
                                        if (err) {
                                          fs.readFile(path + "log.txt", function (errF, data) {
                                            let msg = err.toString() + "\n";
                                            if (!errF) {
                                              debug(data);
                                              debug("Problem");
                                              msg += data;
                                            } else {
                                              debug("Other pbm: log.txt file not found! " + errF);
                                              msg += errF;
                                            }
                                            debug(err);
                                            callback(msg, undefined);
                                          });
                                        } else if (res) {
                                          debug("Python ran ok: now going to callback with res");
                                          debug("res of analysis is " + res);
                                          callback(undefined, res);
                                        }
                                      });
                                    } else {
                                      debug(err);
                                      callback(err, undefined);
                                    }
                                  }
                                );
                              } else {
                                debug(err);
                                callback(err, undefined);
                              }
                            }
                          );
                        } else {
                          debug(err);
                          callback(err, undefined);
                        }
                      });
                    }
                  }
                );
              }
            });
          } else {
            debug(err);
            callback(err, undefined);
          }
        });
        
      });
  }
}

ModelExerciseProduction.dbName = "ExerciseProduction";
ModelExerciseProduction.keys = [
  ["ep_id", "int"],
  ["ex_id", "int"],
  ["user_id", "int"],
  ["comment", "text"],
  ["score", "decimal"],
  ["processing_log", "text"],
  ["working_time", "varchar"],
  ["production_data", "bytea"],
  //["submission_date", "timestamptz"], <- filled by postgres (and if indicated here: not filled !!!)
  ["ps_id", "int"]
];
ModelExerciseProduction.locKey = undefined;

module.exports = ModelExerciseProduction;
