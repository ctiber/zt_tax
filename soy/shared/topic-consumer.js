/**
 * Kafka topic consumer (shared by all microservices).
 *
 * Consumes from soy.{serviceName}.requests, relays to local Express,
 * produces response to soy.{serviceName}.responses with correlationId header.
 */
const { Kafka } = require('kafkajs');
const http = require('http');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');

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

  const kafka    = new Kafka({ clientId: `soy-${serviceName}`, brokers: KAFKA_BROKERS });
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
          await producer.send({
            topic: responseTopic,
            messages: [{ key: correlationId, value: JSON.stringify(response), headers: { correlationId } }],
          });
        },
      });

      console.log(`[topic-consumer:${serviceName}] consuming ${requestTopic}`);
      return;
    } catch (e) {
      console.warn(`[topic-consumer:${serviceName}] attempt ${i+1}/20: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error(`[topic-consumer:${serviceName}] could not connect to Kafka`);
};
