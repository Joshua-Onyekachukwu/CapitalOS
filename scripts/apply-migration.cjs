// Generic production migration applier (2026-10-25).
//
// Usage:
//   node scripts/apply-migration.cjs <migration.sql> [skipIfSQL] [verifySQL]
//
//   <migration.sql>   Path to the migration file, relative to project root.
//   [skipIfSQL]       Optional SQL that returns rows; if the FIRST SELECT
//                     returns any rows the migration is considered already
//                     applied and the script exits 0 without executing.
//   [verifySQL]       Optional SQL printed after the run for confirmation.
//
// Connects to the live Supabase Postgres via the pooler (tries every region),
// requires SUPABASE_DB_PASSWORD. Migrations should be idempotent
// (ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING) — this script does not
// wrap them in a transaction that it can roll back mid-file.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Client } = require("pg");
const fs = require("fs");

async function connectPooler(ref) {
  const regions = ["us-east-1", "us-east-2", "eu-west-1", "eu-west-2", "eu-central-1", "ap-southeast-1", "ap-south-1"];
  for (const region of [...regions.flatMap((r) => [`aws-1-${r}`, `aws-0-${r}`]), ...regions]) {
    const cand = new Client({
      host: `${region}.pooler.supabase.com`,
      port: 5432,
      database: "postgres",
      user: `postgres.${ref}`,
      password: process.env.SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    try {
      await cand.connect();
      console.log(`connected via ${region}.pooler.supabase.com`);
      return cand;
    } catch {
      await cand.end().catch(() => {});
    }
  }
  return null;
}

async function main() {
  const file = process.argv[2];
  const skipIf = process.argv[3];
  const verifySql = process.argv[4];
  if (!file || !fs.existsSync(file)) {
    console.error("usage: node scripts/apply-migration.cjs <migration.sql> [skipIfSQL] [verifySQL]");
    process.exit(2);
  }
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/([a-z0-9]{20})\.supabase\.co/);
  if (!process.env.SUPABASE_DB_PASSWORD || !ref) {
    console.error("Need SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL env");
    process.exit(2);
  }

  const c = await connectPooler(ref[1]);
  if (!c) {
    console.error("could not connect via any pooler region");
    process.exit(3);
  }

  try {
    if (skipIf) {
      const { rows } = await c.query(skipIf);
      if (rows.length > 0) {
        console.log("skip: skipIf matched — migration already applied; nothing to do");
        return;
      }
    }

    console.log(`applying ${file} …`);
    await c.query(fs.readFileSync(file, "utf8"));
    console.log("applied OK");
    console.log(`wait 30-60s, then verify: ${verifySql || "(none)"}`);
  } finally {
    await c.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
