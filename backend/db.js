const sqlite3 = require('sqlite3').verbose();

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
    twofa_code_hash TEXT,
    twofa_code_expires INTEGER,
    twofa_last_sent INTEGER
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

module.exports = db;