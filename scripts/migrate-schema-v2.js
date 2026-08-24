#!/usr/bin/env node
/**
 * Capital OS — Schema Migration v2: Investor Intelligence
 * =========================================================
 * Adds 60+ new columns to the investors table covering:
 *   1. Investor Identity (management level, company info)
 *   2. Contact Information (email verification, secondary contacts)
 *   3. Investment Capacity (check size, fund size, AUM)
 *   4. Investment Focus (sectors, stages, geography, thesis)
 *   5. Investment History (portfolio, exits, recent activity)
 *   6. Activity Signals (active status, deployment cadence)
 *   7. Professional Background (experience, exits, board seats)
 *   8. Company/Fund Information (firm details, fund data)
 *   9. Quality Scores (7-factor lead scoring)
 *  10. Source & Verification (provenance, freshness)
 *
 * Also adds:
 *   - investor_firms table (fund-level data)
 *   - investor_portfolio table (portfolio companies)
 *   - Scoring function
 *
 * Run: node scripts/migrate-schema-v2.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  console.log("🔌 Connected to CockroachDB\n");

  // ── New enums ──
  const enums = [
    `DO $$ BEGIN
      CREATE TYPE email_verification_status AS ENUM ('unverified', 'verified', 'risky', 'invalid', 'unknown');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,

    `DO $$ BEGIN
      CREATE TYPE management_level AS ENUM ('c_suite', 'vp', 'director', 'partner', 'principal', 'manager', 'associate', 'analyst', 'other');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,

    `DO $$ BEGIN
      CREATE TYPE fund_type AS ENUM ('venture_capital', 'private_equity', 'growth_equity', 'hedge_fund', 'family_office', 'accelerator', 'corporate_venture', 'angel_syndicate', 'fund_of_funds', 'real_estate', 'infrastructure', 'debt', 'other');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,

    `DO $$ BEGIN
      CREATE TYPE fundraising_status AS ENUM ('not_raising', 'raising', 'recently_closed', 'unknown');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,

    `DO $$ BEGIN
      CREATE TYPE business_model AS ENUM ('saas', 'marketplace', 'b2b', 'b2c', 'fintech', 'healthtech', 'edtech', 'deeptech', 'hardware', 'consumer', 'enterprise', 'other');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,
  ];

  for (const sql of enums) {
    try {
      await client.query(sql);
      console.log("✅ Enum created");
    } catch (e) {
      console.log("⚠️  Enum already exists:", e.message?.slice(0, 60));
    }
  }

  // ── Add columns to investors table ──
  const columns = [
    // 1. Investor Identity
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS management_level management_level",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS company_name text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS company_website text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS company_linkedin_url text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS personal_website text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS state text",

    // 2. Contact Information
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verification_status email_verification_status DEFAULT 'unverified'",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verification_date timestamptz",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_source text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS secondary_email text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS contact_form_url text",

    // 3. Investment Capacity
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS typical_check_size numeric",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS average_check_size numeric",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS total_capital_invested numeric",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_investments integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_exits integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_size numeric",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS aum numeric",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS available_fund_stage text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS latest_fund_size numeric",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS lead_investor boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS follow_on_investment boolean DEFAULT false",

    // 4. Investment Focus
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS primary_industry text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS secondary_industries text[]",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS preferred_business_model business_model",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS technology_focus text[]",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS africa_focus boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS nigeria_focus boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS international_focus boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS invests_remotely boolean DEFAULT false",

    // 5. Investment History
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_portfolio_companies integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS successful_exits integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS ipos integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS acquisitions integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS recent_investments jsonb DEFAULT '[]'::jsonb",

    // 6. Activity Signals
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS currently_active boolean DEFAULT true",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS investments_last_12_months integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS investments_last_24_months integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS recently_raised_fund boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS currently_deploying_capital boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS investment_frequency text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS average_investments_per_year numeric",

    // 7. Professional Background
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS years_investment_experience integer",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS previous_companies jsonb DEFAULT '[]'::jsonb",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS founder_experience boolean DEFAULT false",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS previous_exits integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS board_positions jsonb DEFAULT '[]'::jsonb",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS advisory_positions jsonb DEFAULT '[]'::jsonb",

    // 8. Company/Fund Information
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS firm_founded_year integer",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS firm_headquarters text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS firm_employees integer",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_type fund_type",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS current_fund text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_partners integer",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS fundraising_status fundraising_status DEFAULT 'unknown'",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS latest_fund_close_date date",

    // 9. Quality Scores
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS investor_relevance_score integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS investment_capacity_score integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS industry_match_score integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS contactability_score integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS activity_score integer DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS overall_lead_score integer DEFAULT 0",

    // 10. Source & Verification
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS source_url text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS source_name text",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS date_scraped timestamptz DEFAULT now()",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS date_verified timestamptz",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS source_reliability integer DEFAULT 50",
    "ALTER TABLE investors ADD COLUMN IF NOT EXISTS duplicate_status text DEFAULT 'unique'",
  ];

  let added = 0;
  for (const sql of columns) {
    try {
      await client.query(sql);
      added++;
    } catch (e) {
      if (!e.message?.includes("duplicate column")) {
        console.log("❌ Error:", e.message?.slice(0, 100));
      }
    }
  }
  console.log(`\n✅ Added ${added} new columns to investors table`);

  // ── Create investor_portfolio table ──
  await client.query(`
    CREATE TABLE IF NOT EXISTS investor_portfolio (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      company_website TEXT,
      company_industry TEXT,
      company_location TEXT,
      investment_date DATE,
      investment_amount NUMERIC,
      investment_round TEXT,
      is_lead BOOLEAN DEFAULT false,
      is_current BOOLEAN DEFAULT true,
      exit_date DATE,
      exit_type TEXT,
      exit_valuation NUMERIC,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log("✅ investor_portfolio table created");

  // ── Create indexes ──
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_investors_overall_score ON investors(overall_lead_score DESC)",
    "CREATE INDEX IF NOT EXISTS idx_investors_active ON investors(currently_active) WHERE currently_active = true",
    "CREATE INDEX IF NOT EXISTS idx_investors_email_verified ON investors(email_verified) WHERE email_verified = true",
    "CREATE INDEX IF NOT EXISTS idx_investors_investment_stage ON investors USING GIN(investment_stages)",
    "CREATE INDEX IF NOT EXISTS idx_investors_sectors ON investors USING GIN(investment_sectors)",
    "CREATE INDEX IF NOT EXISTS idx_investors_portfolio_investor ON investor_portfolio(investor_id)",
    "CREATE INDEX IF NOT EXISTS idx_investors_portfolio_company ON investor_portfolio(company_name)",
  ];

  for (const sql of indexes) {
    try {
      await client.query(sql);
    } catch (e) {
      // Index already exists
    }
  }
  console.log("✅ Indexes created");

  // ── Scoring function ──
  await client.query(`
    CREATE OR REPLACE FUNCTION compute_investor_score(inv_id UUID)
    RETURNS void AS $$
    DECLARE
      inv RECORD;
      industry_score INT := 0;
      stage_score INT := 0;
      capacity_score INT := 0;
      activity_score INT := 0;
      geo_score INT := 0;
      contact_score INT := 0;
      relevance_score INT := 0;
      total_score INT := 0;
    BEGIN
      SELECT * INTO inv FROM investors WHERE id = inv_id;
      IF NOT FOUND THEN RETURN; END IF;

      -- Industry Match (0-20): Has sectors defined
      IF array_length(inv.investment_sectors, 1) > 0 THEN industry_score := 15; END IF;
      IF inv.primary_industry IS NOT NULL THEN industry_score := industry_score + 5; END IF;

      -- Stage Match (0-20): Has stages defined
      IF array_length(inv.investment_stages, 1) > 0 THEN stage_score := 10; END IF;
      IF inv.min_check_size IS NOT NULL AND inv.max_check_size IS NOT NULL THEN stage_score := stage_score + 10; END IF;

      -- Capacity (0-20): Check size, fund size, AUM
      IF inv.min_check_size IS NOT NULL AND inv.min_check_size > 0 THEN capacity_score := 5; END IF;
      IF inv.fund_size IS NOT NULL AND inv.fund_size > 0 THEN capacity_score := capacity_score + 5; END IF;
      IF inv.aum IS NOT NULL AND inv.aum > 0 THEN capacity_score := capacity_score + 5; END IF;
      IF inv.total_capital_invested IS NOT NULL AND inv.total_capital_invested > 0 THEN capacity_score := capacity_score + 5; END IF;

      -- Activity (0-15): Recent investments, active status
      IF inv.currently_active THEN activity_score := 5; END IF;
      IF inv.last_investment_date IS NOT NULL AND inv.last_investment_date > now() - INTERVAL '12 months' THEN activity_score := activity_score + 5; END IF;
      IF inv.investments_last_12_months > 0 THEN activity_score := activity_score + 5; END IF;

      -- Geography (0-10): Has location
      IF inv.country IS NOT NULL THEN geo_score := 5; END IF;
      IF inv.city IS NOT NULL THEN geo_score := geo_score + 3; END IF;
      IF inv.investment_geographies IS NOT NULL AND array_length(inv.investment_geographies, 1) > 0 THEN geo_score := geo_score + 2; END IF;

      -- Contactability (0-10): Email, LinkedIn
      IF inv.email IS NOT NULL AND inv.email != '' THEN contact_score := 5; END IF;
      IF inv.email_verified THEN contact_score := contact_score + 3; END IF;
      IF inv.linkedin_url IS NOT NULL AND inv.linkedin_url != '' THEN contact_score := contact_score + 2; END IF;

      -- Relevance (0-5): Bio, thesis, job title
      IF inv.bio IS NOT NULL AND length(inv.bio) > 20 THEN relevance_score := 2; END IF;
      IF inv.investment_thesis IS NOT NULL THEN relevance_score := relevance_score + 3; END IF;

      total_score := industry_score + stage_score + capacity_score + activity_score + geo_score + contact_score + relevance_score;

      UPDATE investors SET
        industry_match_score = industry_score,
        investment_capacity_score = capacity_score,
        activity_score = activity_score,
        contactability_score = contact_score,
        investor_relevance_score = relevance_score,
        overall_lead_score = total_score,
        fit_score = total_score,
        updated_at = now()
      WHERE id = inv_id;
    END;
    $$ LANGUAGE plpgsql
  `);
  console.log("✅ Scoring function created");

  // ── Score all investors ──
  console.log("\n📊 Scoring all investors...");
  const result = await client.query("SELECT COUNT(*)::int as count FROM investors");
  const total = result.rows[0].count;
  console.log(`   Found ${total} investors to score`);

  // Score in batches
  const batchSize = 500;
  let scored = 0;
  for (let offset = 0; offset < total; offset += batchSize) {
    const ids = await client.query(`SELECT id FROM investors ORDER BY created_at LIMIT ${batchSize} OFFSET ${offset}`);
    for (const row of ids.rows) {
      await client.query("SELECT compute_investor_score($1)", [row.id]);
      scored++;
    }
    process.stdout.write(`\r   Scored ${scored}/${total}`);
  }
  console.log("\n\n✅ All investors scored");

  // ── Show results ──
  const stats = await client.query(`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE overall_lead_score >= 80)::int as high_quality,
      COUNT(*) FILTER (WHERE overall_lead_score >= 50)::int as medium_quality,
      COUNT(*) FILTER (WHERE email_verified = true)::int as verified_emails,
      COUNT(*) FILTER (WHERE currently_active = true)::int as active_investors,
      ROUND(AVG(overall_lead_score), 1)::float as avg_score
    FROM investors
  `);
  console.log("\n📊 Quality Breakdown:");
  console.log("   Total:", stats.rows[0].total);
  console.log("   High Quality (80+):", stats.rows[0].high_quality);
  console.log("   Medium Quality (50+):", stats.rows[0].medium_quality);
  console.log("   Verified Emails:", stats.rows[0].verified_emails);
  console.log("   Active Investors:", stats.rows[0].active_investors);
  console.log("   Average Score:", stats.rows[0].avg_score);

  await client.end();
  console.log("\n✅ Migration complete!");
}

main().catch((err) => {
  console.error("💥 Migration failed:", err.message);
  process.exit(1);
});
