/**
 * Queue adapter – AMQP request-reply via RabbitMQ.
 *
 * For each HTTP request, the gateway:
 *   1. Publishes to queue  soy.{service}.request
 *   2. Waits for reply on  soy.{service}.response.{correlationId}
 *
 * The microservice consumes from the request queue, processes via its Express
 * app, and publishes to the reply queue. Four broker hops per request —
 * this is the key overhead difference from synchronous patterns.
 *
 * ZT_BROKER_MTLS=true → connects on amqps:// port 5671 with mutual TLS,
 * using the same CA/cert infrastructure as the nginx mTLS sidecar.
 */
const amqp    = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const fs      = require('fs');

const BROKER_MTLS = process.env.ZT_BROKER_MTLS === 'true';
const AMQP_URL  = process.env.AMQP_URL || (
  BROKER_MTLS
    ? 'amqps://guest:guest@rabbitmq:5671'
    : 'amqp://guest:guest@rabbitmq:5672'
);
const RPC_TIMEOUT = parseInt(process.env.QUEUE_TIMEOUT_MS || '10000', 10);

const amqpConnectOptions = BROKER_MTLS ? {
  ca:   [fs.readFileSync('/app/certs/ca.crt')],
  cert: fs.readFileSync('/app/certs/gateway.crt'),
  key:  fs.readFileSync('/app/certs/gateway.key'),
  rejectUnauthorized: true,
} : {};

let channel;
const pendingReplies = new Map(); // correlationId → { resolve, reject, timer }

const connect = async () => {
  const conn = await amqp.connect(AMQP_URL, amqpConnectOptions);
  conn.on('error', (e) => console.error('[adapter:queue] AMQP connection error:', e.message));
  channel = await conn.createChannel();

  // Single shared reply queue for all responses (exclusive, auto-delete)
  const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });

  channel.consume(replyQueue, (msg) => {
    if (!msg) return;
    const correlationId = msg.properties.correlationId;
    const pending = pendingReplies.get(correlationId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingReplies.delete(correlationId);
    try {
      pending.resolve(JSON.parse(msg.content.toString()));
    } catch (e) {
      pending.reject(e);
    }
    channel.ack(msg);
  }, { noAck: false });

  const tls = BROKER_MTLS ? ' [mTLS]' : '';
  console.log(`[adapter:queue] AMQP connected${tls} → ${AMQP_URL} | replyQueue=${replyQueue}`);

  // Store reply queue name for use in forward()
  channel._replyQueue = replyQueue;
};

exports.connect = async ({ exerciseUrl, otherUrl }) => {
  // Retry loop – RabbitMQ may not be up yet
  for (let i = 0; i < 15; i++) {
    try { await connect(); return; } catch (e) {
      console.warn(`[adapter:queue] connect attempt ${i+1}/15 failed: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('[adapter:queue] Could not connect to RabbitMQ after 15 attempts');
};

exports.forward = (req, res, { service }) => {
  if (!channel) return res.status(503).json({ message: 'AMQP not connected' });

  const correlationId = uuidv4();
  const requestQueue  = `soy.${service}.request`;
  const chunks = [];

  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k] = Array.isArray(v) ? v.join(', ') : v;
    }

    const message = {
      method: req.method,
      path:   req.url,
      headers,
      body:   Buffer.concat(chunks).toString('base64'),
    };

    // Ensure the request queue exists (idempotent)
    await channel.assertQueue(requestQueue, { durable: true });

    channel.sendToQueue(
      requestQueue,
      Buffer.from(JSON.stringify(message)),
      { correlationId, replyTo: channel._replyQueue, persistent: false }
    );

    const timer = setTimeout(() => {
      pendingReplies.delete(correlationId);
      if (!res.headersSent) res.status(504).json({ message: 'Queue request timeout' });
    }, RPC_TIMEOUT);

    pendingReplies.set(correlationId, {
      resolve: ({ statusCode, headers: resHeaders, body }) => {
        for (const [k, v] of Object.entries(resHeaders || {})) {
          if (!['transfer-encoding', 'content-length'].includes(k.toLowerCase())) {
            res.setHeader(k, v);
          }
        }
        res.status(statusCode || 200).send(Buffer.from(body || '', 'base64'));
      },
      reject: (err) => {
        if (!res.headersSent) res.status(502).json({ message: err.message });
      },
      timer,
    });
  });
};
