'use strict';
// Consumes ob-requests from RabbitMQ, proxies to OB frontend, replies via Direct Reply-to.

const amqp  = require('amqplib');
const axios = require('axios');

const AMQP_URL      = process.env.AMQP_URL     || 'amqp://guest:guest@rabbitmq:5672';
const FRONTEND_URL  = process.env.FRONTEND_URL  || 'http://frontend:8081';
const CONCURRENCY   = parseInt(process.env.PREFETCH || '4');

async function main() {
  let conn;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      conn = await amqp.connect(AMQP_URL);
      break;
    } catch {
      console.log(`[queue-adapter] RabbitMQ not ready, retry ${attempt + 1}/10...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!conn) { console.error('[queue-adapter] Could not connect to RabbitMQ'); process.exit(1); }

  const ch = await conn.createChannel();
  await ch.assertQueue('ob-requests', { durable: false });
  ch.prefetch(CONCURRENCY);

  console.log(`[queue-adapter] consuming from ob-requests  frontend=${FRONTEND_URL}`);

  ch.consume('ob-requests', async (msg) => {
    if (!msg) return;
    const { correlationId, method, path, headers, body } = JSON.parse(msg.content.toString());
    const replyTo = msg.properties.replyTo;
    let reply;
    try {
      const fwdHeaders = Object.fromEntries(
        Object.entries(headers || {}).filter(([k]) =>
          !['host', 'content-length', 'transfer-encoding', 'connection'].includes(k.toLowerCase())
        )
      );
      const resp = await axios({
        method: method || 'GET',
        url: `${FRONTEND_URL}${path}`,
        headers: { ...fwdHeaders, host: 'frontend' },
        data: body || undefined,
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 25_000,
      });
      reply = {
        statusCode: resp.status,
        headers:    resp.headers,
        body:       Buffer.from(resp.data).toString('base64'),
        encoding:   'base64',
      };
    } catch (err) {
      reply = { statusCode: 502, headers: {}, body: `{"error":"${err.message}"}` };
    }

    // Reply directly to the gateway connection — no shared ob-responses queue
    ch.publish('', replyTo, Buffer.from(JSON.stringify(reply)), { correlationId });
    ch.ack(msg);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
