/**
 * WebSocket adapter – persistent bidirectional socket per microservice.
 *
 * The gateway establishes one socket.io connection per upstream service at
 * startup, then multiplexes individual HTTP requests over it using correlation
 * IDs. This measures the overhead of the socket framing, JSON encoding, and
 * event-loop dispatch vs. a plain TCP HTTP/1.1 connection.
 *
 * ZT_MTLS: socket.io-client uses an HTTPS endpoint when mTLS is active.
 */
const { v4: uuidv4 } = require('uuid');
const { io }         = require('socket.io-client');

const WS_PORT     = process.env.WS_PORT || 8082;
const WS_TIMEOUT  = parseInt(process.env.WS_TIMEOUT_MS || '10000', 10);

// One socket per upstream service (reused across requests)
const sockets = {};

const buildSocketUrl = (serviceUrl) => {
  // WS bypasses the Nginx mTLS sidecar; map nginx-* → ms-* to reach the WS server directly
  const rawHost = new URL(serviceUrl).hostname;
  const host = rawHost.replace(/^nginx-/, 'ms-');
  if (process.env.ZT_MTLS === 'true') return `https://${host}:${WS_PORT}`;
  return `http://${host}:${WS_PORT}`;
};

const getSocket = (serviceUrl) => {
  if (sockets[serviceUrl]?.connected) return sockets[serviceUrl];

  const socketUrl = buildSocketUrl(serviceUrl);
  const opts = { reconnection: true, timeout: WS_TIMEOUT };

  if (process.env.ZT_MTLS === 'true') {
    const fs = require('fs');
    try {
      opts.ca   = fs.readFileSync('/app/certs/ca.crt');
      opts.cert = fs.readFileSync('/app/certs/gateway.crt');
      opts.key  = fs.readFileSync('/app/certs/gateway.key');
    } catch (e) {
      console.error('[adapter:ws] mTLS cert load failed:', e.message);
    }
  }

  const socket = io(socketUrl, opts);
  socket.on('connect',       () => console.log(`[adapter:ws] connected → ${socketUrl}`));
  socket.on('connect_error', (e) => console.error(`[adapter:ws] ${socketUrl} error:`, e.message));
  sockets[serviceUrl] = socket;
  return socket;
};

exports.connect = async ({ exerciseUrl, otherUrl }) => {
  // Eagerly establish connections at gateway startup
  getSocket(exerciseUrl);
  getSocket(otherUrl);
};

exports.forward = (req, res, { serviceUrl }) => {
  const socket = getSocket(serviceUrl);
  if (!socket.connected) {
    return res.status(503).json({ message: 'WebSocket service not connected' });
  }

  const correlationId = uuidv4();
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k] = Array.isArray(v) ? v.join(', ') : v;
    }

    const message = {
      correlationId,
      method:  req.method,
      path:    req.url, // includes query string
      headers,
      body:    Buffer.concat(chunks).toString('base64'),
    };

    // Wait for the response event matching this correlationId
    const timer = setTimeout(() => {
      socket.off(`response:${correlationId}`, handler);
      if (!res.headersSent) res.status(504).json({ message: 'WebSocket request timeout' });
    }, WS_TIMEOUT);

    const handler = ({ statusCode, headers: resHeaders, body }) => {
      clearTimeout(timer);
      for (const [k, v] of Object.entries(resHeaders || {})) {
        if (!['transfer-encoding', 'content-length'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      }
      res.status(statusCode || 200).send(Buffer.from(body || '', 'base64'));
    };

    socket.once(`response:${correlationId}`, handler);
    socket.emit('request', message);
  });
};
