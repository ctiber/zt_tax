/**
 * Topic adapter – Kafka publish-subscribe.
 *
 * Commands (POST/PUT/DELETE) and queries (GET) are produced to the topic
 * soy.{service}.requests. Each message carries a correlationId header.
 * The gateway subscribes to soy.{service}.responses and matches replies
 * by correlationId. Four broker hops per request (produce → consume →
 * produce → consume), similar overhead profile to the queue adapter but
 * with Kafka's partitioned log semantics.
 *
 * ZT_BROKER_MTLS=true → connects to Kafka SSL listener on port 9093 with
 * mutual TLS, making mTLS overhead measurable for the topic pattern.
 */
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const BROKER_MTLS   = process.env.ZT_BROKER_MTLS === 'true';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || (BROKER_MTLS ? 'kafka:9093' : 'kafka:9092')).split(',');
const TOPIC_TIMEOUT  = parseInt(process.env.TOPIC_TIMEOUT_MS || '15000', 10);
const CONSUMER_GROUP = process.env.KAFKA_GATEWAY_GROUP || 'soy-gateway';

const kafkaSsl = BROKER_MTLS ? {
  ca:   [fs.readFileSync('/app/certs/ca.crt')],
  cert: fs.readFileSync('/app/certs/gateway.crt'),
  key:  fs.readFileSync('/app/certs/gateway.key'),
  rejectUnauthorized: true,
} : false;

const kafka    = new Kafka({ clientId: 'soy-gateway', brokers: KAFKA_BROKERS, ssl: kafkaSsl });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });

const pendingReplies = new Map(); // correlationId → { resolve, reject, timer }

exports.connect = async () => {
  for (let i = 0; i < 20; i++) {
    try {
      await producer.connect();
      await consumer.connect();

      // Subscribe to ALL service response topics at startup
      await consumer.subscribe({ topics: ['soy.exercise.responses', 'soy.other.responses'], fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ message }) => {
          const correlationId = message.headers?.correlationId?.toString();
          const pending = correlationId && pendingReplies.get(correlationId);
          if (!pending) return;
          clearTimeout(pending.timer);
          pendingReplies.delete(correlationId);
          try {
            pending.resolve(JSON.parse(message.value.toString()));
          } catch (e) {
            pending.reject(e);
          }
        },
      });

      const tls = BROKER_MTLS ? ' [mTLS]' : '';
      console.log(`[adapter:topic] Kafka connected${tls} → ${KAFKA_BROKERS.join(',')}`);
      return;
    } catch (e) {
      console.warn(`[adapter:topic] connect attempt ${i+1}/20: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('[adapter:topic] Could not connect to Kafka after 20 attempts');
};

exports.forward = async (req, res, { service }) => {
  const correlationId = uuidv4();
  const requestTopic  = `soy.${service}.requests`;
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

    try {
      await producer.send({
        topic: requestTopic,
        messages: [{
          key:   correlationId,
          value: JSON.stringify(message),
          headers: { correlationId },
        }],
      });
    } catch (err) {
      return res.status(502).json({ message: 'Kafka produce failed', detail: err.message });
    }

    const timer = setTimeout(() => {
      pendingReplies.delete(correlationId);
      if (!res.headersSent) res.status(504).json({ message: 'Kafka response timeout' });
    }, TOPIC_TIMEOUT);

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
