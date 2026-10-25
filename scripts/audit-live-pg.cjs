// Read-only Postgres-level audit: RLS coverage, policies, auth user totals, indexes.
// Never writes. Usage: node scripts/audit-live-pg.cjs [--json]
require("dotenv").config({ path: ".env.local", quiet: true });
const { Client } = require("pg");

async function main() {
  const pass = process.env.SUPABASE_DB_PASSWORD;
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/([a-z0-9]{20})\.supabase\.co/);
  if (!pass || !ref) { console.error("Need SUPABASE_DB_PASSWORD + project URL env"); process.exit(2); }
  let c = null;
  const regions = ["us-east-1", "us-east-2", "eu-west-1", "eu-west-2", "eu-central-1", "ap-southeast-1", "ap-south-1"];
  for (const region of [...regions.flatMap(r => [`aws-1-${r}`, `aws-0-${r}`]), ...regions]) {
    const cand = new Client({
      host: `${region}.pooler.supabase.com`, port: 5432, database: "postgres",
      user: `postgres.${ref[1]}`, password: pass, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000,
    });
    try {
      await cand.connect();
      c = cand;
      console.error(`connected via pooler region ${region}`);
      break;
    } catch (e) {
      await cand.end().catch(() => {});
      console.error(`region ${region}: ${String(e).slice(0, 80)}`);
    }
  }
  if (!c) { console.error("Could not connect via any pooler region"); process.exit(3); }
  try {

    const tables = (await c.query(
      `SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND relkind='r' ORDER BY relname`
    )).rows;

    const policies = (await c.query(
      `SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`
    )).rows;

    const policiesByTable = {};
    for (const p of policies) (policiesByTable[p.tablename] ||= []).push(p);

    const noRls = tables.filter(t => !t.relrowsecurity);
    const rlsNoPolicies = tables.filter(t => t.relrowsecurity && !(policiesByTable[t.relname]?.length));

    const users = await c.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE confirmed_at IS NOT NULL)::int AS confirmed FROM auth.users`);
    const lastSignups = await c.query(`SELECT created_at FROM auth.users ORDER BY created_at DESC LIMIT 5`);

    const repr = await c.query(
      `SELECT relname, n_live_tup, last_analyze FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 15`);

    const storage = await c.query(
      `SELECT name, public FROM storage.buckets`);

    console.log(JSON.stringify({
      tableCount: tables.length,
      noRls,
      rlsTablesNoPolicies: rlsNoPolicies,
      policyCount: policies.length,
      auth: { ...users.rows[0], lastSignups: lastSignups.rows },
      storageBuckets: storage.rows,
      approxRows: repr.rows,
    }, null, 2));
  } finally {
    await c.end();
  }
}
main();
