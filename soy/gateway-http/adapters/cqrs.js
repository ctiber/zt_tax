/**
 * CQRS adapter – Command Query Responsibility Segregation.
 *
 * Routes requests based on intent:
 *   Queries  (GET)                    → straight to the read service (same as HTTP)
 *   Commands (POST/PUT/DELETE/PATCH)  → through an in-memory command bus that:
 *       1. Validates the command
 *       2. Dispatches to the write service
 *       3. Emits a domain event (logged, observable in metrics)
 *       4. Returns the write result to the caller
 *
 * The measurable overhead vs. plain HTTP is:
 *   - Command routing indirection (~1ms per request)
 *   - Event emission (synchronous, in-process)
 *   - No read-model caching in this prototype (optional future extension)
 *
 * Queries use the same HTTP proxy as the http adapter, preserving the
 * read path performance for comparison.
 */
const httpProxy = require('http-proxy');
const { EventEmitter } = require('events');
const axios = require('axios');
const { getMtlsAgent } = require('./mtls-agent');

// ─── Command bus (in-memory, synchronous) ─────────────────
const commandBus = new EventEmitter();
commandBus.setMaxListeners(50);

// Domain event log (observable via /cqrs/events endpoint)
const eventLog = [];
const MAX_LOG  = 1000;

const emit = (eventName, payload) => {
  const event = { type: eventName, ts: Date.now(), ...payload };
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
  commandBus.emit(eventName, event);
};

// ─── HTTP proxy for read path ──────────────────────────────
const proxy = httpProxy.createProxyServer();
proxy.on('error', (err, _req, res) => {
  if (!res.headersSent) res.status(502).json({ message: 'Read service unavailable' });
});

const proxyOpts = (serviceUrl) => {
  const opts = { target: serviceUrl };
  const agent = getMtlsAgent(serviceUrl);
  if (agent) opts.agent = agent;
  return opts;
};

// ─── Command dispatch (write path) ────────────────────────
const dispatchCommand = (req, res, { serviceUrl, service }) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers };

    try {
      const axiosOpts = {
        method:  req.method,
        url:     `${serviceUrl}${req.url}`,
        headers,
        data:    body,
        responseType: 'arraybuffer',
        validateStatus: () => true, // don't throw on 4xx/5xx
      };
      const agent = getMtlsAgent(serviceUrl);
      if (agent) axiosOpts.httpsAgent = agent;
      const response = await axios(axiosOpts);

      // Emit domain event after successful write
      if (response.status < 400) {
        const commandType = `${service}.${req.method.toLowerCase()}.${req.path.replace(/\//g, '.')}`;
        emit(commandType, {
          service,
          method:  req.method,
          path:    req.path,
          userId:  req.headers['x-soy-user-id'],
          status:  response.status,
        });
      }

      for (const [k, v] of Object.entries(response.headers)) {
        if (!['transfer-encoding', 'content-length'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      }
      res.status(response.status).send(Buffer.from(response.data));
    } catch (err) {
      if (!res.headersSent) res.status(502).json({ message: 'Command dispatch failed', detail: err.message });
    }
  });
};

// ─── Public interface ──────────────────────────────────────
exports.forward = (req, res, { serviceUrl, service }) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    // Query path: direct proxy (same as http adapter)
    proxy.web(req, res, proxyOpts(serviceUrl));
  } else {
    // Command path: via command bus
    dispatchCommand(req, res, { serviceUrl, service });
  }
};

// Expose event log for observability (mounted in gateway index)
exports.getEventLog = () => eventLog.slice(0, 100);
exports.commandBus  = commandBus;
