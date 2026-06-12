'use strict';
require('./otel');

const express  = require('express');
const jwt      = require('jsonwebtoken');
const axios    = require('axios');
const amqp     = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const https    = require('https');
const fs       = require('fs');
const { trace } = require('@opentelemetry/api');

// ── Configuration ────────────────────────────────────────────────────────────
const PORT          = parseInt(process.env.PORT || '8080');
const FRONTEND_URL  = process.env.FRONTEND_URL || 'http://frontend:8081';
const RA_URL        = process.env.RA_URL        || 'http://risk-analysis:5002';
const AMQP_URL      = process.env.AMQP_URL      || 'amqp://guest:guest@rabbitmq:5672';
const COM_PATTERN   = process.env.COM_PATTERN   || 'http';   // 'http' | 'queue'
const JWT_SECRET    = process.env.JWT_SECRET    || 'dev-secret-change-me';
const JWT_EXPIRY    = process.env.JWT_EXPIRY    || '1h';

// Feature flags
const ZT_AUTH  = process.env.ZT_AUTH  === 'true';
const ZT_RA    = process.env.ZT_RA    === 'true';
const ZT_MTLS  = process.env.ZT_MTLS  === 'true';

// mTLS agent (used when ZT_MTLS=true)
let mtlsAgent = null;
if (ZT_MTLS) {
  mtlsAgent = new https.Agent({
    cert: fs.readFileSync('/certs/zt-gateway.crt'),
    key:  fs.readFileSync('/certs/zt-gateway.key'),
    ca:   fs.readFileSync('/certs/ca.crt'),
  });
}

// ── AMQP channel with Direct Reply-to ───────────────────────────────────────
// One consumer on the magic amq.rabbitmq.reply-to pseudo-queue routes replies
// back to the exact connection that sent the request — no shared ob-responses
// queue, no per-request consumer/cancel churn, no O(n²) redelivery storm.
const pendingRequests = new Map(); // correlationId → { resolve, timeoutHandle }

let amqpChannel = null;
async function getAmqpChannel() {
  if (amqpChannel) return amqpChannel;
  const conn = await amqp.connect(AMQP_URL);
  amqpChannel = await conn.createChannel();
  await amqpChannel.assertQueue('ob-requests', { durable: false });

  // Single shared reply consumer — noAck required by RabbitMQ for reply-to
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function verifyJWT(req, res, next) {
  if (!ZT_AUTH) return next();
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  try {
    req.jwtPayload = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid or missing token' });
  }
}

async function callRA(req, res, next) {
  if (!ZT_RA) return next();
  const span = trace.getActiveSpan();
  const t0 = Date.now();
  try {
    await axios.post(`${RA_URL}/analyze`, {
      userId: req.jwtPayload?.userId || 'anonymous',
      method: req.method,
      path:   req.path,
    }, { timeout: 5000 });
    if (span) span.setAttribute('zt.risk_analysis.ms', Date.now() - t0);
    next();
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 || status === 403) {
      res.status(403).json({ error: 'request blocked by risk analysis' });
    } else {
      next(); // RA unavailable — fail open
    }
  }
}

// ── HTTP proxy to OB frontend ────────────────────────────────────────────────
function buildProxyMiddleware() {
  const proxyOpts = {
    target: FRONTEND_URL,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.headers['authorization'])
          proxyReq.setHeader('X-Zt-Authorization', req.headers['authorization']);
        if (ZT_MTLS && mtlsAgent)
          proxyReq.agent = mtlsAgent;
        // Express bodyParser consumes the body stream; re-attach the parsed body
        // so that http-proxy-middleware can forward it correctly to the frontend.
        fixRequestBody(proxyReq, req);
      },
    },
  };
  return createProxyMiddleware(proxyOpts);
}

// ── AMQP request-reply ───────────────────────────────────────────────────────
async function handleViaQueue(req, res) {
  const correlationId = uuidv4();
  const ch = await getAmqpChannel();

  const payload = JSON.stringify({
    correlationId,
    method:  req.method,
    path:    req.originalUrl,
    headers: { ...req.headers, host: 'frontend', 'x-zt-authorization': req.headers['authorization'] || '' },
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
        // queue-adapter encodes the body as base64 to preserve binary responses
        const body = reply.encoding === 'base64'
          ? Buffer.from(reply.body, 'base64')
          : reply.body;
        res.send(body);
        resolve();
      },
    });

    ch.sendToQueue('ob-requests', Buffer.from(payload), {
      correlationId,
      replyTo: 'amq.rabbitmq.reply-to',
    });
  });
}

// ── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (no auth)
app.get('/healthz', (_, res) => res.json({ status: 'ok' }));

// Login endpoint — issues JWT (no ZT primitives applied here)
app.post('/zt/login', (req, res) => {
  const userId = req.body?.userId || `user-${uuidv4().slice(0, 8)}`;
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ token, userId });
});

// All other routes: auth → RA → forward
app.use(verifyJWT, callRA, (req, res, next) => {
  if (COM_PATTERN === 'queue') {
    handleViaQueue(req, res).catch(next);
  } else {
    next();
  }
});

// HTTP proxy (only reached when COM_PATTERN=http)
if (COM_PATTERN !== 'queue') {
  app.use(buildProxyMiddleware());
}

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal gateway error' });
});

app.listen(PORT, () => {
  console.log(`[ob-zt-gateway] listening on :${PORT}  pattern=${COM_PATTERN}  ZT_AUTH=${ZT_AUTH}  ZT_RA=${ZT_RA}  ZT_MTLS=${ZT_MTLS}`);
});
