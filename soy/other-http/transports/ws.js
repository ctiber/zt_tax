/**
 * WebSocket transport server (shared by all microservices).
 *
 * Listens for 'request' events, relays them to the local Express app via HTTP,
 * emits 'response:{correlationId}' with the result.
 */
const http  = require('http');
const https = require('https');
const { Server } = require('socket.io');

const WS_PORT = parseInt(process.env.WS_PORT || '8082', 10);

const relayToExpress = (message, expressPort) =>
  new Promise((resolve, reject) => {
    const body   = message.body ? Buffer.from(message.body, 'base64') : null;
    const urlStr = `http://localhost:${expressPort}${message.path}`;

    const headers = { ...message.headers };
    if (body) headers['content-length'] = body.length;

    const req = http.request(urlStr, { method: message.method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const resHeaders = {};
        for (const [k, v] of Object.entries(res.headers)) {
          resHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
        }
        resolve({
          statusCode: res.statusCode,
          headers: resHeaders,
          body: Buffer.concat(chunks).toString('base64'),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

exports.startWsServer = (expressPort) => {
  let server;
  if (process.env.ZT_MTLS === 'true') {
    const fs = require('fs');
    const serviceName = process.env.SERVICE_NAME || 'ms-other';
    try {
      server = https.createServer({
        ca:   fs.readFileSync('/app/certs/ca.crt'),
        cert: fs.readFileSync(`/app/certs/${serviceName}.crt`),
        key:  fs.readFileSync(`/app/certs/${serviceName}.key`),
        requestCert: true,
        rejectUnauthorized: true,
      });
    } catch (e) {
      console.error('[ws-server] mTLS cert load failed:', e.message);
      server = http.createServer();
    }
  } else {
    server = http.createServer();
  }

  const io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('request', async (message) => {
      try {
        const response = await relayToExpress(message, expressPort);
        socket.emit(`response:${message.correlationId}`, response);
      } catch (err) {
        socket.emit(`response:${message.correlationId}`, {
          statusCode: 502,
          headers: { 'content-type': 'application/json' },
          body: Buffer.from(JSON.stringify({ message: err.message })).toString('base64'),
        });
      }
    });
  });

  server.listen(WS_PORT, () => {
    console.log(`[ws-server] listening on :${WS_PORT}`);
  });

  return io;
};
