// Much better!

const cluster = require('cluster');

if (cluster.isMaster) {
  cluster.fork();

  cluster.on('disconnect', (worker) => {
    console.error(`Worker ${worker.id} disconnected`);
    cluster.fork();
  });

} else {

  require('./otel'); // must be first in worker — patches express, pg, grpc, etc.

  (async () => {
  // SR primitive: fetch secrets from Vault before any env-dependent init
  const { loadSecrets } = require('./vault-secrets');
  await loadSecrets();

  const domain = require('domain');



  // !!! order below is important !
  const debug = require("debug")("index");
  const express = require("express");
  const fileUpload = require("express-fileupload");
  const pg = require("pg");
  const cors = require("cors");

  const pool = new pg.Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    ssl: false
  });

  // Config files
  const ConfServ = require("./config/ConfServ");
  const i18n = require("i18n-2");

  // Controllers
  //const ControllerCourse = require('./controller/ControllerCourse')
  //const ControllerExercise = require('./controller/ControllerExercise')
  //const ControllerFichier = require('./controller/ControllerFichier')
  const ControllerLibrary = require("./controller/ControllerLibrary");

  const access = require("./middlewares/accessControl");

  //Used for swagger
  const swaggerUI = require("swagger-ui-express");
  const openApiDocumentation = require("./doc/API/openApiDocumentation");

  var app = express();

  // Domain
  app.use((req, res, next) => {
    const d = domain.create();
    d.on('error', (er) => {
      console.error(`error ${er.stack}`);

     

      try {
        // Make sure we close down within 30 seconds
        console.error("Killing process in 30s")
        const killtimer = setTimeout(() => {
          process.exit(1);
        }, 30000);
        // But don't keep the process open just for that!
        killtimer.unref();

        // Stop taking new requests.
        server.close();

        // 'disconnect' in the cluster primary, and then it will fork
        // a new worker.
        cluster.worker.disconnect();

        // Try to send an error to the request that triggered the problem
        res.statusCode = 500;
        res.end('Oops, there was a problem!');
      } catch (er2) {
        // Oh well, not much we can do at this point.
        console.error(`Error sending 500! ${er2.stack}`);
      }
    });

    // Because req and res were created before this domain existed,
    // we need to explicitly add them.
    // See the explanation of implicit vs explicit binding below.
    d.add(req);
    d.add(res);

    // Now run the handler function in the domain.
    d.run(() => {
      next()
    });
  })

  //Used for swagger
  app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(openApiDocumentation));


  // Init static routes
  app.use("/css", express.static(__dirname + "/static/css"));
  app.use("/img", express.static(__dirname + "/static/img"));
  app.use("/js", express.static(__dirname + "/static/js"));
  app.use("/files", express.static(__dirname + "/static/files"));

  //CORS:
  app.all("*", (req, res, next) => {
    debug("origin " + req.get('origin'))
    next()
  })

  // Debug function
  app.all("*", function (req, rep, next) {
    debug(req.method + " " + req.url);
    next();
  });

  app.use(
    cors({
      origin: process.env.REACT_APP_FRONT_URL.slice(0, -1), // remove slash at the end
      methods: ["POST", "PUT", "GET", "DELETE", "OPTIONS", "HEAD"],
      credentials: true
    })
  );

  
  // MORE RECENT Middleware PARSERS
  app.use(express.json({ limit: "1mb" })); // <==== parse request body as JSON
  app.use(
    express.urlencoded({
      extended: true
    })
  );

  app.use(fileUpload());

  i18n.expressBind(app, {

    // setup some locales - other locales default to vi silently
    locales: ["en", "fr"],

    // set the default locale
    defaultLocale: "en",
    directory: "./locale",
    extension: ".json"
  });

  // Application middleware
  // This middleware will fire for any incoming request

  // Setting a default locale
  app.use(function (req, res, next) {
    req.i18n.setLocale(req.headers["content-language"]);
    next();
  });


  // ─── Microservice-level Risk Analysis (ZT_RA_MS) ─────
  app.use(require('./middlewares/riskAnalysis'));

  debug("Booting MS-OTHER part");

  // ---------- Errors routes ----------
  app.use(require("./routes/errors"));

  // ---------- User Routes ----------
  app.use(require("./routes/userRoutes"));

  // ---------- Course routes ----------
  //app.use(require('./routes/courses'));

  // ---------- E-Mail routes ----------
  // used to email users (at account creation, forgotten passwd, ...)
  app.use(require("./routes/email"));

  // ---------- Exercise routes ----------
  app.use(require("./routes/exercises"));

  // ---------- Admin routes ----------
  app.use(require("./routes/admin"));

  // ========== Download ==========
  // Get PlageLib.py
  app.get("/lib/getPlagePythonLib", function (req, res) {
    ControllerLibrary.getPlageLibPy(req, res);
  });

  // ---------- Help sections ---------
  app.use(require("./routes/help"));



  // ---------- PlageSession ----------
  app.use(require("./routes/plageSession"));

  // ---------- Profile ----------
  app.use(require("./routes/profile"));

  // ---------- Sequence Routes ----------
  app.use(require("./routes/sequence"));

  // ---------- Skills Routes ----------
  app.use(require("./routes/skills"));

  // ---------- Lang Routes ----------
  app.use(require('./routes/lang'))

  // ---------- Feedback Routes ----------
  app.use( require( './routes/feedback'))

  // ---------- Thanks Routes ----------
  app.use( (require('./routes/thanks')))
  
  // ---------- No Cookies ----------
  app.get("/noCookies", function (req, res) {
    res.render("common/noCookies.ejs");
  });

 
  // ---------- Start server ----------
  const expressPort = parseInt(process.env.MS_PORT || '5001', 10);
  const server = app.listen(expressPort, async function () {
    const flags = ['AC4A','SR','MTLS','RA'].map(f=>`ZT_${f}=${process.env['ZT_'+f]||'false'}`).join(' ');
    const pattern = process.env.COM_PATTERN || 'http';
    console.log(`[ms-other] :${expressPort} COM_PATTERN=${pattern} | ${flags}`);

    // Start additional transport servers based on COM_PATTERN
    process.env.SERVICE_NAME = 'ms-other';
    if (pattern === 'grpc') {
      const { startGrpcServer } = require('./transports/grpc');
      startGrpcServer(expressPort);
    } else if (pattern === 'websocket') {
      const { startWsServer } = require('./transports/ws');
      startWsServer(expressPort);
    } else if (pattern === 'queue') {
      const { startQueueConsumer } = require('./transports/queue');
      await startQueueConsumer('other', expressPort);
    } else if (pattern === 'topic') {
      const { startTopicConsumer } = require('./transports/topic');
      await startTopicConsumer('other', expressPort);
    }
    // 'http' and 'cqrs' use no extra transport servers
  });

  })().catch(err => { console.error('[ms-other] startup failed:', err); process.exit(1); });
}
