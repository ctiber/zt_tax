/**
 * Microservice-level Risk Analysis middleware (ZT_RA_MS).
 *
 * When ZT_RA_MS=true, each request processed by this microservice — including
 * messages dequeued from RabbitMQ/Kafka — is submitted to the RA service.
 * This breaks communication-pattern independence: for async transports the RA
 * call happens at consumption time rather than at the gateway.
 *
 * Fails open: a network error reaching the RA service is logged but does not
 * block the request, matching the gateway's fail-open behaviour.
 */
const axios  = require('axios');
const { trace, SpanStatusCode } = require('@opentelemetry/api');

const tracer   = trace.getTracer(process.env.OTEL_SERVICE_NAME || 'soy-ms-exercise');
const RA_URL   = process.env.RA_SERVICE_URL || 'http://risk-analysis:9000';

module.exports = async function riskAnalysisMs(req, res, next) {
  if (process.env.ZT_RA_MS !== 'true') return next();

  const span = tracer.startSpan('zt.risk_analysis');
  try {
    const { data } = await axios.post(`${RA_URL}/analyze`, {
      method:   req.method,
      path:     req.path,
      userId:   req.headers['x-soy-user-id']   || (req.session && String(req.session.user_id  ?? '')) || '',
      userRole: req.headers['x-soy-user-role']  || (req.session && String(req.session.role_id  ?? '')) || '',
      ip:       req.ip,
      timestamp: Date.now(),
    }, { timeout: 500 });

    span.setAttribute('ra.blocked', !!data?.block);
    if (data?.block) span.setAttribute('ra.reason', data.reason || '');
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    if (data?.block) {
      return res.status(403).json({ message: 'Blocked by RA', reason: data.reason });
    }
  } catch (_) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'fail-open' });
    span.end();
  }
  next();
};
