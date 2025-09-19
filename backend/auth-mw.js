// auth-mw.js
const fp = require('fastify-plugin');
const jwt = require('jsonwebtoken');
const db = require('./db');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

module.exports = fp(async function authPlugin(fastify, opts) {
  // ⚠️ Idéalement mets JWT_SECRET dans .env ; à défaut, même fallback que auth.js
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

  fastify.decorate('verifySession', async function verifySession(req, reply) {
    const token = req.cookies?.session;
    if (!token) {
      reply.code(401).send({ ok: false, error: 'Not authenticated' });
      return;
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await dbGet('SELECT id, username, email FROM users WHERE id = ?', [payload.uid]);
      if (!user) {
        reply.code(401).send({ ok: false, error: 'Not authenticated' });
        return;
      }
      req.user = user;
    } catch (e) {
      reply.code(401).send({ ok: false, error: 'Not authenticated' });
    }
  });
});
