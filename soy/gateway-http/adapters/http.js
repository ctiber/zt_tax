/**
 * HTTP adapter – direct reverse proxy (original behaviour).
 * Uses http-proxy for transparent forwarding including streaming and cookies.
 */
const httpProxy = require('http-proxy');
const { getMtlsAgent } = require('./mtls-agent');

const proxy = httpProxy.createProxyServer();
proxy.on('error', (err, _req, res) => {
  console.error('[adapter:http] proxy error:', err.message);
  if (!res.headersSent) res.status(502).json({ message: 'Service unavailable' });
});

const buildOpts = (target) => {
  const opts = { target };
  const agent = getMtlsAgent(target);
  if (agent) opts.agent = agent;
  return opts;
};

exports.forward = (req, res, { serviceUrl }) => {
  proxy.web(req, res, buildOpts(serviceUrl));
};
