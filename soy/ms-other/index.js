// Zero Trust instrumented ms-other (original: SOY_MS_HTTP-main/other-http)
const cluster = require('cluster');

if (cluster.isMaster) {
  cluster.fork();

  cluster.on('disconnect', (worker) => {
    console.error(`Worker ${worker.id} disconnected`);
    cluster.fork();
  });

} else {

  (async () => {

    // OTEL must start before any pg/http requires (only in worker, not master)
    if (process.env.OTEL_ENABLED === 'true') require('./otel');

    // SR: load secrets from Vault before anything else touches env vars
    const zt = require('./zt');
    await zt.loadVaultSecrets();

    const domain = require('domain');
    const debug = require('debug')('index');
    const express = require('express');
    const fileUpload = require('express-fileupload');
    const cors = require('cors');

    const ControllerLibrary = require('./controller/ControllerLibrary');
    const i18n = require('i18n-2');

    const swaggerUI = require('swagger-ui-express');
    const openApiDocumentation = require('./doc/API/openApiDocumentation');

    const app = express();

    // Domain error handler
    app.use((req, res, next) => {
      const d = domain.create();
      d.on('error', (er) => {
        console.error(`error ${er.stack}`);
        try {
          const killtimer = setTimeout(() => { process.exit(1); }, 30000);
          killtimer.unref();
          cluster.worker.disconnect();
          res.statusCode = 500;
          res.end('Oops, there was a problem!');
        } catch (er2) {
          console.error(`Error sending 500! ${er2.stack}`);
        }
      });
      d.add(req);
      d.add(res);
      d.run(() => { next(); });
    });

    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(openApiDocumentation));

    app.use('/css',   express.static(__dirname + '/static/css'));
    app.use('/img',   express.static(__dirname + '/static/img'));
    app.use('/js',    express.static(__dirname + '/static/js'));
    app.use('/files', express.static(__dirname + '/static/files'));

    app.all('*', (req, res, next) => { debug('origin ' + req.get('origin')); next(); });
    app.all('*', (req, res, next) => { debug(req.method + ' ' + req.url); next(); });

    app.use(cors({
      origin: (process.env.REACT_APP_FRONT_URL || 'http://localhost:3001/').replace(/\/$/, ''),
      methods: ['POST', 'PUT', 'GET', 'DELETE', 'OPTIONS', 'HEAD'],
      credentials: true,
    }));

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(fileUpload());

    i18n.expressBind(app, {
      locales: ['en', 'fr'],
      defaultLocale: 'en',
      directory: './locale',
      extension: '.json',
    });

    app.use((req, res, next) => {
      req.i18n.setLocale(req.headers['content-language']);
      next();
    });

    // ── ZT gates (AC4A + RA at MS tier) ──────────────────────────────────────
    app.use(zt.verifyJWT);
    app.use((req, res, next) => zt.callRA(req, res, next));
    // ─────────────────────────────────────────────────────────────────────────

    debug('Booting MS-OTHER part');

    app.use(require('./routes/errors'));
    app.use(require('./routes/userRoutes'));
    app.use(require('./routes/email'));
    app.use(require('./routes/exercises'));
    app.use(require('./routes/admin'));

    app.get('/lib/getPlagePythonLib', (req, res) => {
      ControllerLibrary.getPlageLibPy(req, res);
    });

    app.use(require('./routes/help'));
    app.use(require('./routes/plageSession'));
    app.use(require('./routes/profile'));
    app.use(require('./routes/sequence'));
    app.use(require('./routes/skills'));
    app.use(require('./routes/lang'));
    app.use(require('./routes/feedback'));
    app.use(require('./routes/thanks'));

    app.get('/noCookies', (req, res) => { res.render('common/noCookies.ejs'); });

    app.listen(process.env.MS_PORT || 8080, () => {
      console.log('[ms-other] listening on port ' + (process.env.MS_PORT || 8080));
    });

  })().catch(err => { console.error('[ms-other] startup error:', err); process.exit(1); });
}
