const { Pool } = require("pg");
DATABASE_URL='postgresql://neondb_owner:npg_yi6GFfgIbD2O@ep-late-butterfly-a4x0gick-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const pool = new Pool({
  connectionString: DATABASE_URL,
});

module.exports = async (req, res) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS urls (
      id SERIAL PRIMARY KEY,
      original TEXT NOT NULL,
      short TEXT NOT NULL UNIQUE
    );
  `);

  res.json({ message: "Neon DB ready!" });
};
