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
app.get("/api/healthz", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

// Create Paste
app.post("/api/pastes", async (req, res) => {
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

  try {
    await db.query(
      `INSERT INTO pastes (id, content, ttl_seconds, max_views, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, content, ttl_seconds ?? null, max_views ?? null, created_at]
    );

    res.json({
      id,
      url: `${req.protocol}://${req.get("host")}/p/${id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

async function fetchPaste(id, req) {
  const { rows } = await db.query(`SELECT * FROM pastes WHERE id = $1`, [id]);
  const paste = rows[0];
  if (!paste) return null;

  const now = getCurrentTime(req);

  if (paste.ttl_seconds) {
    const expiresAt = paste.created_at + paste.ttl_seconds * 1000;
    if (now >= expiresAt) return null;
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return null;
  }

  return paste;
}

// API View
app.get("/api/pastes/:id", async (req, res) => {
  try {
    const paste = await fetchPaste(req.params.id, req);
    if (!paste) return res.status(404).json({ error: "Not found" });

    await db.query(`UPDATE pastes SET views = views + 1 WHERE id = $1`, [paste.id]);

    let expires_at = null;
    if (paste.ttl_seconds) {
      expires_at = new Date(paste.created_at + paste.ttl_seconds * 1000).toISOString();
    }

    res.json({
      content: paste.content,
      remaining_views: paste.max_views ? paste.max_views - (paste.views + 1) : null,
      expires_at
    });
  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

// HTML View
app.get("/p/:id", async (req, res) => {
  try {
    const paste = await fetchPaste(req.params.id, req);
    if (!paste) return res.status(404).send("Not Found");

    await db.query(`UPDATE pastes SET views = views + 1 WHERE id = $1`, [paste.id]);

    res.render("paste", { content: paste.content });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = serverless(app);
