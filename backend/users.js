const db = require('./db');
const { replyError } = require('./i18n_errors');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const bcrypt = require('bcrypt');
const { passwordPolicyErrors } = require('./password-policy');

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
    return { ok: false, errors: ['alias.length'] };
  }
  return { ok: true, value: a };
}

function validateUsername(username) {
  const errors = [];
  const u = String(username || '').trim();
  if (!u) errors.push('username.required');
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(u)) {
    errors.push('username.format');
  }
  return { ok: errors.length === 0, value: u, errors };
}

async function usersRoutes(fastify) {

  fastify.put('/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) return replyError(reply, 'INVALID_USER_ID');

    const parts = request.parts();
    let fields = {};
    let newAvatar = null;

    for await (const part of parts) {
      if (part.file && part.fieldname === 'avatar') {
        // Whitelist mimetypes
        const type = String(part.mimetype || '');
        if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) {
          try { part.file.resume(); } catch {}
          return reply.code(415).send({ ok: false, error_key: 'UNSUPPORTED_TYPE' });
        }

        const filename = `avatar_${id}_${Date.now()}${path.extname(part.filename || '')}`;
        const dest = path.join(__dirname, 'uploads', 'avatars', filename);
        try {
          await fsp.mkdir(path.dirname(dest), { recursive: true });

          await pipeline(part.file, fs.createWriteStream(dest));

          newAvatar = `/uploads/avatars/${filename}`;
        } catch (err) {
          request.log.error({ at: 'avatar_write', err: err?.message });
          try { part.file.resume(); } catch {}
          return reply.code(500).send( { ok: false, error_key:'UPLOAD_FAILED' } );
        }
      } else if (!part.file) {
        fields[part.fieldname] = part.value;
      }
    }

    const username = fields.username || '';
    const alias = fields.alias || '';

    const rawLang = String(fields.preferred_lang || '').trim().toLowerCase();
    let preferredLang = null;
    if (rawLang) {
      preferredLang = rawLang.split(/[-_]/)[0]; // ex: fr-FR -> fr
      const ALLOWED_LANGS = new Set(['fr', 'en', 'es']);
      if (!ALLOWED_LANGS.has(preferredLang)) {
        return reply.code(400).send({ ok:false, error_key:'users.invalid_lang' });
      }
    }

    // validations username/alias
    const user = validateUsername(username);
    if (!user.ok)
      return reply.code(400).send({ ok: false, error_key: 'auth.invalid_username', details: user.errors });

    const ali = validateAlias(alias);
    if (!ali.ok)
      return reply.code(400).send({ ok: false, error_key: 'users.invalid_alias', details: ali.errors });

    const newUsername = user.value;
    const newAlias = ali.value === '' ? null : ali.value;

    const existing = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) return replyError(reply, 'USER_NOT_FOUND');

    const oldPw = String(fields.old_password || '');
    const newPw = String(fields.new_password || '');

    if (oldPw || newPw) {
      if (!oldPw || !newPw) {
        return reply.code(400).send({ ok: false, error_key: 'password.missing_fields' });
      }

      const userRow = await dbGet('SELECT username, email, password FROM users WHERE id = ?', [id]);
      if (!userRow) return replyError(reply, 'USER_NOT_FOUND');

      if (!userRow.password) {
        return reply.code(400).send({ ok:false, error_key: 'password.no_local_password' });
      }

      const ok = await bcrypt.compare(oldPw, userRow.password);
      if (!ok) {
        return reply.code(400).send({ ok: false, error_key: 'password.invalid_current'});
      }

      // policy check
      const policy = passwordPolicyErrors(newPw, { username: userRow.username, email: userRow.email });
      if (policy.length) {
        return reply.code(400).send({ ok: false, error_key: 'auth.weak_password', details: policy});
      }

      const hashed = await bcrypt.hash(newPw, 10);
      await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    }

    try {
      await dbRun(
        `UPDATE users
         SET username = ?,
             alias = ?,
             avatar_url = COALESCE(?, avatar_url),
             preferred_lang = COALESCE(?, preferred_lang)
         WHERE id = ?`,
        [newUsername, newAlias, newAvatar, preferredLang, id]
      );

      const updated = await dbGet(
        'SELECT id, email, username, alias, avatar_url, wins, losses, preferred_lang FROM users WHERE id = ?',
        [id]
      );

      return reply.send({ ok: true, user: updated });
    } catch (err) {
      fastify.log.error({ msg: 'UPDATE users failed', err });
      const m = String(err.message || '');
      if (m.includes('UNIQUE constraint failed')) {
        const field = m.includes('users.username') ? 'username' : m.includes('users.alias') ? 'alias' : 'unique';
        if (field === 'username') return reply.code(409).send({ ok: false, error_key: 'profile.username_taken' });
        if (field === 'alias') return reply.code(409).send({ ok: false, error_key: 'profile.alias_taken' });
        return reply.code(409).send({ ok: false, error_key: 'users.unique_conflict', params: { field } });
      }
      return replyError(reply, 'UNKNOWN');
    }
  });

  // --- Stats
  fastify.get('/:id/stats', async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) return replyError(reply, 'INVALID_USER_ID');
    try {
      const row = await dbGet(
        `SELECT wins, losses, games_played, win_streak, elo FROM users WHERE id = ?`,
        [id]
      );
      if (!row) return replyError(reply, 'USER_NOT_FOUND');
      const { wins, losses, games_played, win_streak, elo } = row;
      const winRate = games_played > 0 ? Math.round((wins / games_played) * 100) : 0;
      return reply.send({ ok: true, wins, losses, played: games_played, winRate, streak: win_streak, elo });
    } catch (err) {
      request.log.error({ msg: 'GET /users/:id/stats failed', err });
      return replyError(reply, 'UNKNOWN');
    }
  });

  // --- Ranking
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
        return { id: u.id, rank: idx + 1, username: u.username, wins, losses, elo: u.elo, winRate };
      });
      return reply.send({ ok: true, ranking });
    } catch (err) {
      request.log.error({ msg: 'GET /users/ranking failed', err });
      return replyError(reply, 'UNKNOWN');
    }
  });

  fastify.get('/status', async (req, reply) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const ACTIVE_WINDOW = 120; // 2 minutes
      const rows = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT id, username,
            CASE WHEN (? - COALESCE(last_seen, 0)) < ? THEN 1 ELSE 0 END AS online
          FROM users
          `,
          [now, ACTIVE_WINDOW],
          (err, result) => (err ? reject(err) : resolve(result))
        );
      });

      return reply.send({ ok: true, users: rows });
    } catch (err) {
      req.log?.error?.({ msg: 'GET /users/status failed', err });
      return reply.code(500).send({ ok: false });
    }
  });

  fastify.post('/ping', { preHandler: fastify.verifySession }, async (req, reply) => {
    return reply.send({ ok: true });
  });
}

module.exports = usersRoutes;
