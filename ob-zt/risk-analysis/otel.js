'use strict';
/**
 * OpenTelemetry SDK initialisation for soy-risk-analysis.
 * Required before express so HTTP routes are auto-instrumented.
 */
if (process.env.OTEL_ENABLED !== 'true') return;

const { NodeSDK }                    = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter }           = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource }                    = require('@opentelemetry/resources');

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': process.env.OTEL_SERVICE_NAME || 'soy-risk-analysis',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318'}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs':  { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();
console.log('[otel] tracing → ' + (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318'));
process.on('SIGTERM', () => sdk.shutdown());
