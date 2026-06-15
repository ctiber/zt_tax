/**
 * mTLS agent for gateway→upstream HTTPS connections.
 * keepAlive is enabled to model production service-mesh behaviour (connection
 * pooling). The TLS handshake is amortised across requests; per-request mTLS
 * overhead therefore appears in CPU (symmetric encryption) rather than latency.
 * Certs are read once at first use; one agent is cached per target.
 */
const https = require('https');
const fs    = require('fs');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('soy-gateway');

let certs = null;
const agents = {};

const getMtlsAgent = (target) => {
  if (process.env.ZT_MTLS !== 'true') return undefined;
  if (agents[target]) return agents[target];
  if (!certs) {
    try {
      certs = {
        cert: fs.readFileSync('/app/certs/gateway.crt'),
        key:  fs.readFileSync('/app/certs/gateway.key'),
        ca:   fs.readFileSync('/app/certs/ca.crt'),
      };
    } catch (e) {
      console.error('[mtls-agent] cert load failed:', e.message);
      return undefined;
    }
  }

  const agent = new https.Agent({ ...certs, keepAlive: true });

  const origCreate = agent.createConnection.bind(agent);
  agent.createConnection = (options, cb) => {
    const span = tracer.startSpan('zt.mtls.handshake', {
      attributes: {
        'net.peer.name': options.host || '',
        'net.peer.port': options.port || 443,
      },
    });
    const socket = origCreate(options, cb);
    socket.once('secureConnect', () => {
      span.setAttribute('tls.session.reused', socket.isSessionReused());
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });
    socket.once('error', (err) => {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
    });
    return socket;
  };

  agents[target] = agent;
  return agent;
};

module.exports = { getMtlsAgent };
