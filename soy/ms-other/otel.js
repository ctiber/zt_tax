'use strict';
if (process.env.OTEL_ENABLED !== 'true') return;

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'soy-ms-other',
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318'}/v1/traces`,
  }),
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs':  { enabled: false },
    '@opentelemetry/instrumentation-pg':  { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
  })],
});
sdk.start();
