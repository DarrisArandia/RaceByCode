// config/db.js
//
// This file's ONE job: create a single, shared connection "pool" to PostgreSQL and hand it out to whichever route/controller file needs to run a query.
//
// Why a "pool" instead of one connection?
// Every time a request comes in (a student submitting an answer, an instructor loading analytics, etc.), the server needs to talk to the database. Opening a brand-new connection for every single request is slow and can exhaust the database's connection limit under load. A "pool" is a small, reusable set of already-open connections. When your code asks for one, it borrows a connection from the pool, runs the query, and gives it back automatically.

const { Pool } = require("pg");

// Values below come from your .env file (never hard-code real credentials here).
// Expected .env keys:
//   DB_HOST=localhost
//   DB_PORT=5432
//   DB_NAME=race_by_code
//   DB_USER=your_postgres_user
//   DB_PASSWORD=your_postgres_password
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Safety limits so one runaway spike of requests can't open unlimited connections and crash Postgres. 10 is a reasonable default for a student capstone / small class deployment.
  max: 10,
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast (5s) if the DB is unreachable
});

// If a connection in the pool errors out unexpectedly while just sitting idle (e.g. the DB restarted), this stops that error from crashing the whole Node process. We log it instead so the server stays up for other requests.
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err.message);
});

// A small wrapper around pool.query (). Every route file will call this instead of importing `pg` directly — that way, if we ever need to add query logging or timing, we only change it in one place.
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Simple query logging while developing. Safe to remove/comment out
  // later, or gate behind NODE_ENV === 'development' if it gets noisy.
  console.log("Executed query", {
    text,
    duration: `${duration}ms`,
    rows: result.rowCount,
  });

  return result;
}

// A one-time connectivity check, called from server.js at startup so you
// find out immediately if the DB is unreachable, instead of only discovering
// it on the first real request.
async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT NOW()");
    console.log("PostgreSQL connection successful.");
  } finally {
    client.release(); // ALWAYS release a manually-checked-out client back to the pool
  }
}

// `pool` is also exported directly because some operations (like multi-step
// transactions in matchRoutes.js later — e.g. "insert match result AND update
// rank in one atomic step") need to check out a single client with
// client.query('BEGIN') / 'COMMIT' / 'ROLLBACK', rather than the one-off
// `query()` helper above.
module.exports = { pool, query, testConnection };
