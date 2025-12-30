const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./pastes.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS pastes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      ttl_seconds INTEGER,
      max_views INTEGER,
      created_at INTEGER,
      views INTEGER DEFAULT 0
    )
  `);
});

module.exports = db;