const { neon } = require("@neondatabase/serverless");

const sql = neon(
  process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_yi6GFfgIbD2O@ep-late-butterfly-a4x0gick-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
);

module.exports = sql;
