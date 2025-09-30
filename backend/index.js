const fastify = require('fastify')({ logger: true });

const cookie = require('@fastify/cookie');
const authRoutes = require('./auth');
const cors = require('@fastify/cors');
const usersRoutes = require('./users');
const friendsRoutes = require('./friends');
const matchRoutes = require('./match');
const db = require('./db');
const game = require('./game/server')
const historyRoutes = require('./historyRoutes');
const tournamentRoutes = require('./game/tournament');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

const corsObj = {
    origin: [ "http://localhost:5173" ], // accepte toutes les origines (à restreindre en prod)
    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [],
    preflightContinue: false,
    optionsSuccessStatus: 200,
}

fastify.register(cors, corsObj);



fastify.register(cookie, {
  // secret optionnel si tu veux des cookies signés
  // secret: process.env.COOKIE_SECRET
});

fastify.register(require('./auth-mw'));

fastify.register(authRoutes, {prefix: '/api/auth'});

fastify.register(usersRoutes, { prefix: '/api/users' });

fastify.register(friendsRoutes, { prefix: '/api' });

fastify.register(matchRoutes, { prefix: '/api/match' });

fastify.register(historyRoutes, { prefix: '/api' });

fastify.register(tournamentRoutes, { prefix: '/api/tournament' });

game.startGameServer(fastify.server, corsObj);

// demarrage du serveur sur le port 3000
const start = async () => {
  try {
    const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server is listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();