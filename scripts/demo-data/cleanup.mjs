#!/usr/bin/env node
/**
 * Post-load cleanup.
 *
 * 1. A synthetic address can never be "verified" — clear any that slipped in
 *    from an older generator run.
 * 2. Remove long-finished background jobs so the admin view is not noise.
 * 3. Reclaim space and refresh statistics for the tables the app reads.
 * 4. Rebuild the facet rollup.
 *
 * Usage: node scripts/demo-data/cleanup.mjs [batch]
 */

import dotenv from "dotenv";
import pg from "pg";
import { existsSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });
const BATCH = process.argv[2] || "demo-2026-11";
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 0 });
c.on("error", (e) => console.log("socket:", e.message.slice(0, 60)));
await c.connect();

const run = async (label, sql, values) => {
  try {
    const res = await c.query(sql, values);
    console.log(`${label}: ${res.rowCount ?? "ok"}`);
  } catch (err) {
    console.log(`${label}: SKIPPED (${err.message.slice(0, 90)})`);
  }
};

await run(
  "synthetic rows marked verified (cleared)",
  `update public.investors
   set is_verified = false,
       last_verified_at = null,
       verification_status = case when verification_status = 'verified' then 'derived' else verification_status end
   where demo_batch = $1 and is_verified`,
  [BATCH]
);

await run(
  "old finished background jobs (removed)",
  `delete from public.background_jobs
   where status in ('completed', 'failed', 'cancelled')
     and created_at < now() - interval '7 days'`
);

await run(
  "stale duplicate candidates (removed)",
  `delete from public.duplicate_candidates
   where created_at < now() - interval '90 days'`
);

for (const table of ["investors", "investor_firms", "demo_founders", "waitlist", "investor_facets"]) {
  await run(`vacuum analyze ${table}`, `vacuum (analyze) public.${table}`);
}

await run("facet rollup refreshed", `select public.refresh_investor_facets()`);

const size = await c.query(`select pg_size_pretty(pg_database_size(current_database())) db`);
console.log("database size:", size.rows[0].db);

await c.end();
