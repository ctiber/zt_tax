/**
 * gRPC transport server (shared by all microservices).
 *
 * Receives HttpRequest proto messages, replays them as real HTTP requests
 * against the service's own Express app (via localhost), and returns the
 * response as an HttpResponse. The Express routes need no changes.
 *
 * Usage (in service index.js, inside the async IIFE):
 *   const { startGrpcServer } = require('./grpc-server');  // or ./transports/grpc
 *   if (process.env.COM_PATTERN === 'grpc') startGrpcServer(expressPort);
 */
const path   = require('path');
const http   = require('http');
const grpc   = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = process.env.PROTO_PATH || '/app/proto/soy.proto';
const GRPC_PORT  = parseInt(process.env.GRPC_PORT || '50051', 10);

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const { soy: { HttpForward } } = grpc.loadPackageDefinition(packageDef);

// Relay the proto request to the local Express HTTP server
const relayToExpress = (httpRequest, expressPort) =>
  new Promise((resolve, reject) => {
    const qs     = httpRequest.query ? `?${httpRequest.query}` : '';
    const urlStr = `http://localhost:${expressPort}${httpRequest.path}${qs}`;

    const options = {
      method:   httpRequest.method,
      headers:  { ...httpRequest.headers, host: `localhost:${expressPort}` },
    };

    const proxyReq = http.request(urlStr, options, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (c) => chunks.push(c));
      proxyRes.on('end', () => {
        const headers = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          headers[k] = Array.isArray(v) ? v.join(', ') : v;
        }
        resolve({
          status_code: proxyRes.statusCode,
          headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    proxyReq.on('error', reject);
    if (httpRequest.body && httpRequest.body.length > 0) {
      proxyReq.write(httpRequest.body);
    }
    proxyReq.end();
  });

const buildServerCredentials = () => {
  if (process.env.ZT_MTLS !== 'true') return grpc.ServerCredentials.createInsecure();
  const fs = require('fs');
  try {
    // Server presents its cert; requires client cert from CA
    return grpc.ServerCredentials.createSsl(
      fs.readFileSync('/app/certs/ca.crt'),
      [{
        cert_chain:  fs.readFileSync(`/app/certs/${process.env.SERVICE_NAME || 'ms-other'}.crt`),
        private_key: fs.readFileSync(`/app/certs/${process.env.SERVICE_NAME || 'ms-other'}.key`),
      }],
      true, // checkClientCertificate
    );
  } catch (e) {
    console.error('[grpc-server] mTLS cert load failed:', e.message);
    return grpc.ServerCredentials.createInsecure();
  }
};

exports.startGrpcServer = (expressPort) => {
  const server = new grpc.Server();

  server.addService(HttpForward.service, {
    Forward: async (call, callback) => {
      try {
        const response = await relayToExpress(call.request, expressPort);
        callback(null, response);
      } catch (err) {
        console.error('[grpc-server] relay error:', err.message);
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },
  });

  server.bindAsync(`0.0.0.0:${GRPC_PORT}`, buildServerCredentials(), (err, port) => {
    if (err) {
      console.error('[grpc-server] bind failed:', err.message);
      return;
    }
    server.start();
    console.log(`[grpc-server] listening on :${port}`);
  });

  return server;
};
