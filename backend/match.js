// match.js
const bcrypt = require('bcrypt');
const db = require('./db');

async function matchRoutes(fastify) {
  fastify.post('/local', { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const p1 = req.user; // fourni par verifySession
      if (!p1?.id) return reply.code(401).send({ ok:false, error:'PLAYER1_NOT_AUTHENTICATED' });

      const { username, password } = req.body || {};
      if (!username || !password) return reply.code(400).send({ ok:false, error:'MISSING_CREDENTIALS' });

      // sqlite3 style
      const user2 = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (!user2) return reply.code(400).send({ ok:false, error:'PLAYER2_NOT_FOUND' });

      // ⚠️ la colonne est "password" (déjà hashée à l'inscription)
      const ok = await bcrypt.compare(password, user2.password || '');
      if (!ok) return reply.code(400).send({ ok:false, error:'PLAYER2_INVALID_PASSWORD' });

      if (user2.id === p1.id) return reply.code(400).send({ ok:false, error:'CANNOT_PLAY_WITH_SELF' });

      const info = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO matches (player1_id, player2_id, status) VALUES (?, ?, 'pending')`,
          [p1.id, user2.id],
          function (err) { if (err) reject(err); else resolve(this); }
        );
      });

      return reply.send({
        ok: true,
        match_id: info.lastID,
        player1: { id: p1.id, username: p1.username },
        player2: { id: user2.id, username: user2.username },
      });
    } catch (err) {
      req.log?.error?.({ at: 'match/local', err: err?.message || err });
      return reply.code(500).send({ ok:false, error:'MATCH_CREATION_FAILED' });
    }
  });
}

module.exports = matchRoutes;
