import dotenv from "dotenv";
import pg from "pg";
import { existsSync, readFileSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/demo-data/apply-sql.mjs <path.sql>");
  process.exit(1);
}

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});

const sql = readFileSync(file, "utf8");
try {
  await client.connect();
  await client.query(sql);
  console.log("applied:", file);
} catch (err) {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
