/**
 * RabbitMQ request-reply consumer (shared by all microservices).
 *
 * Listens on queue soy.{serviceName}.request, relays each message to the
 * local Express app, and publishes the response to the replyTo queue.
 *
 * ZT_BROKER_MTLS=true → connects on amqps:// port 5671 with mutual TLS.
 */
const amqp = require('amqplib');
const http = require('http');
const fs   = require('fs');

const BROKER_MTLS = process.env.ZT_BROKER_MTLS === 'true';
const AMQP_URL = process.env.AMQP_URL || (
  BROKER_MTLS
    ? 'amqps://guest:guest@rabbitmq:5671'
    : 'amqp://guest:guest@rabbitmq:5672'
);
const amqpConnectOptions = BROKER_MTLS ? {
  ca:   [fs.readFileSync('/app/certs/ca.crt')],
  cert: fs.readFileSync('/app/certs/ms-other.crt'),
  key:  fs.readFileSync('/app/certs/ms-other.key'),
  rejectUnauthorized: true,
} : {};

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

exports.startQueueConsumer = async (serviceName, expressPort) => {
  const requestQueue = `soy.${serviceName}.request`;

  for (let i = 0; i < 15; i++) {
    try {
      const conn = await amqp.connect(AMQP_URL, amqpConnectOptions);
      const ch   = await conn.createChannel();
      await ch.assertQueue(requestQueue, { durable: true });
      ch.prefetch(10);

      const tls = BROKER_MTLS ? ' [mTLS]' : '';
      console.log(`[queue-consumer:${serviceName}] connected${tls} → ${AMQP_URL}`);

      ch.consume(requestQueue, async (msg) => {
        if (!msg) return;
        let response;
        try {
          const message = JSON.parse(msg.content.toString());
          response = await relayToExpress(message, expressPort);
        } catch (err) {
          response = {
            statusCode: 502,
            headers: { 'content-type': 'application/json' },
            body: Buffer.from(JSON.stringify({ message: err.message })).toString('base64'),
          };
        }
        try {
          ch.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify(response)),
            { correlationId: msg.properties.correlationId }
          );
          ch.ack(msg);
        } catch (err) {
          // Reply queue gone (gateway timeout) — discard to avoid poison-message loop
          console.error(`[queue-consumer:${serviceName}] reply/ack failed:`, err.message);
          try { ch.nack(msg, false, false); } catch (_) {}
        }
      });

      console.log(`[queue-consumer:${serviceName}] consuming from ${requestQueue}`);
      return;
    } catch (e) {
      console.warn(`[queue-consumer:${serviceName}] connect attempt ${i+1}/15: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error(`[queue-consumer:${serviceName}] could not connect to RabbitMQ`);
};
