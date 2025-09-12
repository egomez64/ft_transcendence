const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function requireUser(req, reply) {
  const raw = req.cookies?.session;
  if (!raw) return reply.code(401).send({ error: 'Not authenticated' });
  try {
    const { uid } = jwt.verify(raw, JWT_SECRET);
    const me = await dbGet('SELECT id, username, email FROM users WHERE id = ?', [uid]);
    if (!me) return reply.code(401).send({ error: 'Not authenticated' });
    req.user = me; // attache l’utilisateur sur la requête
  } catch {
    return reply.code(401).send({ error: 'Not authenticated' });
  }
}

module.exports = { requireUser };