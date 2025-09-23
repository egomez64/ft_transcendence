const db = require('./db');

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function historyRoutes(fastify, options) {
  fastify.get('/history/:userId', async (req, reply) => {
    const userId = Number(req.params.userId);
    if (!userId) return reply.code(400).send({ error: 'Invalid user id' });

    try {
      const rows = await dbAll(
        `SELECT m.id,
					 m.player1_id,
					 m.player2_id,
                u1.username AS player1, 
                u2.username AS player2, 
                m.score_p1, 
                m.score_p2, 
                m.created_at, 
                m.winner_id
         FROM matches m
         JOIN users u1 ON m.player1_id = u1.id
         JOIN users u2 ON m.player2_id = u2.id
         WHERE m.player1_id = ? OR m.player2_id = ?
         ORDER BY m.created_at DESC
         LIMIT 20`,
        [userId, userId]
      );

      const history = rows.map(match => {
		  const time = new Date(match.created_at);
		  time.setHours(time.getHours());

		  const player = match.player1_id === userId ? match.player1 : match.player2;
        const opponent = match.player1_id === userId ? match.player2 : match.player1;
        const score = `${match.score_p1} - ${match.score_p2}`;
        const result =
          match.winner_id === userId ? 'win' :
          (match.winner_id ? 'lose' : 'pending');

        return { id: match.id, player, opponent, score, result, played_at: time.toISOString() };
      });

      return history;
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Server error' });
    }
  });
}

module.exports = historyRoutes;