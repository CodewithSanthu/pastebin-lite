const express = require("express");
const { v4: uuidv4 } = require("uuid");
const serverless = require("serverless-http");
const sql = require("./db");

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

app.get("/", (req, res) => {
  res.send("Pastebin Lite API is running");
});


// Health check
app.get("/api/healthz", async (req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ ok: true });
  } catch (_) {
    res.status(500).json({ ok: false });
  }
});

// Create paste
app.post("/api/pastes", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }

  const id = uuidv4();
  const created_at = Date.now();

  try {
    await sql`
      INSERT INTO pastes (id, content, ttl_seconds, max_views, created_at)
      VALUES (${id}, ${content}, ${ttl_seconds ?? null}, ${max_views ?? null}, ${created_at})
    `;

    return res.json({
      id,
      url: `${req.protocol}://${req.get("host")}/p/${id}`
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "database error" });
  }
});

async function fetchPaste(id, req) {
  const rows = await sql`
    SELECT * FROM pastes WHERE id = ${id}
  `;

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

// API view
app.get("/api/pastes/:id", async (req, res) => {
  try {
    const paste = await fetchPaste(req.params.id, req);
    if (!paste) return res.status(404).json({ error: "Not found" });

    await sql`
      UPDATE pastes SET views = views + 1 WHERE id = ${paste.id}
    `;

    let expires_at = null;
    if (paste.ttl_seconds) {
      expires_at = new Date(
        paste.created_at + paste.ttl_seconds * 1000
      ).toISOString();
    }

    return res.json({
      content: paste.content,
      remaining_views: paste.max_views
        ? paste.max_views - (paste.views + 1)
        : null,
      expires_at
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
});

// HTML view
app.get("/p/:id", async (req, res) => {
  try {
    const paste = await fetchPaste(req.params.id, req);
    if (!paste) return res.status(404).send("Not Found");

    await sql`
      UPDATE pastes SET views = views + 1 WHERE id = ${paste.id}
    `;

    return res.render("paste", { content: paste.content });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server Error");
  }
});

module.exports = serverless(app);
