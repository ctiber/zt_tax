/**
 * gRPC adapter – HTTP/2 + Protobuf forwarding.
 *
 * Converts each incoming HTTP request into an HttpRequest proto message,
 * calls the Forward RPC on the target microservice, converts the response
 * back to HTTP. Existing Express routes in microservices are unchanged.
 *
 * Measures: gRPC framing overhead, Protobuf serialization, HTTP/2 connection
 * reuse, and (when ZT_MTLS=true) mTLS channel credentials.
 */
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = process.env.PROTO_PATH || '/app/proto/soy.proto';
const GRPC_PORT  = process.env.GRPC_PORT || 50051;

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const { soy: { HttpForward } } = grpc.loadPackageDefinition(packageDef);

// gRPC channel credentials
const buildCredentials = () => {
  if (process.env.ZT_MTLS !== 'true') return grpc.credentials.createInsecure();
  const fs = require('fs');
  try {
    return grpc.credentials.createSsl(
      fs.readFileSync('/app/certs/ca.crt'),
      fs.readFileSync('/app/certs/gateway.key'),
      fs.readFileSync('/app/certs/gateway.crt'),
    );
  } catch (e) {
    console.error('[adapter:grpc] mTLS cert load failed:', e.message);
    return grpc.credentials.createInsecure();
  }
};

// Map serviceUrl → gRPC stub (one persistent channel per service)
const stubs = {};
const getStub = (serviceUrl) => {
  if (stubs[serviceUrl]) return stubs[serviceUrl];
  // gRPC bypasses the Nginx mTLS sidecar; map nginx-* → ms-* to reach the gRPC server directly
  const rawHost = new URL(serviceUrl).hostname;
  const host = rawHost.replace(/^nginx-/, 'ms-');
  const target = `${host}:${GRPC_PORT}`;
  stubs[serviceUrl] = new HttpForward(target, buildCredentials());
  console.log(`[adapter:grpc] channel → ${target}`);
  return stubs[serviceUrl];
};

exports.forward = (req, res, { serviceUrl }) => {
  const stub = getStub(serviceUrl);

  // Collect request body
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    // Flatten multi-value headers to single strings for proto map<string,string>
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k] = Array.isArray(v) ? v.join(', ') : v;
    }

    const request = {
      method:  req.method,
      path:    req.path,
      query:   req.url.includes('?') ? req.url.split('?')[1] : '',
      headers,
      body,
    };

    stub.Forward(request, (err, response) => {
      if (err) {
        console.error('[adapter:grpc] RPC error:', err.message);
        return res.status(502).json({ message: 'gRPC service unavailable', detail: err.message });
      }
      // Restore response headers
      for (const [k, v] of Object.entries(response.headers || {})) {
        // Skip headers that would cause issues when set manually
        if (!['transfer-encoding', 'content-length'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      }
      res.status(response.status_code || 200).send(Buffer.from(response.body));
    });
  });
};
