'use strict';
/**
 * OpenTelemetry SDK initialisation for soy-ms-other.
 * Required at the top of the cluster worker before any other module.
 */
if (process.env.OTEL_ENABLED !== 'true') return;

const { NodeSDK }                    = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter }           = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource }                    = require('@opentelemetry/resources');

const flags = ['AC4A', 'SR', 'MTLS', 'RA']
  .filter(f => process.env[`ZT_${f}`] === 'true')
  .join('+');

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': process.env.OTEL_SERVICE_NAME || 'soy-ms-other',
    'com.pattern':  process.env.COM_PATTERN || 'http',
    'zt.variant':   flags || 'baseline',
    'zt.ac4a':      process.env.ZT_AC4A  === 'true',
    'zt.sr':        process.env.ZT_SR    === 'true',
    'zt.mtls':      process.env.ZT_MTLS  === 'true',
    'zt.ra':        process.env.ZT_RA    === 'true',
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
