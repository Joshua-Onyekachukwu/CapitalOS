import dotenv from "dotenv";
import pg from "pg";
import { existsSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });
await c.connect();

const size = await c.query(
  `select pg_size_pretty(pg_database_size(current_database())) as db,
          pg_database_size(current_database())::bigint as db_bytes,
          current_setting('server_version') as pg`
);
console.log("database:", JSON.stringify(size.rows[0]));

const tables = await c.query(
  `select relname as table,
          pg_size_pretty(pg_total_relation_size(c.oid)) as total,
          pg_total_relation_size(c.oid)::bigint as bytes,
          (select count(*) from pg_class where false) as _x
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by pg_total_relation_size(c.oid) desc
   limit 15`
);
for (const r of tables.rows) console.log(`${r.table}: ${r.total}`);

const counts = await c.query(
  `select
     (select count(*) from investors)::int as investors,
     (select count(*) from investors where is_synthetic)::int as synthetic_investors,
     (select count(*) from investor_firms)::int as firms,
     (select count(*) from investor_firms where is_synthetic)::int as synthetic_firms,
     (select count(*) from company_profiles)::int as company_profiles,
     (select count(*) from waitlist)::int as waitlist,
     (select count(*) from auth.users)::int as auth_users`
);
console.log("counts:", JSON.stringify(counts.rows[0]));

await c.end();
