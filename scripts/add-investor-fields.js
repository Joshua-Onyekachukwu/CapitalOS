#!/usr/bin/env node
/**
 * Capital OS — Add All Investor Fields to Supabase
 * =================================================
 * Adds all 10 sections of investor intelligence fields.
 * 
 * Usage:
 *   node scripts/add-investor-fields.js          # Add all columns
 *   node scripts/add-investor-fields.js --check   # Check current columns
 *   node scripts/add-investor-fields.js --sql     # Print SQL only
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// All columns to add, grouped by section
const COLUMNS = [
  // ══════════════════════════════════════════════════════════════
  // 1. INVESTOR IDENTITY (扩展)
  // ══════════════════════════════════════════════════════════════
  { name: "management_level", type: "TEXT", section: "Identity" },
  { name: "investor_subtype", type: "TEXT", section: "Identity" }, // angel_group, micro_vc, etc.

  // ══════════════════════════════════════════════════════════════
  // 2. CONTACT INFORMATION
  // ══════════════════════════════════════════════════════════════
  { name: "company_linkedin_url", type: "TEXT", section: "Contact" },
  { name: "email_verified", type: "BOOLEAN DEFAULT false", section: "Contact" },
  { name: "email_verification_status", type: "TEXT DEFAULT 'unknown'", section: "Contact" },
  { name: "email_verification_date", type: "TIMESTAMPTZ", section: "Contact" },
  { name: "email_source", type: "TEXT", section: "Contact" },
  { name: "secondary_email", type: "TEXT", section: "Contact" },
  { name: "contact_form_url", type: "TEXT", section: "Contact" },
  { name: "twitter_url", type: "TEXT", section: "Contact" },

  // ══════════════════════════════════════════════════════════════
  // 3. INVESTMENT CAPACITY
  // ══════════════════════════════════════════════════════════════
  { name: "typical_check_size", type: "NUMERIC", section: "Capacity" },
  { name: "average_check_size", type: "NUMERIC", section: "Capacity" },
  { name: "total_capital_invested", type: "NUMERIC", section: "Capacity" },
  { name: "number_of_portfolio_companies", type: "INTEGER DEFAULT 0", section: "Capacity" },
  { name: "available_fund_stage", type: "TEXT", section: "Capacity" },
  { name: "latest_fund_size", type: "NUMERIC", section: "Capacity" },
  { name: "lead_investor", type: "BOOLEAN", section: "Capacity" },
  { name: "follow_on_investment", type: "BOOLEAN", section: "Capacity" },

  // ══════════════════════════════════════════════════════════════
  // 4. INVESTMENT FOCUS
  // ══════════════════════════════════════════════════════════════
  { name: "primary_industry", type: "TEXT", section: "Focus" },
  { name: "secondary_industries", type: "TEXT[] DEFAULT '{}'", section: "Focus" },
  { name: "preferred_business_model", type: "TEXT[] DEFAULT '{}'", section: "Focus" },
  { name: "technology_focus", type: "TEXT", section: "Focus" },
  { name: "preferred_founder_profile", type: "TEXT", section: "Focus" },
  { name: "investment_thesis_keywords", type: "TEXT[] DEFAULT '{}'", section: "Focus" },
  { name: "africa_focus", type: "BOOLEAN DEFAULT false", section: "Focus" },
  { name: "nigeria_focus", type: "BOOLEAN DEFAULT false", section: "Focus" },
  { name: "international_focus", type: "BOOLEAN DEFAULT false", section: "Focus" },

  // ══════════════════════════════════════════════════════════════
  // 5. INVESTMENT HISTORY
  // ══════════════════════════════════════════════════════════════
  { name: "number_of_lead_investments", type: "INTEGER DEFAULT 0", section: "History" },
  { name: "portfolio_companies", type: "TEXT[] DEFAULT '{}'", section: "History" },
  { name: "recent_investments", type: "TEXT[] DEFAULT '{}'", section: "History" },
  { name: "successful_exits", type: "INTEGER DEFAULT 0", section: "History" },
  { name: "ipos", type: "INTEGER DEFAULT 0", section: "History" },
  { name: "acquisitions", type: "INTEGER DEFAULT 0", section: "History" },

  // ══════════════════════════════════════════════════════════════
  // 6. INVESTOR ACTIVITY
  // ══════════════════════════════════════════════════════════════
  { name: "currently_active", type: "BOOLEAN DEFAULT true", section: "Activity" },
  { name: "investments_last_12_months", type: "INTEGER DEFAULT 0", section: "Activity" },
  { name: "investments_last_24_months", type: "INTEGER DEFAULT 0", section: "Activity" },
  { name: "recently_raised_fund", type: "BOOLEAN DEFAULT false", section: "Activity" },
  { name: "fundraising_status", type: "TEXT", section: "Activity" },
  { name: "currently_deploying_capital", type: "BOOLEAN DEFAULT true", section: "Activity" },
  { name: "investment_frequency", type: "TEXT", section: "Activity" },
  { name: "avg_investments_per_year", type: "NUMERIC", section: "Activity" },

  // ══════════════════════════════════════════════════════════════
  // 7. PROFESSIONAL BACKGROUND
  // ══════════════════════════════════════════════════════════════
  { name: "years_investment_experience", type: "INTEGER", section: "Background" },
  { name: "founder_experience", type: "BOOLEAN DEFAULT false", section: "Background" },
  { name: "previous_exits", type: "INTEGER DEFAULT 0", section: "Background" },
  { name: "ceo_experience", type: "BOOLEAN DEFAULT false", section: "Background" },
  { name: "board_positions", type: "INTEGER DEFAULT 0", section: "Background" },
  { name: "advisory_positions", type: "INTEGER DEFAULT 0", section: "Background" },
  { name: "previous_companies", type: "TEXT[] DEFAULT '{}'", section: "Background" },
  { name: "investor_bio", type: "TEXT", section: "Background" },

  // ══════════════════════════════════════════════════════════════
  // 8. COMPANY / FUND INFORMATION
  // ══════════════════════════════════════════════════════════════
  { name: "firm_linkedin_url", type: "TEXT", section: "Fund" },
  { name: "founded_year", type: "INTEGER", section: "Fund" },
  { name: "headquarters", type: "TEXT", section: "Fund" },
  { name: "number_of_employees", type: "INTEGER", section: "Fund" },
  { name: "fund_type", type: "TEXT", section: "Fund" },
  { name: "current_fund", type: "TEXT", section: "Fund" },
  { name: "number_of_partners", type: "INTEGER", section: "Fund" },
  { name: "sector_focus", type: "TEXT[] DEFAULT '{}'", section: "Fund" },
  { name: "latest_fund_close_date", type: "DATE", section: "Fund" },

  // ══════════════════════════════════════════════════════════════
  // 9. REPUTATION / QUALITY SIGNALS
  // ══════════════════════════════════════════════════════════════
  { name: "investor_rating", type: "TEXT", section: "Scores" },
  { name: "investment_activity_score", type: "INTEGER DEFAULT 0", section: "Scores" },
  { name: "industry_match_score", type: "INTEGER DEFAULT 0", section: "Scores" },
  { name: "stage_match_score", type: "INTEGER DEFAULT 0", section: "Scores" },
  { name: "geography_match_score", type: "INTEGER DEFAULT 0", section: "Scores" },
  { name: "funding_capacity_score", type: "INTEGER DEFAULT 0", section: "Scores" },
  { name: "contactability_score", type: "INTEGER DEFAULT 0", section: "Scores" },
  { name: "overall_lead_score", type: "INTEGER DEFAULT 0", section: "Scores" },

  // ══════════════════════════════════════════════════════════════
  // 10. SOURCE & VERIFICATION
  // ══════════════════════════════════════════════════════════════
  { name: "source_url", type: "TEXT", section: "Source" },
  { name: "source_name", type: "TEXT", section: "Source" },
  { name: "date_scraped", type: "TIMESTAMPTZ", section: "Source" },
  { name: "date_verified", type: "TIMESTAMPTZ", section: "Source" },
  { name: "data_verification_status", type: "TEXT DEFAULT 'unverified'", section: "Source" },
  { name: "source_reliability", type: "INTEGER DEFAULT 50", section: "Source" },
  { name: "duplicate_status", type: "TEXT DEFAULT 'unique'", section: "Source" },
];

async function getExistingColumns() {
  // Query information_schema via PostgREST (only works for public schema tables)
  // Since we can't run DDL via REST, we'll check by trying to select a column
  const existing = new Set();
  
  // We know the current columns from the schema
  const currentColumns = [
    "id", "full_name", "first_name", "last_name", "job_title", "investor_type",
    "company_name", "company_website", "linkedin_url", "personal_website",
    "country", "city", "location", "email", "phone",
    "min_check_size", "max_check_size", "fund_size", "aum", "currency",
    "investment_stages", "investment_sectors", "investment_geographies", "investment_thesis",
    "number_of_investments", "number_of_exits", "last_investment_date",
    "fit_score", "data_quality_score", "outreach_readiness", "is_verified",
    "source", "source_id", "created_at", "updated_at"
  ];
  
  currentColumns.forEach(c => existing.add(c));
  return existing;
}

function generateSQL(existingColumns) {
  const toAdd = COLUMNS.filter(c => !existingColumns.has(c.name));
  
  let sql = `-- Capital OS — Add Investor Intelligence Fields\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Adds ${toAdd.length} new columns across 10 sections\n\n`;
  
  // Group by section
  const sections = {};
  toAdd.forEach(col => {
    if (!sections[col.section]) sections[col.section] = [];
    sections[col.section].push(col);
  });
  
  for (const [section, cols] of Object.entries(sections)) {
    sql += `-- ═══ ${section.toUpperCase()} ═══\n`;
    for (const col of cols) {
      sql += `ALTER TABLE investors ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};\n`;
    }
    sql += `\n`;
  }
  
  // Add indexes for important new columns
  sql += `-- ═══ INDEXES ═══\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_active ON investors(currently_active);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_lead ON investors(lead_investor);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_primary_industry ON investors(primary_industry);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_overall_score ON investors(overall_lead_score DESC);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_activity_score ON investors(investment_activity_score DESC);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_capacity_score ON investors(funding_capacity_score DESC);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_contactability ON investors(contactability_score DESC);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_email_verified ON investors(email_verified);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_africa ON investors(africa_focus) WHERE africa_focus = true;\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_investors_nigeria ON investors(nigeria_focus) WHERE nigeria_focus = true;\n`;
  
  return { sql, count: toAdd.length };
}

async function checkColumns() {
  const existing = await getExistingColumns();
  const missing = COLUMNS.filter(c => !existing.has(c.name));
  const present = COLUMNS.filter(c => existing.has(c.name));
  
  console.log(`\n📊 Column Status:`);
  console.log(`   Already exist: ${present.length}`);
  console.log(`   Need to add: ${missing.length}`);
  
  if (missing.length > 0) {
    console.log(`\n📋 Columns to add:`);
    const sections = {};
    missing.forEach(col => {
      if (!sections[col.section]) sections[col.section] = [];
      sections[col.section].push(col);
    });
    for (const [section, cols] of Object.entries(sections)) {
      console.log(`\n   ${section}:`);
      cols.forEach(c => console.log(`     + ${c.name} (${c.type})`));
    }
  }
  
  return { existing, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const sqlOnly = args.includes("--sql");
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
  }
  
  const existing = await getExistingColumns();
  const { sql, count } = generateSQL(existing);
  
  if (sqlOnly) {
    console.log(sql);
    return;
  }
  
  if (checkOnly) {
    await checkColumns();
    return;
  }
  
  console.log(`\n🔧 Adding ${count} new columns to Supabase investors table...\n`);
  
  // Print the SQL for the user to run in Supabase SQL Editor
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📋 RUN THIS IN SUPABASE SQL EDITOR:");
  console.log("   Go to: https://supabase.com/dashboard → SQL Editor → New");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(sql);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\nAfter running the SQL, re-run the migration to populate data.");
}

main().catch(err => {
  console.error("💥 Error:", err.message);
  process.exit(1);
});
