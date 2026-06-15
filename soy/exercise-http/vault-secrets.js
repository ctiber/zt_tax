/**
 * vault-secrets.js – Fetch secrets from HashiCorp Vault (SR primitive).
 *
 * When ZT_SR=true, services call loadSecrets() at startup to replace
 * environment variables with values from Vault.
 * When ZT_SR=false, this is a no-op and env vars are used as-is.
 *
 * The module also schedules periodic renewal so secrets rotate without
 * a container restart (key rotation demonstration).
 */

const https = require('https');
const http  = require('http');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('soy-ms-exercise');

const VAULT_ADDR        = process.env.VAULT_ADDR        || 'http://vault:8200';
const VAULT_TOKEN       = process.env.VAULT_TOKEN       || '';
const VAULT_SECRET_PATH = process.env.VAULT_SECRET_PATH || 'secret/data/soy';
const RENEWAL_INTERVAL  = parseInt(process.env.VAULT_RENEWAL_INTERVAL_MS || '120000', 10); // 2 min

const vaultGet = (path, token) => new Promise((resolve, reject) => {
  const url  = `${VAULT_ADDR}/v1/${path}`;
  const lib  = url.startsWith('https') ? https : http;
  const req  = lib.get(url, { headers: { 'X-Vault-Token': token } }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Vault GET ${path} returned ${res.statusCode}: ${body}`));
      }
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
  });
  req.on('error', reject);
  req.setTimeout(5000, () => { req.destroy(new Error('Vault request timeout')); });
});

const applySecrets = (data) => {
  const { jwt_secret, cookie_secret, db_password, db_user } = data;
  if (jwt_secret)    { process.env.SECRET_JWT       = jwt_secret;    }
  if (cookie_secret) { process.env.COOKIE_SECRET    = cookie_secret; }
  if (db_password)   { process.env.POSTGRES_PASSWORD = db_password;   }
  if (db_user)       { process.env.POSTGRES_USER     = db_user;       }
};

const fetchAndApply = async () => {
  const span = tracer.startSpan('zt.vault.load', {
    attributes: { 'vault.addr': VAULT_ADDR, 'vault.path': VAULT_SECRET_PATH },
  });
  try {
    const json = await vaultGet(VAULT_SECRET_PATH, VAULT_TOKEN);
    const data = json?.data?.data || json?.data || {};
    applySecrets(data);
    console.log('[vault] Secrets refreshed from', VAULT_ADDR);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
};

const loadSecrets = async () => {
  if (process.env.ZT_SR !== 'true') return;

  if (!VAULT_TOKEN) {
    console.warn('[vault] ZT_SR=true but VAULT_TOKEN is not set – skipping');
    return;
  }

  let retries = 0;
  while (retries < 25) {
    try {
      await fetchAndApply();
      // Schedule periodic renewal
      setInterval(async () => {
        try { await fetchAndApply(); }
        catch (e) { console.error('[vault] Renewal failed:', e.message); }
      }, RENEWAL_INTERVAL);
      return;
    } catch (e) {
      retries++;
      console.warn(`[vault] Attempt ${retries}/25 failed: ${e.message}. Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('[vault] Could not reach Vault after 25 attempts – using env vars as fallback');
};

module.exports = { loadSecrets };
