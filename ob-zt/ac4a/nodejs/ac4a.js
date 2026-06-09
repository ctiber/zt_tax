'use strict';

const jwt = require('jsonwebtoken');

const ZT_AC4A = process.env.ZT_AC4A === 'true';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function _verify(call) {
  const vals = call.metadata.get('authorization');
  const auth = vals && vals[0];
  if (!auth || !auth.startsWith('Bearer ')) {
    const err = new Error('missing bearer token');
    err.code = 16; // UNAUTHENTICATED
    return err;
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    return null;
  } catch (e) {
    const err = new Error(e.message);
    err.code = 16;
    return err;
  }
}

function wrapService(impl) {
  if (!ZT_AC4A) return impl;
  const wrapped = {};
  for (const method of Object.keys(impl)) {
    const orig = impl[method];
    wrapped[method] = function (call, callback) {
      const err = _verify(call);
      if (err) {
        if (callback) return callback(err);
        call.destroy(err);
        return;
      }
      return orig.call(this, call, callback);
    };
  }
  return wrapped;
}

module.exports = { wrapService };
