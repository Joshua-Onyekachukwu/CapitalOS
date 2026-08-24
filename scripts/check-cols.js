require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 30000 });
  await c.connect();
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'investors' ORDER BY ordinal_position");
  console.log("Total: " + r.rows.length + " columns");
  const needed = ["currently_active","overall_lead_score","activity_score","contactability_score","industry_match_score","investment_capacity_score","investor_relevance_score","date_scraped","source_url","investments_last_12_months","investments_last_24_months"];
  const existing = new Set(r.rows.map(r => r.column_name));
  for (const n of needed) {
    console.log((existing.has(n) ? "✅" : "❌") + " " + n);
  }
  await c.end();
})();
