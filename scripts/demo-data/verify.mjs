import dotenv from "dotenv";
import pg from "pg";
import { existsSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 0 });
c.on("error", (e) => console.log("socket:", e.message.slice(0, 60)));
await c.connect();

const BATCH = process.argv[2] || "demo-2026-11";
let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const health = await c.query(
  `select
     count(*)::int as rows,
     count(*) filter (where email is null)::int as no_email,
     count(*) filter (where email not like '%.example')::int as unsafe_email,
     count(*) filter (where email like '%.example' and email not like '%@%.%')::int as malformed,
     count(*) filter (where investment_thesis is null or btrim(investment_thesis) = '')::int as no_thesis,
     count(*) filter (where max_check_size is null)::int as no_cheque,
     count(distinct source_id)::int as distinct_source_ids,
     count(distinct email) filter (where email is not null)::int as distinct_emails,
     count(*) filter (where not is_synthetic)::int as unflagged
   from investors where demo_batch = $1`,
  [BATCH]
);
const h = health.rows[0];
console.log("investor health:", JSON.stringify(h));
check("every row flagged synthetic", h.unflagged === 0, `${h.unflagged} unflagged`);
check("no non-.example email", h.unsafe_email === 0, `${h.unsafe_email} unsafe`);
check("emails well formed", h.malformed === 0, `${h.malformed} malformed`);
check("thesis on every row", h.no_thesis === 0, `${h.no_thesis} missing`);
check("cheque size on every row", h.no_cheque === 0, `${h.no_cheque} missing`);
check("source_id unique", h.distinct_source_ids === h.rows, `${h.distinct_source_ids}/${h.rows}`);
check("emails unique", h.distinct_emails === h.rows - h.no_email, `${h.distinct_emails} emails`);

const founders = await c.query(
  `select count(*)::int rows,
          count(*) filter (where is_synthetic)::int flagged,
          count(distinct founder_email)::int emails
   from demo_founders where demo_batch = $1`,
  [BATCH]
);
console.log("founders:", JSON.stringify(founders.rows[0]));
check("founders flagged synthetic", founders.rows[0].rows === founders.rows[0].flagged);

const firms = await c.query(
  `select count(*)::int rows, count(*) filter (where not is_synthetic)::int unflagged
   from investor_firms where demo_batch = $1`,
  [BATCH]
);
console.log("firms:", JSON.stringify(firms.rows[0]));
check("firms flagged synthetic", firms.rows[0].unflagged === 0);

const waitlist = await c.query(
  `select count(*)::int rows,
          count(*) filter (where is_synthetic)::int flagged,
          count(*) filter (where source = 'demo_synthetic')::int demo_source
   from waitlist where demo_batch = $1`,
  [BATCH]
);
console.log("waitlist:", JSON.stringify(waitlist.rows[0]));
check("waitlist flagged synthetic", waitlist.rows[0].rows === waitlist.rows[0].flagged);
check("waitlist source labelled", waitlist.rows[0].rows === waitlist.rows[0].demo_source);

const by = async (col, limit = 8) => {
  const { rows } = await c.query(
    `select ${col} as v, count(*)::int n from investors where demo_batch=$1
     group by 1 order by n desc limit ${limit}`,
    [BATCH]
  );
  return rows.map((r) => `${r.v}:${r.n}`).join(", ");
};
console.log("\nprimary stage:", await by("investment_stages[1]"));
console.log("type:", await by("investor_type"));
console.log("country:", await by("country", 10));
console.log("readiness:", await by("outreach_readiness"));

const stageMix = await c.query(
  `select investment_stages[1] as stage, count(*)::int n from investors
   where demo_batch=$1 group by 1 order by n desc`,
  [BATCH]
);
const top = stageMix.rows[0];
const stageShare = top ? top.n / h.rows : 0;
check("pre-seed/seed dominant", ["pre_seed", "seed"].includes(top?.stage) && stageShare > 0.4,
  `${top?.stage} ${(stageShare * 100).toFixed(0)}%`);

const geo = await c.query(
  `select country, count(*)::int n from investors where demo_batch=$1 group by 1 order by n desc limit 1`,
  [BATCH]
);
check("United States leads", geo.rows[0]?.country === "United States", `${geo.rows[0]?.country} ${geo.rows[0]?.n}`);

const samples = await c.query(
  `select full_name, country, job_title, email from investors
   where demo_batch=$1 order by random() limit 6`,
  [BATCH]
);
console.log("\nsample people:");
for (const r of samples.rows) console.log(" ", JSON.stringify(r));

const fs = await c.query(
  `select company_name, founder_name, country, industry, company_stage, founder_email
   from demo_founders where demo_batch=$1 order by random() limit 4`,
  [BATCH]
);
console.log("\nsample founders:");
for (const r of fs.rows) console.log(" ", JSON.stringify(r));

const meta = await c.query(
  `select total, synthetic, with_email, with_thesis, with_cheque, refreshed_at from investor_facet_meta`
);
console.log("\nfacet meta:", JSON.stringify(meta.rows[0]));
check("rollup includes synthetic count", (meta.rows[0]?.synthetic || 0) > 0);
check("rollup is fresh", meta.rows[0]?.refreshed_at && Date.now() - new Date(meta.rows[0].refreshed_at).getTime() < 3600_000);

const facets = await c.query(`select dimension, count(*)::int as values from investor_facets group by 1 order by 1`);
console.log("facet dimensions:", facets.rows.map((r) => `${r.dimension}:${r.values}`).join(", "));

const size = await c.query(`select pg_size_pretty(pg_database_size(current_database())) db`);
console.log("database size:", size.rows[0].db);

await c.end();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
