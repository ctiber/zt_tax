require('./otel'); // must be first — patches express, axios, grpc, etc.
const express = require("express");
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('soy-gateway');

// ─── Communication pattern adapter ───────────────────────
// COM_PATTERN selects the transport used for gateway→microservice calls.
// The adapter exposes a single function:
//   forward(req, res, { target })   target = 'exercise' | 'other'
const COM_PATTERN = (process.env.COM_PATTERN || 'http').toLowerCase();
const adapter = require(`./adapters/${COM_PATTERN}`);

// ─── Config ────────────────────────────────────────────────
const EXERCISE_URL = process.env.EXERCISE_SERVICE_URL || `http://ms-exercise:${process.env.PORT || 8080}`;
const OTHER_URL    = process.env.OTHER_SERVICE_URL    || `http://ms-other:${process.env.PORT    || 8080}`;
const RA_URL       = process.env.RA_SERVICE_URL       || 'http://risk-analysis:9000';

// ─── CORS ─────────────────────────────────────────────────
const frontOrigin = (process.env.REACT_APP_FRONT_URL || '').replace(/\/$/, '') || '*';
app.use(cors({
  origin: frontOrigin,
  methods: ["POST", "PUT", "GET", "DELETE", "OPTIONS", "HEAD"],
  credentials: true,
}));

// ─── Helpers ──────────────────────────────────────────────
const parseCookies = (header) => {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    const key = part.slice(0, idx).trim();
    acc[key] = part.slice(idx + 1).trim();
    return acc;
  }, {});
};

const PUBLIC_PATHS = new Set([
  'POST /api/user',
  'POST /api/user/login',
  'DELETE /api/user/logout',
  'GET /api/auth/verify',
  'GET /api/help',
  'GET /health',
]);
const isPublic = (req) =>
  PUBLIC_PATHS.has(`${req.method} ${req.path}`) ||
  req.path.startsWith('/static/') ||
  req.path.startsWith('/favicon');

// ─── Gateway auth (baseline: auth only at gateway) ────────
const gatewayAuth = (req, res, next) => {
  if (isPublic(req)) return next();
  const cookies = parseCookies(req.headers.cookie);
  const accessToken  = cookies['access_token'];
  const refreshToken = cookies['refresh_token'];

  if (accessToken) {
    const span = tracer.startSpan('zt.gateway.auth');
    try {
      const session = jwt.verify(accessToken, process.env.SECRET_JWT);
      req.headers['x-soy-user-id']    = String(session.user_id  ?? '');
      req.headers['x-soy-user-role']  = String(session.role_id  ?? '');
      req.headers['x-soy-user-email'] = String(session.email    ?? '');
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return next();
    } catch (err) {
      span.setAttribute('error.type', err.name);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.name });
      span.end();
      if (err.name === 'TokenExpiredError' && refreshToken) return next();
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }
  if (refreshToken) return next();
  return res.status(401).json({ message: 'Unauthenticated' });
};
app.use(gatewayAuth);

// ─── Risk Analysis (ZT_RA) ─────────────────────────────────
const riskAnalysis = async (req, res, next) => {
  if (process.env.ZT_RA !== 'true') return next();
  const span = tracer.startSpan('zt.risk_analysis');
  try {
    const { data } = await axios.post(`${RA_URL}/analyze`, {
      method: req.method, path: req.path,
      userId: req.headers['x-soy-user-id'],
      userRole: req.headers['x-soy-user-role'],
      ip: req.ip, timestamp: Date.now(),
    }, { timeout: 500 });
    span.setAttribute('ra.blocked', !!data?.block);
    if (data?.block) span.setAttribute('ra.reason', data.reason || '');
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    if (data?.block) return res.status(403).json({ message: 'Blocked by RA', reason: data.reason });
  } catch (_) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'fail-open' });
    span.end();
  }
  next();
};
app.use(riskAnalysis);

// ─── Gateway health endpoint ──────────────────────────────
// Handled locally — does not proxy to any microservice.
// Used by run-experiments.sh to detect when the gateway is ready.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Routes ───────────────────────────────────────────────
// Restore req.url to req.originalUrl before forwarding.
// When app.use("/prefix", handler) matches, Express strips the prefix from
// req.url (e.g. "/api/student-statement/user/1" becomes "/user/1").
// All transport adapters (http-proxy, gRPC, WS, AMQP, Kafka) must receive
// the full path so the downstream service can route correctly.
const restoreUrl = (req, _res, next) => { req.url = req.originalUrl; next(); };

app.use("/api/exercise-production", restoreUrl, (req, res) =>
  adapter.forward(req, res, { serviceUrl: EXERCISE_URL, service: 'exercise' }));

app.use("/api/student-statement", restoreUrl, (req, res) =>
  adapter.forward(req, res, { serviceUrl: EXERCISE_URL, service: 'exercise' }));

app.use("/", (req, res) =>
  adapter.forward(req, res, { serviceUrl: OTHER_URL, service: 'other' }));

// ─── Start ─────────────────────────────────────────────────
(async () => {
  // SR primitive: fetch secrets from Vault before the server accepts traffic
  const { loadSecrets } = require('./vault-secrets');
  await loadSecrets();

  const PORT = 8080;
  app.listen(PORT, async () => {
    // Give the adapter a chance to establish connections (gRPC channel, WS, AMQP…)
    if (typeof adapter.connect === 'function') {
      await adapter.connect({ exerciseUrl: EXERCISE_URL, otherUrl: OTHER_URL }).catch(e =>
        console.error('[gateway] adapter.connect failed:', e.message));
    }
    const flags = ['AC4A','SR','MTLS','RA'].map(f => `ZT_${f}=${process.env[`ZT_${f}`]||'false'}`).join(' ');
    console.log(`[gateway] :${PORT} COM_PATTERN=${COM_PATTERN} | ${flags}`);
    console.log(`[gateway] exercise→${EXERCISE_URL} | other→${OTHER_URL}`);
  });
})();
