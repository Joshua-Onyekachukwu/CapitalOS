// Shared Postgres access for maintenance scripts.
//
// Connects to the project's Supabase Postgres through the connection pooler.
// The pooler hostname is region-specific and answers "tenant/user ... not
// found" when you guess the wrong region, so the region is discovered once and
// cached in .migration-region (git-ignored) to make every later call instant.
//
// Usage:
//   const { query, getClient, close } = require("./db.cjs");
//   const rows = await query("select count(*)::int n from public.investors");
require("dotenv").config({ path: ".env.local", quiet: true });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const REGION_CACHE = path.join(__dirname, "..", ".migration-region");

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/([a-z0-9]{20})\.supabase\.co/);
  if (!m) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL");
  return m[1];
}

function clientFor(region, ref) {
  return new Client({
    host: `${region}.pooler.supabase.com`,
    port: 5432,
    database: "postgres",
    user: `postgres.${ref}`,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
}

/**
 * Try the cached region first, then every plausible pooler host.
 * Distinguishes "wrong region" (tenant not found) from "wrong password"
 * (28P01) so the failure message is actionable.
 */
async function connect() {
  if (!process.env.SUPABASE_DB_PASSWORD) {
    throw new Error(
      "SUPABASE_DB_PASSWORD is not set in .env.local. Reset it in Supabase -> Project Settings -> Database."
    );
  }
  const ref = projectRef();

  const regions = [
    "us-east-1", "us-east-2", "eu-west-1", "eu-west-2", "eu-central-1",
    "ap-southeast-1", "ap-south-1", "ca-central-1", "ap-northeast-1",
  ];
  const hosts = [
    ...regions.flatMap((r) => [`aws-1-${r}`, `aws-0-${r}`]),
    ...regions.map((r) => r),
  ];

  // Put the cached region first.
  let preferred = null;
  try {
    preferred = fs.readFileSync(REGION_CACHE, "utf8").trim();
  } catch {
    // no cache yet
  }
  if (preferred) hosts.unshift(preferred);

  const failures = [];
  let authFailedAt = null;

  for (const host of [...new Set(hosts)]) {
    const candidate = clientFor(host, ref);
    try {
      await candidate.connect();
      if (preferred !== host) fs.writeFileSync(REGION_CACHE, host);
      return candidate;
    } catch (err) {
      await candidate.end().catch(() => {});
      failures.push(`${host}: ${err.code || ""} ${err.message}`);
      if (err.code === "28P01" || /password authentication failed/i.test(err.message)) {
        authFailedAt = host;
      }
    }
  }

  if (authFailedAt) {
    throw new Error(
      `Reached project ${ref} via ${authFailedAt} but authentication failed — ` +
        "SUPABASE_DB_PASSWORD in .env.local is stale. Reset it in Supabase -> Project Settings -> Database, then update .env.local."
    );
  }
  throw new Error(
    `Could not reach project ${ref} through any pooler host. First attempts:\n  ` +
      failures.slice(0, 5).join("\n  ")
  );
}

// One pooled connection reused across calls. Opening a fresh pooler
// connection per query is slow and intermittently times out, so keep one alive
// and reconnect transparently when it drops.
let _client = null;

async function getClient() {
  if (_client) return _client;
  _client = await connect();
  _client.on("error", () => {
    _client = null;
  });
  _client.on("end", () => {
    _client = null;
  });
  return _client;
}

async function query(text, params) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const c = await getClient();
      return (await c.query(text, params)).rows;
    } catch (err) {
      // Connection-level failures are worth one retry; SQL errors are not.
      const transient = /timeout expired|ECONNRESET|Connection terminated|not queryable/i.test(
        err.message || ""
      );
      _client = null;
      if (!transient || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

/** Run several statements on one connection (no implicit transaction). */
async function withClient(fn) {
  const c = await getClient();
  return fn(c);
}

/** Close the shared connection (call at the end of a script). */
async function close() {
  if (_client) {
    const c = _client;
    _client = null;
    await c.end().catch(() => {});
  }
}

module.exports = { query, connect, withClient, close, projectRef };

// ── Ad-hoc CLI ─────────────────────────────────────────────────────────────
//   node scripts/db.cjs "select count(*) from investors"
//   node scripts/db.cjs --file path/to/query.sql
// Prints rows as JSON. Read-only intent, but nothing stops a write — be
// deliberate with what you pass.
if (require.main === module) {
  const fs = require("fs");
  const arg = process.argv[2];
  const sql =
    arg === "--file" ? fs.readFileSync(process.argv[3], "utf8") : process.argv.slice(2).join(" ");
  if (!sql) {
    console.error('usage: node scripts/db.cjs "<sql>"  |  node scripts/db.cjs --file <path>');
    process.exit(2);
  }
  (async () => {
    try {
      const rows = await query(sql);
      console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      process.exitCode = 1;
    } finally {
      await close();
    }
  })();
}
