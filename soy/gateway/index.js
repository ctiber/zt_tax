'use strict';
require('./otel');

const express    = require('express');
const jwt        = require('jsonwebtoken');
const axios      = require('axios');
const amqp       = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const { createProxyMiddleware } = require('http-proxy-middleware');
const https      = require('https');
const fs         = require('fs');
const { trace }  = require('@opentelemetry/api');
const promClient = require('prom-client');

// ── Prometheus metrics ────────────────────────────────────────────────────────
const raHistogram = new promClient.Histogram({
  name: 'zt_ra_call_duration_seconds',
  help: 'Duration of gateway Risk Analysis HTTP calls in seconds',
  buckets: [0.001, 0.002, 0.005, 0.010, 0.020, 0.050,
            0.100, 0.200, 0.500, 1.0, 2.0, 5.0],
});

// ── Configuration ─────────────────────────────────────────────────────────────
const PORT              = parseInt(process.env.PORT || '8080');
const EXERCISE_URL      = process.env.EXERCISE_SERVICE_URL || 'http://ms-exercise:8080';
const OTHER_URL         = process.env.OTHER_SERVICE_URL    || 'http://ms-other:8080';
const RA_SERVICE_URL    = process.env.RA_SERVICE_URL       || 'http://risk-analysis:9000';
const AMQP_URL          = process.env.AMQP_URL             || 'amqp://guest:guest@rabbitmq:5672';
const COM_PATTERN       = process.env.COM_PATTERN          || 'http';

const VAULT_ADDR        = process.env.VAULT_ADDR           || 'http://vault:8200';
const VAULT_TOKEN       = process.env.VAULT_TOKEN          || 'soy-dev-root-token';
const VAULT_SECRET_PATH = process.env.VAULT_SECRET_PATH    || 'secret/data/soy';
const VAULT_RENEWAL_MS  = parseInt(process.env.VAULT_RENEWAL_INTERVAL_MS || '3600000');

// Feature flags
const ZT_AC4A  = process.env.ZT_AC4A  === 'true';
const ZT_SR    = process.env.ZT_SR    === 'true';
const ZT_MTLS  = process.env.ZT_MTLS  === 'true';
const ZT_RA    = process.env.ZT_RA    === 'true';

// JWT secret — seeded from env; overwritten by Vault fetch when ZT_SR=true
let JWT_SECRET = process.env.SECRET_JWT || 'your_custom_jwt_secret';
let vaultFetchSucceeded = false;

// ── Secret Rotation via Vault ─────────────────────────────────────────────────
async function fetchVaultSecret() {
  try {
    const resp = await axios.get(`${VAULT_ADDR}/v1/${VAULT_SECRET_PATH}`, {
      headers: { 'X-Vault-Token': VAULT_TOKEN },
      timeout: 5000,
    });
    const secret = resp.data?.data?.data?.jwt_secret;
    if (secret) {
      JWT_SECRET = secret;
      vaultFetchSucceeded = true;
      console.log('[sr] JWT_SECRET refreshed from Vault');
    }
  } catch (err) {
    console.error('[sr] Vault fetch failed:', err.message);
  }
}

async function initSR() {
  if (!ZT_SR) return;
  // Retry until Vault is ready (vault-init may still be running at gateway start)
  for (let attempt = 1; attempt <= 10; attempt++) {
    await fetchVaultSecret();
    if (vaultFetchSucceeded) break;
    console.log(`[sr] Retrying Vault fetch (attempt ${attempt}/10)...`);
    await new Promise(r => setTimeout(r, 3000));
  }
  setInterval(fetchVaultSecret, VAULT_RENEWAL_MS);
}

// ── mTLS HTTPS agent ──────────────────────────────────────────────────────────
let mtlsAgent = null;
if (ZT_MTLS) {
  mtlsAgent = new https.Agent({
    cert:      fs.readFileSync('/app/certs/gateway.crt'),
    key:       fs.readFileSync('/app/certs/gateway.key'),
    ca:        fs.readFileSync('/app/certs/ca.crt'),
    keepAlive: true,
  });
}

// ── AMQP channel with Direct Reply-to ────────────────────────────────────────
const pendingRequests = new Map();
let amqpChannel = null;

async function getAmqpChannel() {
  if (amqpChannel) return amqpChannel;
  const conn = await amqp.connect(AMQP_URL);
  amqpChannel = await conn.createChannel();
  await amqpChannel.assertQueue('soy-requests', { durable: false });

  await amqpChannel.consume('amq.rabbitmq.reply-to', (msg) => {
    if (!msg) return;
    const pending = pendingRequests.get(msg.properties.correlationId);
    if (!pending) return;
    pendingRequests.delete(msg.properties.correlationId);
    clearTimeout(pending.timeoutHandle);
    pending.resolve(msg);
  }, { noAck: true });

  return amqpChannel;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// SoY uses cookie-based JWT (access_token cookie), not Bearer header
function extractToken(req) {
  const cookie = req.headers['cookie'] || '';
  const match  = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  if (match) return match[1];
  // Fallback: Accept Bearer header so load-test scripts can pass tokens directly
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Paths that must be accessible without a token (login flow)
const PUBLIC_PATHS = new Set(['/api/user/login', '/api/user/register']);

// Normalize parameterized paths before RA to prevent false lateral-movement triggers.
// e.g. /api/exercise-production/a1b2c3 → /api/exercise-production/:uuid
//      /api/business-session/77        → /api/business-session/:id
function normalizePath(p) {
  return p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:id');
}

function verifyJWT(req, res, next) {
  if (!ZT_AC4A || PUBLIC_PATHS.has(req.path)) return next();
  const token = extractToken(req);
  try {
    req.jwtPayload = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid or missing token' });
  }
}

// Decode JWT for RA tracking without re-verifying the signature.
// When AC4A is enabled req.jwtPayload is already set; when not, we decode for RA only.
function getRAIdentity(req) {
  const payload = req.jwtPayload || (() => {
    const token = extractToken(req);
    return token ? jwt.decode(token) : null;
  })();
  const userId   = (payload?.user_id ?? payload?.userId ?? payload?.sub ?? payload?.id)?.toString() || req.ip || 'anonymous';
  const userRole = (payload?.role_id ?? payload?.role)?.toString() || 'unknown';
  return { userId, userRole };
}

async function callRA(req, res, next) {
  if (!ZT_RA || PUBLIC_PATHS.has(req.path)) return next();
  const { userId, userRole } = getRAIdentity(req);
  const raSpan   = trace.getTracer('soy-gateway').startSpan('zt.risk_analysis');
  const endTimer = raHistogram.startTimer();
  try {
    const resp = await axios.post(`${RA_SERVICE_URL}/analyze`, {
      userId,
      userRole,
      method:   req.method,
      path:     normalizePath(req.path),
      ip:       req.ip,
    }, { timeout: 5000 });
    endTimer();
    raSpan.end();
    if (resp.data?.block === true) {
      return res.status(403).json({ error: 'request blocked by risk analysis' });
    }
    next();
  } catch (err) {
    endTimer();
    raSpan.end();
    const status = err.response?.status;
    if (status === 429 || status === 403) {
      return res.status(403).json({ error: 'request blocked by risk analysis' });
    }
    // RA unavailable — fail open
    next();
  }
}

// Route: /api/exercise-production/* and /api/student-statement/* → ms-exercise
//        everything else → ms-other
function resolveTarget(req) {
  if (/^\/api\/(exercise-production|student-statement)(\/|$)/.test(req.path)) {
    return EXERCISE_URL;
  }
  return OTHER_URL;
}

// ── HTTP proxies ──────────────────────────────────────────────────────────────
function buildProxyFor(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ...(ZT_MTLS && mtlsAgent ? { agent: mtlsAgent } : {}),
  });
}

// Lazy-built per-target proxies (targets can differ per request when ZT_MTLS
// switches between plain HTTP and HTTPS)
const proxyCache = new Map();
function getProxy(target) {
  if (!proxyCache.has(target)) proxyCache.set(target, buildProxyFor(target));
  return proxyCache.get(target);
}

// ── AMQP request-reply ────────────────────────────────────────────────────────
async function handleViaQueue(req, res) {
  const correlationId = uuidv4();
  const ch = await getAmqpChannel();

  const target = resolveTarget(req);
  const payload = JSON.stringify({
    correlationId,
    target,
    method:  req.method,
    path:    req.originalUrl,
    headers: req.headers,
    body:    req.body,
  });

  return new Promise((resolve) => {
    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(correlationId);
      res.status(504).json({ error: 'queue timeout' });
      resolve();
    }, 30_000);

    pendingRequests.set(correlationId, {
      timeoutHandle,
      resolve: (msg) => {
        const reply = JSON.parse(msg.content.toString());
        res.status(reply.statusCode || 200);
        Object.entries(reply.headers || {}).forEach(([k, v]) => {
          if (!['transfer-encoding', 'connection'].includes(k.toLowerCase()))
            res.setHeader(k, v);
        });
        const body = reply.encoding === 'base64'
          ? Buffer.from(reply.body, 'base64')
          : reply.body;
        res.send(body);
        resolve();
      },
    });

    ch.sendToQueue('soy-requests', Buffer.from(payload), {
      correlationId,
      replyTo: 'amq.rabbitmq.reply-to',
    });
  });
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

// Body parsing only for queue mode: HTTP proxy forwards the raw stream so body
// must NOT be consumed here (that would break multipart uploads and remove the
// stream before http-proxy-middleware can forward it).
if (COM_PATTERN === 'queue') {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
}

app.get('/healthz', (_, res) => res.json({ status: 'ok' }));

app.get('/zt/metrics', async (_, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// All routes: verify JWT (AC4A) → risk analysis (RA) → forward
app.use(verifyJWT, callRA, (req, res, next) => {
  if (COM_PATTERN === 'queue') {
    handleViaQueue(req, res).catch(next);
  } else {
    // HTTP: route to the correct upstream
    const target = resolveTarget(req);
    getProxy(target)(req, res, next);
  }
});

app.use((err, req, res, _next) => {
  console.error('[gateway] error:', err.message);
  res.status(500).json({ error: 'internal gateway error' });
});

// ── Startup ───────────────────────────────────────────────────────────────────
initSR().then(() => {
  app.listen(PORT, () => {
    console.log(
      `[soy-zt-gateway] :${PORT}  pattern=${COM_PATTERN}  ` +
      `ZT_AC4A=${ZT_AC4A}  ZT_SR=${ZT_SR}  ZT_MTLS=${ZT_MTLS}  ZT_RA=${ZT_RA}`
    );
  });
});
