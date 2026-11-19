import dotenv from "dotenv";
import pg from "pg";
import { existsSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
await c.connect();

const { rows } = await c.query(`
  select pid, state, wait_event_type, wait_event,
         now() - query_start as runtime,
         left(regexp_replace(query, '\\s+', ' ', 'g'), 120) as q
  from pg_stat_activity
  where datname = current_database() and pid <> pg_backend_pid()
    and state <> 'idle'
  order by runtime desc nulls last
  limit 8
`);
for (const r of rows) console.log(JSON.stringify(r));

const { rows: locks } = await c.query(`
  select count(*)::int blocked from pg_stat_activity where wait_event_type = 'Lock'
`);
console.log("blocked sessions:", locks[0].blocked);

await c.end();
