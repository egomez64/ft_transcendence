const db = require('./db');
const { replyError } = require('./i18n_errors');

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

function validateAlias(alias) {
  const a = String(alias || '').trim();

  if (a.length < 2 || a.length > 24) {
    return {
      ok: false,
      errors: ['alias.length']
    };
  }

  return { ok: true, value: a };
}

function validateUsername(username) {
  const errors = [];
  const u = String(username || '').trim();

  if (!u) errors.push('username.required');
  // 3–20 caractères, alphanum + . _ - (mêmes règles que profil)
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(u)) {
    errors.push('username.format');
  }
  return { ok: errors.length === 0, value: u, errors };
}

async function usersRoutes(fastify) {
  // PUT /api/users/:id  -> met à jour username/alias/avatar_url
  fastify.put('/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) return replyError(reply, 'INVALID_USER_ID');

    const { username, alias, avatar_url } = request.body || {};

    // validations simples
    const user = validateUsername(username);
    if (!user.ok)
      return reply.code(400).send({ ok:false, error_key: 'auth.invalid_username', details: user.errors });

    const ali = validateAlias(alias);
    if (!ali.ok)
      return reply.code(400).send({ ok: false, error_key: 'users.invalid_alias', details: ali.errors });


    const newUsername = user.value;
    const newAlias    = (ali.value === '' ? null : ali.value);
    const newAvatar   = (avatar_url && String(avatar_url).trim()) || null;

    // optionnel : vérifier que l’utilisateur existe
    const existing = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) return replyError(reply, 'USER_NOT_FOUND');

    try {
      await dbRun(
        `UPDATE users
         SET username = ?, "alias" = ?, avatar_url = ?
         WHERE id = ?`,
        [newUsername, newAlias, newAvatar, id]
      );

      const updated = await dbGet(
        'SELECT id, email, username, alias, avatar_url, wins, losses FROM users WHERE id = ?',
        [id]
      );

      return reply.send({ ok: true, user: updated });
      } catch (err) {
        fastify.log.error({
          msg: 'UPDATE users failed',
          params: { id, newUsername, newAlias, newAvatar },
          err: { message: err.message, code: err.code, stack: err.stack }
        });

        const m = String(err.message || '');
        if (m.includes('UNIQUE constraint failed')) {
          const field = m.includes('users.username') ? 'username'
                    : m.includes('users.alias')    ? 'alias'
                    : 'unique';
          if (field === 'username') return reply.code(409).send({ ok:false, error_key: 'profile.username_taken'});
          if (field === 'alias') return reply.code(409).send({ ok:false, error_key: 'profile.alias_taken' });
          return reply.code(409).send({ ok:false, error_key: 'users.unique_conflict', params: {field}});
        }
        return replyError(reply, 'UNKNOWN');
      }
  });

  fastify.get('/:id/stats', async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) return replyError(reply, 'INVALID_USER_ID');

    try {
      const row = await dbGet(
        `SELECT wins, losses, games_played, win_streak, elo
        FROM users
        WHERE id = ?`,
        [id]
      );

      if (!row) return replyError(reply, 'USER_NOT_FOUND');

      const { wins, losses, games_played, win_streak, elo } = row;
      const winRate = games_played > 0 ? Math.round((wins / games_played) * 100) : 0;

      return reply.send({
        ok: true,
        wins,
        losses,
        played: games_played,
        winRate,
        streak: win_streak,
        elo
      });
    } catch (err) {
      request.log.error({ msg: 'GET /users/:id/stats failed', err});
      return replyError(reply, 'UNKNOWN');
    }
  });

  fastify.get('/ranking', async (request, reply) => {
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all(
          `SELECT id, username, wins, losses, elo
          FROM users
          WHERE username != 'AI'
          ORDER BY elo DESC
          LIMIT 50`,
          [],
          (err, result) => (err ? reject(err) : resolve(result))
        );
      });

      const ranking = rows.map((u, idx) => {
        const wins = Number(u.wins || 0);
        const losses = Number(u.losses || 0);
        const played = wins + losses;
        const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

        return {
          id: u.id,
          rank: idx + 1,
          username: u.username,
          wins,
          losses,
          elo: u.elo,
          winRate
        };
      });
      
      return reply.send({ ok: true, ranking});
    } catch(err) {
      request.log.error({ msg: 'GET /users/ranking failed', err });
      return replyError(reply, 'UNKNOWN');
    }
  });
}

module.exports = usersRoutes;