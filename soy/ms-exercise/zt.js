'use strict';
// Zero Trust primitives for SoY microservices.
// Activated by env flags ZT_AC4A, ZT_SR, ZT_RA_MS (set via variant .env files).

const jwt  = require('jsonwebtoken');
const axios = require('axios');

const ZT_AC4A  = process.env.ZT_AC4A  === 'true';
const ZT_SR    = process.env.ZT_SR    === 'true';
const ZT_RA_MS = process.env.ZT_RA_MS === 'true';

let JWT_SECRET = process.env.SECRET_JWT || 'your_custom_jwt_secret';

// ── SR: load secrets from Vault at startup ────────────────────────────────────
async function loadVaultSecrets() {
  if (!ZT_SR) return;
  const VAULT_ADDR  = process.env.VAULT_ADDR        || 'http://vault:8200';
  const VAULT_TOKEN = process.env.VAULT_TOKEN        || '';
  const VAULT_PATH  = process.env.VAULT_SECRET_PATH  || 'secret/data/soy';

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const resp = await axios.get(`${VAULT_ADDR}/v1/${VAULT_PATH}`, {
        headers: { 'X-Vault-Token': VAULT_TOKEN },
        timeout: 5000,
      });
      const data = resp.data.data.data;
      if (data.jwt_secret)   JWT_SECRET                    = data.jwt_secret;
      if (data.db_password)  process.env.POSTGRES_PASSWORD = data.db_password;
      if (data.db_user)      process.env.POSTGRES_USER     = data.db_user;
      console.log('[zt] Vault secrets loaded.');
      return;
    } catch (err) {
      console.log(`[zt] Vault not ready, retry ${attempt + 1}/10: ${err.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('[zt] Could not load secrets from Vault after 10 attempts');
}

// ── AC4A: verify JWT on every request at the microservice tier ────────────────
const PUBLIC_PATHS = new Set([
  '/api/user/login',
  '/api/user/register',
  '/api/user/activate',
]);

function verifyJWT(req, res, next) {
  if (!ZT_AC4A || PUBLIC_PATHS.has(req.path)) return next();

  let token = null;
  const cookieHeader = req.headers['cookie'] || '';
  const m = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
  if (m) token = m[1];
  if (!token) {
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }

  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// ── RA at MS tier: call risk-analysis for each request ────────────────────────
const RA_SERVICE_URL = process.env.RA_SERVICE_URL || 'http://risk-analysis:9000';

function normalizePath(p) {
  return p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:id');
}

async function callRA(req, res, next) {
  if (!ZT_RA_MS) return next();

  let userId = 'unknown', userRole = 'unknown';
  try {
    const cookieHeader = req.headers['cookie'] || '';
    const m = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (m) {
      const decoded = jwt.decode(m[1]);
      userId   = String(decoded?.user_id || 'unknown');
      userRole = String(decoded?.role_id || 'unknown');
    }
  } catch {}

  try {
    // Do NOT send ip: the microservice sees the proxy/sidecar IP, not the real
    // client IP. IP-change detection is handled at the gateway level only.
    const resp = await axios.post(`${RA_SERVICE_URL}/analyze`, {
      userId, userRole,
      method: req.method,
      path:   normalizePath(req.path),
    }, { timeout: 5000 });
    if (resp.data?.block === true) {
      return res.status(403).json({ error: 'blocked by risk analysis' });
    }
    next();
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 || status === 403) {
      return res.status(403).json({ error: 'blocked by risk analysis' });
    }
    next();
  }
}

module.exports = { loadVaultSecrets, verifyJWT, callRA };
