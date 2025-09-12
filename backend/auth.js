const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
<<<<<<< HEAD

const oauth2 = require('@fastify/oauth2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const db = require('./db');
const { sendMail } = require('./mailer');

// ---------- Helpers DB promisifiés ----------
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
=======
const oauth2 = require('@fastify/oauth2');
const bcrypt = require('bcrypt');
const db = require('./db');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
>>>>>>> pong
    });
  });
}

<<<<<<< HEAD
// ---------- Constantes 2FA e-mail ----------
const TWOFA_TTL_SEC = Number(process.env.TWOFA_TTL_SEC || 300);           // validité du code (5 min)
const TWOFA_RESEND_MIN_SEC = Number(process.env.TWOFA_RESEND_MIN_SEC || 60); // délai mini entre 2 envois
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
};
const nowSec = () => Math.floor(Date.now() / 1000);
function generateCode6() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0'); // exactement 6 chiffres
}

async function createAndSend2fa(user) {
  const code = generateCode6();
  const hash = await bcrypt.hash(code, 10);
  const exp = nowSec() + TWOFA_TTL_SEC;

  await dbRun(
    'UPDATE users SET twofa_code_hash=?, twofa_code_expires=?, twofa_last_sent=? WHERE id=?',
    [hash, exp, nowSec(), user.id]
  );

  const subject = 'Votre code de connexion (2FA)';
  const text = `Bonjour ${user.username},\n\nCode: ${code}\nExpire dans ${Math.round(TWOFA_TTL_SEC/60)} min.`;
  const html = `<p>Bonjour <b>${user.username}</b>,</p>
    <p>Code: <b style="font-size:18px;letter-spacing:2px">${code}</b></p>
    <p>Expire dans ${Math.round(TWOFA_TTL_SEC/60)} min.</p>
    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`;

  await sendMail({ to: user.email, subject, text, html });
}

// ---------- Plugin de routes ----------
async function authRoute(fastify, options) {
  // Google OAuth: on garde le flux, mais on NE pose PAS la session ici (2FA obligatoire ensuite)
=======
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

>>>>>>> pong
  fastify.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['openid', 'email', 'profile'],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID,
<<<<<<< HEAD
        secret: process.env.GOOGLE_CLIENT_SECRET,
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/google', // /api/auth/google
    callbackUri: (req) => `${req.protocol}://${req.headers.host}/api/auth/google/callback`,
    cookie: { secure: false, sameSite: 'lax' },
  });

  // ---------- Register ----------
  fastify.post('/register', async (request, reply) => {
    let { username, email, password } = request.body || {};
    username = String(username || '').trim();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');

    if (!username || !email || !password) {
      return reply.code(400).send({ ok: false, error_key: 'auth.missing_fields' });
    }

    const exists = await dbGet(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (exists) {
      return reply.code(400).send({ ok: false, error_key: 'auth.user_exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const alias = username;
    await dbRun(
      'INSERT INTO users (username, email, password, alias) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, alias]
    );

    return reply.send({ ok: true });
  });

  // ---------- Login (étape 1: identifiants -> envoi code 2FA par e-mail) ----------
  fastify.post('/login', async (request, reply) => {
    let { username, password } = request.body || {};
    if (!username || !password) {
      return reply.code(400).send({ ok: false, error_key: 'auth.missing_credentials' });
=======
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
>>>>>>> pong
    }

    const raw = String(username).trim();
    const u = raw.includes('@') ? raw.toLowerCase() : raw;
    const user = await dbGet(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [u, u]
    );
<<<<<<< HEAD
    if (!user) return reply.code(400).send({ ok: false, error_key: 'login.invalid_credentials' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return reply.code(400).send({ ok: false, error_key: 'login.invalid_credentials' });

    // 2FA OBLIGATOIRE : on envoie le code et on pose un cookie temporaire "pre2fa"
    await createAndSend2fa(user);
    const pre = jwt.sign({ uid: user.id, stage: 'pre2fa' }, JWT_SECRET, { expiresIn: '10m' });
    reply.setCookie('pre2fa', pre, { ...COOKIE_OPTS, maxAge: 600 });
    return reply.send({ ok: true, step: '2fa_required', via: 'email' });
  });

  // ---------- Google OAuth callback -> envoi code 2FA puis redirection ----------
  fastify.get('/google/callback', async (req, reply) => {
    try {
      const tok = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const accessToken = tok?.access_token || tok?.token?.access_token;
      if (!accessToken) return reply.code(500).send({ ok: false, error_key: 'oauth.callback_failed' });

      const resp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) return reply.code(500).send({ ok: false, error_key: 'oauth.userinfo_failed' });
      const p = await resp.json();

      const googleEmail = String(p.email || '').toLowerCase().trim();
      const googleName = String(p.name || '').trim();
      const googleId = String(p.sub || p.id || '').trim();
      const googleAvatar = String(p.picture || '').trim();
      if (!googleEmail) return reply.code(400).send({ ok: false, error: 'NO_EMAIL_FROM_GOOGLE' });

      const user = await upsertUserFromGoogle({ googleEmail, googleName, googleId, googleAvatar });

      // 2FA OBLIGATOIRE : on envoie le code et on pose un cookie "pre2fa", PAS de session ici
      await createAndSend2fa(user);
      const pre = jwt.sign({ uid: user.id, stage: 'pre2fa' }, JWT_SECRET, { expiresIn: '10m' });
      reply.setCookie('pre2fa', pre, { ...COOKIE_OPTS, maxAge: 600 });

      const redirectTo = process.env.FRONT_REDIRECT_URI || '/';
      const url = new URL(redirectTo, `${req.protocol}://${req.headers.host}`);
      url.searchParams.set('mfa', '1'); // le front affiche l'écran "entrer le code"
      return reply.redirect(url.toString());
    } catch (err) {
      req.log?.error?.({ at: 'google/callback', err: err.message });
      return reply.code(500).send({ ok: false, error_key: 'oauth.callback_failed' });
    }
  });

  // ---------- Vérification du code (étape 2) ----------
  fastify.post('/2fa/verify', async (req, reply) => {
    const pre = req.cookies?.pre2fa;
    if (!pre) return reply.code(401).send({ ok: false, error: 'NO_PRE2FA' });

    let payload;
    try {
      payload = jwt.verify(pre, JWT_SECRET);
      if (payload.stage !== 'pre2fa') throw new Error('bad stage');
    } catch {
      return reply.code(401).send({ ok: false, error: 'INVALID_PRE2FA' });
    }

    const code = String((req.body || {}).code || '').trim();
    if (!/^\d{6}$/.test(code)) return reply.code(400).send({ ok: false, error: 'CODE_FORMAT' });

    const user = await dbGet(
      'SELECT id, username, email, twofa_code_hash, twofa_code_expires FROM users WHERE id = ?',
      [payload.uid]
    );
    if (!user || !user.twofa_code_hash || !user.twofa_code_expires) {
      return reply.code(400).send({ ok: false, error: 'NO_CODE' });
    }
    if (nowSec() > Number(user.twofa_code_expires)) {
      return reply.code(400).send({ ok: false, error: 'CODE_EXPIRED' });
    }

    const match = await bcrypt.compare(code, user.twofa_code_hash);
    if (!match) return reply.code(400).send({ ok: false, error: 'CODE_INVALID' });

    // OK → on nettoie le challenge et on émet la session
    await dbRun('UPDATE users SET twofa_code_hash=NULL, twofa_code_expires=NULL WHERE id=?', [user.id]);
    reply.clearCookie('pre2fa', { path: '/' });

    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
    reply.setCookie('session', token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 });

    return reply.send({
      ok: true,
      message: '2FA verified',
      user: { id: user.id, username: user.username, email: user.email },
    });
  });

  // ---------- Renvoyer un code (anti-spam) ----------
  fastify.post('/2fa/resend', async (req, reply) => {
    const pre = req.cookies?.pre2fa;
    if (!pre) return reply.code(401).send({ ok: false, error: 'NO_PRE2FA' });

    let payload;
    try {
      payload = jwt.verify(pre, JWT_SECRET);
      if (payload.stage !== 'pre2fa') throw new Error('bad stage');
    } catch {
      return reply.code(401).send({ ok: false, error: 'INVALID_PRE2FA' });
    }

    const user = await dbGet(
      'SELECT id, email, username, twofa_last_sent FROM users WHERE id = ?',
      [payload.uid]
    );
    if (!user) return reply.code(400).send({ ok: false, error: 'USER_NOT_FOUND' });

    const last = Number(user.twofa_last_sent || 0);
    if (nowSec() - last < TWOFA_RESEND_MIN_SEC) {
      return reply
        .code(429)
        .send({ ok: false, error: 'TOO_SOON', retry_after: TWOFA_RESEND_MIN_SEC - (nowSec() - last) });
    }

    await createAndSend2fa(user);
    return reply.send({ ok: true, message: 'Code renvoyé' });
  });

  // ---------- Me ----------
  fastify.get('/me', async (req, reply) => {
    const raw = req.cookies?.session;
    if (!raw) return reply.code(401).send({ error: 'Not authenticated' });

    try {
      const { uid } = jwt.verify(raw, JWT_SECRET);
      const me = await dbGet(
        'SELECT id, email, username, alias, avatar_url, wins, losses FROM users WHERE id = ?',
        [uid]
      );
=======
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
>>>>>>> pong
      if (!me) return reply.code(401).send({ error: 'Not authenticated' });
      return reply.send({ ok: true, user: me });
    } catch {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

<<<<<<< HEAD
  // ---------- Logout ----------
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('session', { path: '/' });
    reply.clearCookie('pre2fa', { path: '/' });
=======

  // Logout
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('session', { path: '/' });
>>>>>>> pong
    return reply.send({ ok: true });
  });
}

<<<<<<< HEAD
// ---------- Upsert user depuis Google ----------
async function upsertUserFromGoogle({ googleEmail, googleName, googleId, googleAvatar }) {
  const existing = await dbGet('SELECT * FROM users WHERE email = ?', [googleEmail]);
  if (existing) return existing;

  const username = (googleName || googleEmail.split('@')[0] || 'user')
    .replace(/\s+/g, '')
    .slice(0, 20);

  await dbRun(
    'INSERT INTO users (email, username, password, alias, avatar_url) VALUES (?, ?, ?, ?, ?)',
    [googleEmail, username, '', username, googleAvatar || null]
  );

  const created = await dbGet('SELECT * FROM users WHERE email = ?', [googleEmail]);
  return created;
}

=======

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


>>>>>>> pong
module.exports = authRoute;
