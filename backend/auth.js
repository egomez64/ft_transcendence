const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const oauth2 = require('@fastify/oauth2');
const bcrypt = require('bcrypt');
const db = require('./db');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // `this` contient `lastID`, etc.
    });
  });
}

function validatePassword(password, { username, email }) {
  const errors = [];
  if (typeof password !== 'string') errors.push('Password must be a string.');
  if (password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password.length > 72) errors.push('Password must be at most 72 characters.'); // bcrypt limit
  if (!/[a-z]/.test(password)) errors.push('Password must include a lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Password must include an uppercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Password must include a digit.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must include a symbol.');
  if (/\s/.test(password)) errors.push('Password must not contain spaces.');

  const lowered = password.toLowerCase();
  const u = String(username || '').toLowerCase();
  const local = String(email || '').split('@')[0]?.toLowerCase();

  if (u && lowered.includes(u)) errors.push('Password must not contain the username.');
  if (local && lowered.includes(local)) errors.push('Password must not contain parts of the email.');

  return { ok: errors.length === 0, errors };
}

function validateUsername(username) {
  const errors = [];
  const u = String(username || '').trim();

  if (!u) errors.push('Username is required.');
  // 3–20 caractères, alphanum + . _ - (mêmes règles que profil)
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(u)) {
    errors.push('Username must be 3–20 chars, letters/numbers/._- only.');
  }
  return { ok: errors.length === 0, value: u, errors };
}

function validateEmail(email) {
  const errors = [];
  const e = String(email || '').trim().toLowerCase();

  if (!e) {
    errors.push('Email is required.');
  } else {
    // regex simple mais robuste : "quelquechose@domaine.tld"
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(e)) {
      errors.push('Invalid email format.');
    }
  }

  return { ok: errors.length === 0, value: e, errors };
}

async function authRoute(fastify, options) {

  fastify.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['openid', 'email', 'profile'],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID,
        secret: process.env.GOOGLE_CLIENT_SECRET
      },
      auth: oauth2.GOOGLE_CONFIGURATION
    },
    startRedirectPath: '/google',            // GET /api/auth/google
    callbackUri: (req) => `${req.protocol}://${req.headers.host}/api/auth/google/callback`, // /api/auth/google/callback
    cookie: { secure: false, sameSite: 'lax' }
  });

  fastify.post('/register', async (request, reply) => {
    let { username, email, password } = request.body || {};
    username = String(username || '').trim();
    email    = String(email || '').trim().toLowerCase();

    if (!email || !username || !password) {
      return reply.code(400).send({ error: 'Email, username and password are required.' });
    }

    const un = validateUsername(username);
    if (!un.ok) {
      return reply.code(400).send({ error: 'Invalid username', details: un.errors });
    }
    username = un.value;

    const eres = validateEmail(email);
    if (!eres.ok)
      return reply.code(400).send({ error: 'Invalid email', details: eres.errors });
    email = eres.value;

    const policy = validatePassword(password, { username, email });
    if (!policy.ok)
      return reply.code(400).send({ error: 'Weak password', details: policy.errors });
    try {
      const existingUser = await dbGet('SELECT 1 FROM users WHERE username = ?', [username]);
      if (existingUser) {
        return reply.code(400).send({ error: 'User already exists.' });
      }

      const existingEmail = await dbGet('SELECT 1 FROM users WHERE email = ?', [email]);
      if (existingEmail) {
        return reply.code(400).send({ error: 'Email already used.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const alias = username;
      await dbRun('INSERT INTO users (username, email, password, alias) VALUES (?, ?, ?, ?)', [username, email, hashedPassword, alias]);

      return reply.code(201).send({ ok: true,  message: 'User registered successfully!' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error.' });
    }
  });


  fastify.post('/login', async (request, reply) => {
    let { username, password } = request.body || {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required.' });
    }

    const raw = String(username).trim();
    const u = raw.includes('@') ? raw.toLowerCase() : raw;
    const user = await dbGet(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [u, u]
    );
    if (!user) return reply.code(400).send({ error: 'Wrong username or email.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return reply.code(400).send({ error: 'Wrong password.' });

    // émettre une session
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // true en prod derrière HTTPS
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    return reply.send({ ok: true, message: 'Login successful', user: { id: user.id, username: user.username, email: user.email ?? user.Email } });
  });

  fastify.get('/google/callback', async (req, reply) => {
    try {
      fastify.log.info({ at: 'google/callback', query: req.query, cookies: req.cookies });
      const tok = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const accessToken = tok?.access_token || tok?.token?.access_token;
      if (!accessToken) {
        fastify.log.error({ msg: 'No access_token from Google', tok });
        return reply.code(500).send({ error: 'OAuth callback failed' });
      }

      // Récupérer le profil Google (email, name, picture)
      const resp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
     });
     if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`userinfo HTTP ${resp.status} ${txt}`);
     }
     const googleProfile = await resp.json();

      const googleEmail = String(googleProfile.email || '').toLowerCase().trim();
      const googleName  = String(googleProfile.name || '').trim();
      const googleId    = String(googleProfile.id || '').trim();
      const googleAvatar = String(googleProfile.picture || '').trim();

      if (!googleEmail) {
        return reply.code(400).send({ error: 'Google account has no public email.' });
      }

      // upsert user local
      const user = await upsertUserFromGoogle({ googleEmail, googleName, googleId, googleAvatar });

       // session cookie
      const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // true en prod HTTPS
        path: '/',
        maxAge: 60 * 60 * 24 * 7
      });
      // Redirection vers le front avec un “ok=1”. Plus tard tu pourras passer un token/cookie.
      const redirectTo = process.env.FRONT_REDIRECT_URI || '/#login';
      // Tip simple: attachons l'ID et username en query pour démo (éviter en prod, préférer cookie ou JWT)
      const url = new URL(redirectTo, 'http://localhost:3000');
      url.searchParams.set('ok', '1');
      url.searchParams.set('provider', 'google');
      url.searchParams.set('id', String(user.id));
      url.searchParams.set('username', String(user.username));
      url.searchParams.set('email', String(user.email));

      reply.redirect(url.toString());
    } catch (err) {
      fastify.log.error({ msg: 'Google OAuth callback failed', err: { message: err.message, stack: err.stack } });
      return reply.code(500).send({ error: 'OAuth callback failed' });
    }
  });


  // Qui suis-je ? (utilisé par le front)
  fastify.get('/me', async (req, reply) => {
    const raw = req.cookies?.session;
    if (!raw) return reply.code(401).send({ error: 'Not authenticated' });
    try {
      const { uid } = jwt.verify(raw, JWT_SECRET);
      const me = await dbGet('SELECT id, email, username, alias, avatar_url, wins, losses FROM users WHERE id = ?', [uid]);
      if (!me) return reply.code(401).send({ error: 'Not authenticated' });
      return reply.send({ ok: true, user: me });
    } catch {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });


  // Logout
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('session', { path: '/' });
    return reply.send({ ok: true });
  });
}


// Helper local à auth.js : créer / associer un user
async function upsertUserFromGoogle({ googleEmail, googleName, googleId, googleAvatar }) {
  // essaie par email
  let user = await dbGet('SELECT * FROM users WHERE email = ?', [googleEmail]);
  if (user) {
    // mets à jour avatar_url si vide
    if (!user.avatar_url && googleAvatar) {
      await dbRun('UPDATE users SET avatar_url = ? WHERE id = ?', [googleAvatar, user.id]);
      user = await dbGet('SELECT * FROM users WHERE id = ?', [user.id]);
    }
    return user;
  }

  // créer un username unique basé sur l'email local-part
  const base = googleEmail.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 16) || 'player';
  let candidate = base;
  let i = 0;
  while (await dbGet('SELECT 1 FROM users WHERE username = ?', [candidate])) {
    i += 1;
    candidate = `${base}${i}`;
  }

  const username = candidate;
  const alias = username;

  // mot de passe factice (tu pourras rendre password NULL plus tard si tu fais une vraie migration)
  const fakePasswordHash = await bcrypt.hash(`oauth-google:${googleId}:${Date.now()}`, 10);

  const avatar = googleAvatar || null;

  const result = await dbRun(
    'INSERT INTO users (email, username, password, alias, avatar_url) VALUES (?, ?, ?, ?, ?)',
    [googleEmail, username, fakePasswordHash, alias, avatar]
  );
  const newId = result.lastID;
  const newUser = await dbGet('SELECT * FROM users WHERE id = ?', [newId]);
  return newUser;
}


module.exports = authRoute;
