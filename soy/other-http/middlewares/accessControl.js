const debug = require("debug")("accessControl");
const jwt   = require("jsonwebtoken");
const auth  = require("./auth");

// ZT_AC4A=true  → Zero Trust: verify JWT signature at this microservice.
//               Don't trust the gateway blindly.
//
// ZT_AC4A=false → Baseline (implicit trust): the gateway already verified
//               the JWT. We decode it here WITHOUT re-checking the signature
//               so that controllers can still read req.session (user_id, role_id, …).
//               A bypassed gateway would need a valid-looking JWT, but its
//               signature is not re-checked — that is the measured security gap.

const parseCookies = (header) => {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    acc[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    return acc;
  }, {});
};

module.exports = {
  checkConnection: async function (req, res, next) {
    if (process.env.ZT_AC4A === 'true') {
      debug("ZT_AC4A enabled – verifying JWT at service level");
      return auth.isAuth(req, res, next);
    }

    // Baseline: populate req.session without signature verification.
    // Priority 1: decode the access_token cookie (trusted from gateway)
    debug("ZT_AC4A disabled – decoding JWT (no verify) for session data");
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.access_token) {
      try {
        req.session = jwt.decode(cookies.access_token);
        if (req.session && req.session.locale == null) req.session.locale = "en";
        return next();
      } catch (_) { /* fall through */ }
    }

    // Priority 2: use identity headers forwarded by the gateway
    if (req.headers['x-soy-user-id']) {
      req.session = {
        user_id: parseInt(req.headers['x-soy-user-id'], 10) || undefined,
        role_id: parseInt(req.headers['x-soy-user-role'], 10) || undefined,
        email:   req.headers['x-soy-user-email'] || undefined,
        locale:  "en",
      };
      return next();
    }

    // No token at all – controllers that need req.session will fail naturally
    return next();
  },
};
