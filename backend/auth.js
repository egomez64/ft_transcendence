const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const oauth2 = require('@fastify/oauth2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const db = require('./db');
const { sendMail } = require('./mailer');

const PUBLIC_BACKEND_BASE = process.env.PUBLIC_BACKEND_BASE || 'http://localhost:3000';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${PUBLIC_BACKEND_BASE}/api/auth/google/callback`;

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
    });
  });
}

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
  fastify.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['openid', 'email', 'profile'],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID,
        secret: process.env.GOOGLE_CLIENT_SECRET,
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/google', // /api/auth/google
    callbackUri: GOOGLE_REDIRECT_URI,
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
    }

    const raw = String(username).trim();
    const u = raw.includes('@') ? raw.toLowerCase() : raw;
    const user = await dbGet(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [u, u]
    );
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
      // 1) Échange code ↔ token
      const tok = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const accessToken = tok?.access_token || tok?.token?.access_token;
      if (!accessToken) {
        req.log?.error?.({ at: 'google/callback', reason: 'no_access_token', tok });
        return reply.code(400).send({ ok: false, error_key: 'oauth.callback_failed' });
      }

      // 2) Userinfo OpenID
      const resp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        req.log?.error?.({ at: 'google/callback', reason: 'userinfo_failed', status: resp.status });
        return reply.code(400).send({ ok: false, error_key: 'oauth.userinfo_failed' });
      }
      const p = await resp.json();

      const googleEmail  = String(p.email || '').toLowerCase().trim();
      const googleName   = String(p.name || '').trim();
      const googleId     = String(p.sub || p.id || '').trim();
      const googleAvatar = String(p.picture || '').trim();
      if (!googleEmail) return reply.code(400).send({ ok: false, error: 'NO_EMAIL_FROM_GOOGLE' });

      // 3) Upsert user depuis Google
      const user = await upsertUserFromGoogle({ googleEmail, googleName, googleId, googleAvatar });

      // 4) 2FA obligatoire : envoi code + cookie pre2fa (PAS de session ici)
      await createAndSend2fa(user);
      const pre = jwt.sign({ uid: user.id, stage: 'pre2fa' }, JWT_SECRET, { expiresIn: '10m' });
      reply.setCookie('pre2fa', pre, { ...COOKIE_OPTS, maxAge: 600 });

      // 5) Redirection front STABLE (basée sur ENV, pas sur req.headers.host)
      const FRONT_REDIRECT_URI = process.env.FRONT_REDIRECT_URI || 'http://localhost:5173/login';
      const PUBLIC_FRONT_BASE  = process.env.PUBLIC_FRONT_BASE  || 'http://localhost:5173';

      let redirectUrl;
      try {
        // Si FRONT_REDIRECT_URI est absolue → URL la prend telle quelle.
        // Si elle est relative (/login) → résolue sur PUBLIC_FRONT_BASE.
        const u = new URL(FRONT_REDIRECT_URI, PUBLIC_FRONT_BASE);
        u.searchParams.set('mfa', '1'); // le front affiche l’écran de saisie du code
        redirectUrl = u.toString();
      } catch {
        // Fallback robuste si FRONT_REDIRECT_URI est bizarre
        redirectUrl = FRONT_REDIRECT_URI + (FRONT_REDIRECT_URI.includes('?') ? '&' : '?') + 'mfa=1';
      }

      return reply.redirect(redirectUrl);
    } catch (err) {
      req.log?.error?.({ at: 'google/callback', err: err?.message || err });
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
      if (!me) return reply.code(401).send({ error: 'Not authenticated' });
      return reply.send({ ok: true, user: me });
    } catch {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // ---------- Logout ----------
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('session', { path: '/' });
    reply.clearCookie('pre2fa', { path: '/' });
    return reply.send({ ok: true });
  });
}

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

module.exports = authRoute;
