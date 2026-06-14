/**
 * Risk Analysis (RA) service – Zero Trust primitive
 *
 * Receives request metadata from the API gateway and returns an allow/block
 * decision. Designed to detect lateral movement patterns:
 *
 *   1. Rapid service-hopping   – same user hitting many distinct routes quickly
 *   2. Privilege escalation    – student-role user accessing admin/instructor routes
 *   3. Rate limiting           – per-user RPM cap
 *   4. IP change               – same userId seen from a different IP mid-session
 *                                (session hijacking / credential theft indicator)
 *
 * All analysis uses an in-memory sliding window (stateless across restarts).
 * In a production deployment this would be backed by Redis.
 */

require('./otel'); // must be first — patches express HTTP spans
const express = require('express');
const app = express();
app.use(express.json());

const promClient = require('prom-client');
promClient.collectDefaultMetrics();
const raDurationHistogram = new promClient.Histogram({
  name: 'zt_ra_duration_seconds',
  help: 'Risk Analysis /analyze call duration in seconds',
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
});

const PORT              = parseInt(process.env.PORT              || '9000', 10);
const WINDOW_MS         = parseInt(process.env.ALERT_WINDOW_MS  || '60000', 10);  // 1 min
const LATERAL_THRESHOLD = parseInt(process.env.LATERAL_MOVE_THRESHOLD || '10', 10); // distinct routes/min
const RATE_LIMIT_RPM    = parseInt(process.env.RATE_LIMIT_RPM   || '120', 10);

// ─── Per-user sliding window tracking ────────────────────
// Structure: { [userId]: { requests: [{ts, path, method}], blockedUntil: number, lastIp: string|null } }
const userState = new Map();

// ─── Admin routes that only admin (role 1) may access ────
const ADMIN_ROUTES = [
  '/api/admin', '/api/users',
];
// Instructor routes: role ≤ 2
const INSTRUCTOR_ROUTES = [
  '/api/exercises', '/api/exercise/', '/api/plage-session',
  '/api/sequence', '/api/skills',
];

const getOrCreate = (userId) => {
  if (!userState.has(userId)) userState.set(userId, { requests: [], blockedUntil: 0, lastIp: null });
  return userState.get(userId);
};

const purgeOld = (requests, now) =>
  requests.filter(r => (now - r.ts) < WINDOW_MS);

// ─── Analysis logic ────────────────────────────────────────
const analyze = ({ method, path, userId, userRole, ip, timestamp }) => {
  const now = timestamp || Date.now();

  // ── Privilege escalation detection ─────────────────────
  const role = parseInt(userRole || '99', 10); // 99 = unknown/unauthenticated

  if (ADMIN_ROUTES.some(r => path.startsWith(r)) && role > 1) {
    return block('privilege-escalation', `Role ${role} accessing admin route ${path}`);
  }
  if (INSTRUCTOR_ROUTES.some(r => path.startsWith(r)) && method !== 'GET' && role > 2) {
    return block('privilege-escalation', `Student role attempting write on ${path}`);
  }

  // ── Per-user rate + lateral movement + IP change ───────
  if (userId) {
    const state = getOrCreate(userId);

    const wasBlocked = state.blockedUntil !== 0;
    if (state.blockedUntil > now) return block('blocked-user', 'User previously flagged');
    // Block TTL just expired: reset IP anchor so a legitimate network change is accepted
    if (wasBlocked) state.lastIp = null;
    state.blockedUntil = 0;

    // IP-change detection: same userId, different IP within the session window
    if (ip && state.lastIp && state.lastIp !== ip) {
      state.blockedUntil = now + 5 * WINDOW_MS;
      console.warn(`[RA] IP-CHANGE userId=${userId} from=${state.lastIp} to=${ip}`);
      return block('ip-change', `Session IP changed from ${state.lastIp} to ${ip}`);
    }
    if (ip) state.lastIp = ip;

    state.requests = purgeOld(state.requests, now);
    state.requests.push({ ts: now, path, method });

    // Rate limit
    if (state.requests.length > RATE_LIMIT_RPM) {
      state.blockedUntil = now + 5 * WINDOW_MS;
      console.warn(`[RA] RATE-LIMIT userId=${userId} rpm=${state.requests.length}`);
      return block('rate-limit', `User exceeded ${RATE_LIMIT_RPM} rpm`);
    }

    // Lateral movement: many distinct routes in the window
    const distinctRoutes = new Set(state.requests.map(r => r.path)).size;
    if (distinctRoutes > LATERAL_THRESHOLD) {
      state.blockedUntil = now + 5 * WINDOW_MS;
      console.warn(`[RA] LATERAL-MOVEMENT userId=${userId} distinctRoutes=${distinctRoutes}`);
      return block('lateral-movement', `Accessed ${distinctRoutes} distinct routes in ${WINDOW_MS}ms`);
    }
  }

  return allow();
};

const allow  = ()             => ({ block: false });
const block  = (type, reason) => {
  console.warn(`[RA] BLOCK type=${type} reason=${reason}`);
  return { block: true, type, reason };
};

// ─── Routes ────────────────────────────────────────────────
app.post('/analyze', (req, res) => {
  const end = raDurationHistogram.startTimer();
  try {
    const result = analyze(req.body);
    res.json(result);
  } catch (e) {
    res.json({ block: false });
  } finally {
    end();
  }
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.get('/health', (_req, res) => res.json({ status: 'ok', users: userState.size }));

app.get('/stats', (_req, res) => {
  const now = Date.now();
  const stats = {};
  for (const [uid, state] of userState.entries()) {
    stats[uid] = {
      requests:     state.requests.length,
      lastIp:       state.lastIp,
      blockedUntil: state.blockedUntil,
      blocked:      state.blockedUntil > now,
    };
  }
  res.json(stats);
});

// ─── Periodic cleanup of stale entries ───────────────────
setInterval(() => {
  const now = Date.now();
  for (const [uid, state] of userState.entries()) {
    state.requests = purgeOld(state.requests, now);
    if (state.requests.length === 0 && state.blockedUntil <= now) userState.delete(uid);
  }
}, WINDOW_MS);

app.listen(PORT, () => {
  console.log(`[risk-analysis] :${PORT} | window=${WINDOW_MS}ms rate=${RATE_LIMIT_RPM}rpm lateral=${LATERAL_THRESHOLD} routes`);
});
