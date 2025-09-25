// backend/game/tournament.js
const bcrypt = require('bcrypt');
const db = require('../db');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function tournamentRoutes(fastify, opts) {
  // POST /api/tournament/login
  fastify.post('/login', async (req, reply) => {
    try {
      let { username, password } = req.body || {};
      username = String(username || '').trim();
      password = String(password || '');

      if (!username || !password) {
        return reply.code(400).send({
          ok: false,
          error_key: 'tournament.errors.missing_credentials',
        });
      }

      const u = username.includes('@') ? username.toLowerCase() : username;

      const user = await dbGet(
        'SELECT id, username, email, password FROM users WHERE username = ? OR email = ?',
        [u, u]
      );

      if (!user) {
        return reply.code(400).send({ ok: false, error_key: 'login.invalid_credentials' });
      }

      const ok = await bcrypt.compare(password, user.password || '');
      if (!ok) {
        return reply.code(400).send({ ok: false, error_key: 'login.invalid_credentials' });
      }

      // Pas de session/cookie ici : on renvoie juste un mini profil
      const userMini = { id: user.id, username: user.username, email: user.email };
      return reply.send({ ok: true, user: userMini });
    } catch (err) {
      req.log?.error?.({ at: 'tournament/login', err: err?.message || err });
      return reply.code(500).send({ ok: false, error: 'INTERNAL_ERROR' });
    }
  });
}

module.exports = tournamentRoutes;
