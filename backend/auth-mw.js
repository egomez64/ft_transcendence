const fp = require('fastify-plugin');
const jwt = require('jsonwebtoken');
const db = require('./db');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

module.exports = fp(async function authPlugin(fastify) {
  const ACCESS_JWT_SECRET =
    process.env.ACCESS_JWT_SECRET || process.env.JWT_SECRET || 'dev-access';

  fastify.decorate('verifySession', async function verifySession(req, reply) {
    const token = req.cookies?.access;
    if (!token)
      return reply.code(401).send({ ok: false, error: 'Not authenticated' });

    try {
      const payload = jwt.verify(token, ACCESS_JWT_SECRET);
      const user = await dbGet(
        'SELECT id, username, email FROM users WHERE id = ?',
        [payload.uid]
      );
      if (!user)
        return reply.code(401).send({ ok: false, error: 'Not authenticated' });

      req.user = user;

      await dbRun('UPDATE users SET last_seen = ? WHERE id = ?', [
        Math.floor(Date.now() / 1000),
        user.id,
      ]);
    } catch {
      return reply.code(401).send({ ok: false, error: 'Not authenticated' });
    }
  });
});