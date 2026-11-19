import dotenv from "dotenv";
import pg from "pg";
import { existsSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
await c.connect();

const BATCH = "demo-2026-11";

const health = await c.query(
  `select
     count(*)::int as rows,
     count(*) filter (where email is null)::int as no_email,
     count(*) filter (where email not like '%.example')::int as unsafe_email,
     count(*) filter (where investment_thesis is null or btrim(investment_thesis) = '')::int as no_thesis,
     count(*) filter (where max_check_size is null)::int as no_cheque,
     count(*) filter (where current_firm_id is null)::int as no_firm,
     count(distinct source_id)::int as distinct_source_ids,
     count(*) filter (where is_synthetic)::int as flagged
   from investors where demo_batch = $1`,
  [BATCH]
);
console.log("investor health:", JSON.stringify(health.rows[0]));

const by = async (col) => {
  const { rows } = await c.query(
    `select ${col} as v, count(*)::int n from investors where demo_batch=$1 group by 1 order by n desc limit 6`,
    [BATCH]
  );
  return rows.map((r) => `${r.v}:${r.n}`).join(", ");
};
console.log("types:", await by("investor_type"));
console.log("stages:", await by("investment_stages[1]"));
console.log("countries:", await by("country"));
console.log("readiness:", await by("outreach_readiness"));

const sample = await c.query(
  `select full_name, job_title, email, country, city, investor_type, investment_stages, investment_sectors,
          min_check_size, max_check_size, left(investment_thesis, 120) thesis, portfolio_count,
          data_quality_score, is_verified, last_investment_date, lead_preference
   from investors where demo_batch=$1 order by random() limit 2`,
  [BATCH]
);
console.log("\nsample investors:");
for (const r of sample.rows) console.log(JSON.stringify(r));

const founder = await c.query(
  `select company_name, industry, company_stage, country, one_liner, mrr, customer_count, readiness_score, founder_name, founder_email
   from demo_founders where demo_batch=$1 order by random() limit 2`,
  [BATCH]
);
console.log("\nsample founders:");
for (const r of founder.rows) console.log(JSON.stringify(r));

const meta = await c.query(`select total, synthetic, with_email, with_thesis, with_cheque, refreshed_at from investor_facet_meta`);
console.log("\nfacet meta:", JSON.stringify(meta.rows[0]));

const facets = await c.query(`select dimension, count(*)::int as values from investor_facets group by 1 order by 1`);
console.log("facet dimensions:", facets.rows.map((r) => `${r.dimension}:${r.values}`).join(", "));

const found = await c.query(`select count(*)::int n from demo_founders where founder_email like '%@founders.demo.capitalos.example'`);
console.log("founder emails on demo domain:", found.rows[0].n);

await c.end();
