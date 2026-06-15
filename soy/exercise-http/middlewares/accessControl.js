const debug = require("debug")("accessControl");
const jwt   = require("jsonwebtoken");
const auth  = require("./auth");

// ZT_AC4A=true  → Zero Trust: verify JWT signature at this microservice.
//
// ZT_AC4A=false → Baseline: decode JWT (no verify) to populate req.session
//               so controllers can access user_id / role_id.

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

    debug("ZT_AC4A disabled – decoding JWT (no verify) for session data");
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.access_token) {
      try {
        req.session = jwt.decode(cookies.access_token);
        if (req.session && req.session.locale == null) req.session.locale = "en";
        return next();
      } catch (_) { /* fall through */ }
    }

    if (req.headers['x-soy-user-id']) {
      req.session = {
        user_id: parseInt(req.headers['x-soy-user-id'], 10) || undefined,
        role_id: parseInt(req.headers['x-soy-user-role'], 10) || undefined,
        email:   req.headers['x-soy-user-email'] || undefined,
        locale:  "en",
      };
      return next();
    }

    return next();
  },
};
