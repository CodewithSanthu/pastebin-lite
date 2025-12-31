const express = require("express");
const { v4: uuidv4 } = require("uuid");
const serverless = require("serverless-http");
const db = require("../db");
const app = express();

app.use(express.json());
app.set("view engine", "ejs");

const TEST_MODE = process.env.TEST_MODE === "1";


function getCurrentTime(req) {
  if (TEST_MODE && req.headers["x-test-now-ms"]) {
    return parseInt(req.headers["x-test-now-ms"]);
  }
  return Date.now();
}

// Health Check
app.get("/api/healthz", (req, res) => {
  db.get("SELECT 1", [], (err) => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true });
  });
});

// Create Paste
app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }

  if (ttl_seconds !== undefined && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "ttl_seconds must be >= 1" });
  }

  if (max_views !== undefined && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: "max_views must be >= 1" });
  }

  const id = uuidv4();
  const created_at = Date.now();

  db.run(
    `INSERT INTO pastes (id, content, ttl_seconds, max_views, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, content, ttl_seconds ?? null, max_views ?? null, created_at],
    (err) => {
      if (err) return res.status(500).json({ error: "database error" });

      res.json({
        id,
        url: `${req.protocol}://${req.get("host")}/p/${id}`
      });
    }
  );
});

function fetchPaste(id, req, callback) {
  db.get(`SELECT * FROM pastes WHERE id=?`, [id], (err, paste) => {
    if (err || !paste) return callback(null);

    const now = getCurrentTime(req);

    if (paste.ttl_seconds) {
      const expiresAt = paste.created_at + paste.ttl_seconds * 1000;
      if (now >= expiresAt) return callback(null);
    }

    if (paste.max_views !== null && paste.views >= paste.max_views) {
      return callback(null);
    }

    callback(paste);
  });
}

// API View
app.get("/api/pastes/:id", (req, res) => {
  fetchPaste(req.params.id, req, (paste) => {
    if (!paste) return res.status(404).json({ error: "Not found" });

    db.run(`UPDATE pastes SET views = views + 1 WHERE id=?`, [paste.id]);

    const now = getCurrentTime(req);
    let expires_at = null;

    if (paste.ttl_seconds) {
      expires_at = new Date(paste.created_at + paste.ttl_seconds * 1000).toISOString();
    }

    res.json({
      content: paste.content,
      remaining_views: paste.max_views ? paste.max_views - (paste.views + 1) : null,
      expires_at
    });
  });
});

// HTML View
app.get("/p/:id", (req, res) => {
  fetchPaste(req.params.id, req, (paste) => {
    if (!paste) return res.status(404).send("Not Found");

    db.run(`UPDATE pastes SET views = views + 1 WHERE id=?`, [paste.id]);

    res.render("paste", { content: paste.content });
  });
});

module.exports = serverless(app);