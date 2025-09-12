const fastify = require('fastify')({ logger: true });
const http = require("http");
const { startGameServer } = require("./game/server");
const cookie = require('@fastify/cookie');
const cors = require('@fastify/cors');
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const db = require('./db');

// --- routes et API ---
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

fastify.get('/api/users/:id/stats', async (req, reply) => {
  const id = Number(req.params.id);
  if (!id) return reply.code(400).send({ error: 'Invalid user id' });

  const row = await dbGet('SELECT wins, losses FROM users WHERE id = ?', [id]);
  if (!row) return reply.code(404).send({ error: 'User not found' });

  const wins   = Number(row.wins || 0);
  const losses = Number(row.losses || 0);
  const played = wins + losses;
  const winRate = played ? Math.round((wins / played) * 1000) / 10 : 0;

  return { wins, losses, played, winRate };
});

// --- plugins ---
fastify.register(cors, { origin: true, credentials: true });
fastify.register(cookie);
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(usersRoutes, { prefix: '/api/users' });

// --- créer serveur HTTP + WS ---
const server = http.createServer(fastify.server);
startGameServer(server);

// --- démarrage ---
const start = async () => {
  try {
    const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is listening on ${PORT}`);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
