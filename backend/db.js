const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Dossier "data" créé.');
}

const db = new sqlite3.Database('data/app.sqlite', (err) => {
  if (err) {
    console.error('Could not open database', err);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`)});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    alias TEXT UNIQUE,
    avatar_url TEXT,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    win_streak INTEGER NOT NULL DEFAULT 0,
    elo INTEGER NOT NULL DEFAULT 0,
    twofa_code_hash TEXT,
    twofa_code_expires INTEGER,
    twofa_last_sent INTEGER,
    last_seen INTEGER DEFAULT 0
  )
`, (err) => {
  if (err) {
    console.error('Error creating table', err);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id),
    FOREIGN KEY(user_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Error creating table', err);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    score_p1 INTEGER NOT NULL DEFAULT 0,
    score_p2 INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    winner_id INTEGER,
    CHECK (player1_id != player2_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating table', err);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    UNIQUE(token_hash),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.serialize(() => {
  db.get(`SELECT id FROM users WHERE username = 'AI'`, (err, row) => {
    if (err) {
      console.error('Erreur vérif IA:', err);
    } else if (!row) {
      const bcrypt = require('bcrypt');
      const hash = bcrypt.hashSync('ai-password', 10);

      db.run(
        `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        ['AI', 'ai@pong.local', hash],
        function (err2) {
          if (err2) {
            console.error('Erreur insertion IA:', err2);
          } else {
            console.log('Utilisateur IA créé avec id', this.lastID);
          }
        }
      );
    }
  });
});

module.exports = db;