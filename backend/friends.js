const db = require('./db');
const { requireUser } = require('./auth-mw');
const { replyError } = require('./i18n_errors');

const dbGet = (sql, p=[]) => new Promise((res,rej)=> db.get(sql, p, (e,r)=> e?rej(e):res(r)));
const dbAll = (sql, p=[]) => new Promise((res,rej)=> db.all(sql, p, (e,rows)=> e?rej(e):res(rows)));
const dbRun = (sql, p=[]) => new Promise((res,rej)=> db.run(sql, p, function(e){ e?rej(e):res(this); }));

async function userByHandle(handle) {
  if (handle == null) return null;
  const h = String(handle).trim();
  if (!h) return null;

  let u = await dbGet(
    `SELECT id, username, email, alias, avatar_url, wins, losses FROM users WHERE username = ?`,
    [h]
  );
  if (u) return u;

  u = await dbGet(
    `SELECT id, username, email, alias, avatar_url, wins, losses FROM users WHERE alias = ?`,
    [h]
  );
  return u;
}

async function friendsRoutes(fastify) {
  // Liste de mes amis (symétrique)
  fastify.get('/me/friends', { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const me = req.user;
      if (!me?.id) return reply.code(401).send({ ok:false, error:'NOT_AUTH' });
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);

      // Récupère l’autre côté quelle que soit la position (min/max storage compatible)
      const rows = await dbAll(
        `
        SELECT
          CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS friend_id
        FROM friendships f
        WHERE f.user_id = ? OR f.friend_id = ?
        LIMIT ? OFFSET ?
        `,
        [me.id, me.id, me.id, limit, offset]
      );

      if (rows.length === 0) {
        return { ok: true, friends: [], pagination: { limit, offset, count: 0 } };
      }

      const ids = rows.map(r => r.friend_id);
      const placeholders = ids.map(() => '?').join(',');
      const friends = await dbAll(
        `SELECT id, username, alias, avatar_url, wins, losses
        FROM users
        WHERE id IN (${placeholders})
        ORDER BY username COLLATE NOCASE`,
        ids
      );

      return { ok: true, friends, pagination: { limit, offset, count: friends.length } };
    } catch (e) {
      req.log?.error?.({ msg: 'LIST FRIENDS failed', err: { message: e.message, stack: e.stack } });
      return replyError(reply, 'UNKNOWN'); // => 500 si vraiment inattendu
    }
  });

  // Ajouter un ami (username ou alias)
  fastify.post('/me/friends', { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const me = req.user;
      if (!me?.id) return reply.code(401).send({ ok:false, error:'NOT_AUTH' });
      const { friend } = req.body || {};
      if (friend == null) return replyError(reply, 'MISSING_FRIEND_PARAM');

      const handle = String(friend).trim();
      if (!handle) return replyError(reply, 'INVALID_HANDLE');

      // Trouver la cible par username ou alias
      const target = await userByHandle(handle);
      if (!target) return reply.code(404).send({ ok:false, error:'USER_NOT_FOUND', params:{ handle } });
      if (target.id === me.id) return reply.code(400).send({ ok:false, error:'CANNOT_ADD_SELF' });

      // ⚠️ stocker UNE SEULE ligne par paire: (minId, maxId)
      const a = Math.min(me.id, target.id);
      const b = Math.max(me.id, target.id);

      // Empêche le 500 en cas de doublon
      const info = await dbRun(
        `INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)`,
        [a, b]
      );

      if (info.changes === 0) {
        // déjà amis (au lieu d’un 500)
        return reply.code(409).send({ ok:false, error:'ALREADY_FRIENDS' });
      }

      return reply.code(201).send({ ok:true, friend: { id: target.id, username: target.username } });
    } catch (e) {
      // Renvoie un 409 propre si SQLite renvoie une contrainte malgré OR IGNORE
      const msg = String(e?.message || '');
      if (e?.code === 'SQLITE_CONSTRAINT' || msg.includes('constraint') || msg.includes('UNIQUE')) {
        return reply.code(409).send({ ok:false, error:'ALREADY_FRIENDS' });
      }
      req.log?.error?.({ at:'friends:add', err: e });
      return replyError(reply, 'UNKNOWN'); // 500 uniquement si vraiment inattendu
    }
  });

  // Supprimer un ami (par id utilisateur)
  fastify.delete('/me/friends/:id', { preHandler: fastify.verifySession }, async (req, reply) => {
    const me = req.user;
    if (!me?.id) return reply.code(401).send({ ok:false, error:'NOT_AUTH' });
    const friendId = Number(req.params.id);
    if (!friendId) return replyError(reply, 'INVALID_FRIEND_ID');

    const a = Math.min(me.id, friendId);
    const b = Math.max(me.id, friendId);

    try {
      const r = await dbRun(`DELETE FROM friendships WHERE user_id = ? AND friend_id = ?`, [a, b]);
      if (!r.changes) return replyError(reply, 'NOT_FRIENDS');
      return reply.send({ ok: true, removed: r.changes });
    } catch (e) {
      fastify.log.error({ msg: 'REMOVE FRIEND failed', err: { message: e.message, stack: e.stack } });
      return replyError(reply, 'UNKNOWN');
    }
  });

  // Est-ce qu'on est amis ? (bool) — symétrique
  fastify.get('/me/friends/:id', { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const me = req.user;
      if (!me?.id) return reply.code(401).send({ ok:false, error:'NOT_AUTH' });
      const friendId = Number(req.params.id);
      if (!friendId) return replyError(reply, 'INVALID_FRIEND_ID');

      const a = Math.min(me.id, friendId);
      const b = Math.max(me.id, friendId);
      const r = await dbGet(`SELECT 1 AS ok FROM friendships WHERE user_id = ? AND friend_id = ?`, [a, b]);
      return { ok: true, following: !!r };
    } catch (e) {
      req.log?.error?.({ msg: 'IS FRIEND failed', err: e });
      return replyError(reply, 'UNKNOWN');
    }
  });
};

module.exports = friendsRoutes;