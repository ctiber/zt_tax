'use strict';
// Consumes soy-requests from RabbitMQ, proxies to the target microservice, replies via Direct Reply-to.
// The target URL is embedded in each message by the gateway (http://ms-other:8080 or http://ms-exercise:8080,
// or the nginx-sidecar variants when mTLS is active).

const amqp  = require('amqplib');
const https = require('https');
const axios = require('axios');
const fs    = require('fs');

const AMQP_URL    = process.env.AMQP_URL   || 'amqp://guest:guest@rabbitmq:5672';
const CONCURRENCY = parseInt(process.env.PREFETCH || '8', 10);

// mTLS agent – used when the gateway resolves targets to https://nginx-*:8443
let mtlsAgent = null;
if (
  fs.existsSync('/app/certs/gateway.crt') &&
  fs.existsSync('/app/certs/gateway.key') &&
  fs.existsSync('/app/certs/ca.crt')
) {
  mtlsAgent = new https.Agent({
    cert: fs.readFileSync('/app/certs/gateway.crt'),
    key:  fs.readFileSync('/app/certs/gateway.key'),
    ca:   fs.readFileSync('/app/certs/ca.crt'),
    keepAlive: true,
  });
  console.log('[queue-adapter] mTLS agent initialised.');
}

async function main() {
  let conn;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      conn = await amqp.connect(AMQP_URL);
      break;
    } catch {
      console.log(`[queue-adapter] RabbitMQ not ready, retry ${attempt + 1}/15…`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!conn) { console.error('[queue-adapter] Could not connect to RabbitMQ'); process.exit(1); }

  const ch = await conn.createChannel();
  await ch.assertQueue('soy-requests', { durable: false });
  ch.prefetch(CONCURRENCY);

  console.log('[queue-adapter] consuming from soy-requests');

  ch.consume('soy-requests', async (msg) => {
    if (!msg) return;

    const { target, method, path, headers, body } = JSON.parse(msg.content.toString());
    const correlationId = msg.properties.correlationId;
    const replyTo       = msg.properties.replyTo;

    let reply;
    try {
      const fwdHeaders = Object.fromEntries(
        Object.entries(headers || {}).filter(([k]) =>
          !['host', 'content-length', 'transfer-encoding', 'connection'].includes(k.toLowerCase())
        )
      );

      const useHttps = (target || '').startsWith('https://');
      const resp = await axios({
        method:       method || 'GET',
        url:          `${target}${path}`,
        headers:      fwdHeaders,
        data:         body || undefined,
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout:      25_000,
        httpsAgent:   useHttps && mtlsAgent ? mtlsAgent : undefined,
      });

      reply = {
        statusCode: resp.status,
        headers:    resp.headers,
        body:       Buffer.from(resp.data).toString('base64'),
        encoding:   'base64',
      };
    } catch (err) {
      console.error('[queue-adapter] forward error:', err.message);
      reply = { statusCode: 502, headers: {}, body: JSON.stringify({ error: err.message }) };
    }

    ch.publish('', replyTo, Buffer.from(JSON.stringify(reply)), { correlationId });
    ch.ack(msg);
  });
}

main().catch(err => { console.error('[queue-adapter]', err); process.exit(1); });
