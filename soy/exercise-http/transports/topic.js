/**
 * Kafka topic consumer (shared by all microservices).
 *
 * Consumes from soy.{serviceName}.requests, relays to local Express,
 * produces response to soy.{serviceName}.responses with correlationId header.
 *
 * ZT_BROKER_MTLS=true → connects to Kafka SSL listener on port 9093.
 */
const { Kafka } = require('kafkajs');
const http = require('http');
const fs   = require('fs');

const BROKER_MTLS   = process.env.ZT_BROKER_MTLS === 'true';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || (BROKER_MTLS ? 'kafka:9093' : 'kafka:9092')).split(',');
const kafkaSsl = BROKER_MTLS ? {
  ca:   [fs.readFileSync('/app/certs/ca.crt')],
  cert: fs.readFileSync('/app/certs/ms-exercise.crt'),
  key:  fs.readFileSync('/app/certs/ms-exercise.key'),
  rejectUnauthorized: true,
} : false;

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
        resolve({ statusCode: res.statusCode, headers: resHeaders, body: Buffer.concat(chunks).toString('base64') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

exports.startTopicConsumer = async (serviceName, expressPort) => {
  const requestTopic  = `soy.${serviceName}.requests`;
  const responseTopic = `soy.${serviceName}.responses`;
  const groupId       = `soy-${serviceName}`;

  const kafka    = new Kafka({ clientId: `soy-${serviceName}`, brokers: KAFKA_BROKERS, ssl: kafkaSsl });
  const consumer = kafka.consumer({ groupId });
  const producer = kafka.producer();

  for (let i = 0; i < 20; i++) {
    try {
      await producer.connect();
      await consumer.connect();
      await consumer.subscribe({ topic: requestTopic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ message }) => {
          const correlationId = message.headers?.correlationId?.toString();
          let response;
          try {
            const payload = JSON.parse(message.value.toString());
            response = await relayToExpress(payload, expressPort);
          } catch (err) {
            response = {
              statusCode: 502,
              headers: { 'content-type': 'application/json' },
              body: Buffer.from(JSON.stringify({ message: err.message })).toString('base64'),
            };
          }
          try {
            await producer.send({
              topic: responseTopic,
              messages: [{ key: correlationId, value: JSON.stringify(response), headers: { correlationId } }],
            });
          } catch (err) {
            // Log and swallow — rethrowing would block eachMessage and stall the consumer
            console.error(`[topic-consumer:${serviceName}] response produce failed:`, err.message);
          }
        },
      });

      const tls = BROKER_MTLS ? ' [mTLS]' : '';
      console.log(`[topic-consumer:${serviceName}] connected${tls} → ${KAFKA_BROKERS.join(',')} | consuming ${requestTopic}`);
      return;
    } catch (e) {
      console.warn(`[topic-consumer:${serviceName}] attempt ${i+1}/20: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error(`[topic-consumer:${serviceName}] could not connect to Kafka`);
};
