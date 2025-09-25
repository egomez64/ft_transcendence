const db = require('./db');

// helpers sqlite
const dbAll = (sql, params=[]) => new Promise((res,rej)=> db.all(sql, params, (e,rows)=> e?rej(e):res(rows)));
const dbGet = (sql, params=[]) => new Promise((res,rej)=> db.get(sql, params, (e,row)=> e?rej(e):res(row)));

module.exports = async function (fastify) {
  /**
   * GET /api/leaderboard
   * Query:
   *  - sort: 'elo'|'wins'|'winRate' (default 'elo')
   *  - order: 'asc'|'desc' (default 'desc')
   *  - limit: number (default 50, max 200)
   *  - offset: number (default 0)
   *  - search: string (filtre username, optionnel)
   *
   * Réponse: { ok, total, items:[{ id, username, elo, wins, losses, games_played, win_streak, winRate, rank }] }
   */
  fastify.get('/api/leaderboard', async (req, reply) => {
    const q = req.query || {};
    const sort = (q.sort || 'elo');
    const order = (q.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(parseInt(q.limit || '50',10), 1), 200);
    const offset = Math.max(parseInt(q.offset || '0',10), 0);
    const search = (q.search || '').trim();

    // mapping tri
    // NB: winRate n'est pas en DB => on le calcule côté JS
    const allowedSort = ['elo','wins','winRate'];
    const sortKey = allowedSort.includes(sort) ? sort : 'elo';

    // base filters
    const where = [];
    const params = [];
    if (search) { where.push(`username LIKE ?`); params.push(`%${search}%`); }
    // Option: exclure le compte IA du leaderboard public
    where.push(`username != 'AI'`);
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // total
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM users ${whereSQL}`, params);
    const total = Number(totalRow?.total || 0);

    // on récupère nécessaires pour calculer winRate + tie-break
    const rows = await dbAll(
      `SELECT id, username, elo, wins, losses, games_played, win_streak
       FROM users
       ${whereSQL}
       ORDER BY
         -- tri primaire selon sortKey
         ${sortKey === 'elo' ? `elo ${order}` :
           sortKey === 'wins' ? `wins ${order}` :
           `elo DESC`} -- si winRate on trie secondairement par elo
         , wins DESC
         , losses ASC
         , id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // post-traitements
    // 1) calcul du winRate
    const itemsBase = rows.map(r => {
      const wins = Number(r.wins || 0);
      const losses = Number(r.losses || 0);
      const played = wins + losses;
      const winRate = played ? Math.round((wins / played) * 1000) / 10 : 0; // 1 décimale
      return { ...r, wins, losses, games_played: Number(r.games_played||0), win_streak: Number(r.win_streak||0), winRate };
    });

    // 2) si sort=winRate, retrier côté JS (puisqu'on vient d'ajouter le champ)
    let items = itemsBase;
    if (sortKey === 'winRate') {
      items = itemsBase.sort((a,b) => {
        if (order === 'ASC') return a.winRate - b.winRate || b.elo - a.elo || b.wins - a.wins || a.losses - b.losses || a.id - b.id;
        return b.winRate - a.winRate || b.elo - a.elo || b.wins - a.wins || a.losses - b.losses || a.id - b.id;
      });
    }

    // 3) calcul du rang global (basé sur elo DESC, wins DESC, losses ASC, id ASC)
    //    Pour un rang cohérent global, on va chercher le rang par elo indépendamment de la page
    //    (simple et performant: on récupère le nombre d’utilisateurs ayant un meilleur score).
    //    Ici on calcule pour CHAQUE item (1 extra requête par item si tu veux 100% exact)
    //    Variante perf: précharger en mémoire si dataset petit.
    async function getRankFor(user) {
      const better = await dbGet(
        `SELECT COUNT(*) AS better
         FROM users
         WHERE username != 'AI'
           AND (elo > ? OR (elo = ? AND wins > ?) OR (elo = ? AND wins = ? AND losses < ?) OR (elo = ? AND wins = ? AND losses = ? AND id < ?))`,
        [user.elo, user.elo, user.wins, user.elo, user.wins, user.losses, user.elo, user.wins, user.losses, user.id]
      );
      return Number(better?.better || 0) + 1;
    }

    // calcule les rangs pour les items de la page (compromis simple)
    const itemsWithRank = await Promise.all(items.map(async u => ({ ...u, rank: await getRankFor(u) })));

    return reply.send({ ok: true, total, items: itemsWithRank });
  });

  /**
   * GET /api/leaderboard/me
   * -> renvoie l’entry + rang de l’utilisateur courant (session requise)
   */
  fastify.get('/api/leaderboard/me', { preHandler: fastify.verifySession }, async (req, reply) => {
    const me = req.user;
    if (!me?.id) return reply.code(401).send({ ok:false, error:'NOT_AUTH' });

    const u = await dbGet(`SELECT id, username, elo, wins, losses, games_played, win_streak FROM users WHERE id=?`, [me.id]);
    if (!u) return reply.code(404).send({ ok:false, error:'USER_NOT_FOUND' });

    const wins = Number(u.wins || 0);
    const losses = Number(u.losses || 0);
    const played = wins + losses;
    const winRate = played ? Math.round((wins / played) * 1000) / 10 : 0;

    const better = await dbGet(
      `SELECT COUNT(*) AS better
       FROM users
       WHERE username != 'AI'
         AND (elo > ? OR (elo = ? AND wins > ?) OR (elo = ? AND wins = ? AND losses < ?) OR (elo = ? AND wins = ? AND losses = ? AND id < ?))`,
      [u.elo, u.elo, wins, u.elo, wins, losses, u.elo, wins, losses, u.id]
    );
    const rank = Number(better?.better || 0) + 1;

    return reply.send({ ok:true, user: { ...u, wins, losses, games_played: Number(u.games_played||0), win_streak: Number(u.win_streak||0), winRate, rank } });
  });
};
