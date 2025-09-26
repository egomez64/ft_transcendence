const bcrypt = require("bcrypt");
const db = require("./db");

/* Helpers sqlite3 (callbacks → Promises) */
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/* --- Update stats helper --- */
async function updateUserStats(winnerId, loserId) {
  try {
    // Gagnant
    await dbRun(
      `UPDATE users
       SET wins = wins + 1,
           games_played = games_played + 1,
           win_streak = win_streak + 1,
           elo = elo + 5
       WHERE id = ?`,
      [winnerId]
    );

    // Perdant
    await dbRun(
      `UPDATE users
       SET losses = losses + 1,
           games_played = games_played + 1,
           win_streak = 0,
           elo = MAX(elo - 5, 0)
       WHERE id = ?`,
      [loserId]
    );
  } catch (err) {
    console.error("Erreur update stats:", err);
  }
}

async function matchRoutes(fastify) {
  /* =========================================================
   * 1) Création d’un match local (1v1 humain)
   * =======================================================*/
  fastify.post("/local", { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const p1 = req.user;
      if (!p1?.id) return reply.code(401).send({ ok: false, error: "PLAYER1_NOT_AUTHENTICATED" });

      const { username, password } = req.body || {};
      if (!username || !password) {
        return reply.code(400).send({ ok: false, error: "MISSING_CREDENTIALS" });
      }

      const user2 = await dbGet("SELECT * FROM users WHERE username = ?", [username]);
      if (!user2) return reply.code(400).send({ ok: false, error: "PLAYER2_NOT_FOUND" });

      const ok = await bcrypt.compare(password, user2.password || "");
      if (!ok) return reply.code(400).send({ ok: false, error: "PLAYER2_INVALID_PASSWORD" });

      if (user2.id === p1.id) {
        return reply.code(400).send({ ok: false, error: "CANNOT_PLAY_WITH_SELF" });
      }

      const info = await dbRun(
        `INSERT INTO matches (player1_id, player2_id, status) VALUES (?, ?, 'pending')`,
        [p1.id, user2.id]
      );

      return reply.send({
        ok: true,
        match_id: info.lastID,
        player1: { id: p1.id, username: p1.username },
        player2: { id: user2.id, username: user2.username },
      });
    } catch (err) {
      req.log?.error?.({ at: "match/local", err: err?.message || err });
      return reply.code(500).send({ ok: false, error: "MATCH_CREATION_FAILED" });
    }
  });

  /* =========================================================
   * 2) Création d’un match vs IA
   * =======================================================*/
  fastify.post("/ai", { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const p1 = req.user;
      if (!p1?.id) return reply.code(401).send({ ok: false, error: "PLAYER_NOT_AUTHENTICATED" });

      const ai = await dbGet(`SELECT id FROM users WHERE username = 'AI'`);
      if (!ai) return reply.code(500).send({ ok: false, error: "AI_USER_NOT_FOUND" });

      const info = await dbRun(
        `INSERT INTO matches (player1_id, player2_id, status) VALUES (?, ?, 'pending')`,
        [p1.id, ai.id]
      );

      return reply.send({
        ok: true,
        match_id: info.lastID,
        player1: { id: p1.id, username: p1.username },
        player2: { id: ai.id, username: "AI" },
      });
    } catch (err) {
      req.log?.error?.({ at: "match/ai", err: err?.message || err });
      return reply.code(500).send({ ok: false, error: "MATCH_AI_CREATION_FAILED" });
    }
  });

  /* =========================================================
   * 3) Terminer un match : PATCH /api/match/:id/finish
   * =======================================================*/
  fastify.patch("/:id/finish", { preHandler: fastify.verifySession }, async (req, reply) => {
    try {
      const user = req.user;
      const id = Number(req.params?.id);
      const { score_p1, score_p2 } = req.body || {};

      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({ ok: false, error: "INVALID_MATCH_ID" });
      }
      const s1 = Number(score_p1);
      const s2 = Number(score_p2);
      if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0) {
        return reply.code(400).send({ ok: false, error: "INVALID_SCORES" });
      }

      const match = await dbGet(`SELECT * FROM matches WHERE id = ?`, [id]);
      if (!match) return reply.code(404).send({ ok: false, error: "MATCH_NOT_FOUND" });

      // Autorisation : seul player1 ou player2 peut finir ce match
      if (user.id !== match.player1_id && user.id !== match.player2_id) {
        return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
      }

      if (match.status === "finished") {
        return reply.send({ ok: true, already: true, match });
      }

      if (s1 === s2) {
        return reply.code(400).send({ ok: false, error: "TIE_NOT_ALLOWED" });
      }

      const winner_id = s1 > s2 ? match.player1_id : match.player2_id;
      const loser_id = s1 > s2 ? match.player2_id : match.player1_id;

      await dbRun(
        `UPDATE matches
         SET score_p1 = ?, score_p2 = ?, winner_id = ?, status = 'finished'
         WHERE id = ?`,
        [s1, s2, winner_id, id]
      );

      await updateUserStats(winner_id, loser_id);

      const updated = await dbGet(`SELECT * FROM matches WHERE id = ?`, [id]);
      return reply.send({ ok: true, match: updated });
    } catch (err) {
      req.log?.error?.({ at: "match/finish", err: err?.message || err });
      return reply.code(500).send({ ok: false, error: "MATCH_FINISH_FAILED" });
    }
  });

   fastify.get("/latest", { preHandler: fastify.verifySession }, async (req, reply) => {
		try {	
			const user = req.user;
			if (!user?.id) return reply.code(401).send({ ok: false, error: "PLAYER_NOT_AUTHENTICATED" });

			const match = await dbGet(
				`SELECT * FROM matches WHERE player1_id = ? OR player2_id = ? ORDER BY id DESC LIMIT 1`,
				[user.id, user.id]
			);

			if (!match) return reply.code(404).send({ ok: false, error: "NO_MATCH_FOUND" });

			reply.send({ ok: true, match_id: match.id, match });
		}	catch (err) {
			req.log?.error?.({ at: "match/latest", err: err?.message || err });
			return reply.code(500).send({ ok: false, error: "LATEST_MATCH_FETCH_FAILED" });
		}
	});
}

module.exports = matchRoutes;
