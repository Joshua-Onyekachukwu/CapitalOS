#!/usr/bin/env node
/**
 * Capital OS — Migrate Investor Data to Convex
 * =============================================
 * Reads investors from CockroachDB and inserts into Convex.
 * 
 * Usage:
 *   node scripts/migrate-to-convex.js              # Migrate all
 *   node scripts/migrate-to-convex.js --limit 100  # Migrate first 100
 *   node scripts/migrate-to-convex.js --stats       # Show stats only
 * 
 * Convex limits:
 *   - 3GB storage = ~1.5M investor records
 *   - 6M function calls/day
 *   - 6GB database I/O/day
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");

const CONVEX_URL = "https://exciting-bat-92.convex.cloud";

async function convexMutation(path, args) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(`Convex error: ${JSON.stringify(data)}`);
  }
  return data.value;
}

async function convexQuery(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  return data.value;
}

function mapInvestor(row) {
  return {
    fullName: row.full_name || "",
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    jobTitle: row.job_title || undefined,
    investorType: row.investor_type || "angel_investor",
    
    companyName: row.company_name || undefined,
    companyWebsite: row.website_url || undefined,
    linkedinUrl: row.linkedin_url || undefined,
    personalWebsite: row.personal_website || undefined,
    
    country: row.country || undefined,
    state: row.state || undefined,
    city: row.city || undefined,
    location: row.location || undefined,
    
    email: row.email || undefined,
    emailVerified: row.email_verified || false,
    emailSource: row.email_source || undefined,
    secondaryEmail: row.secondary_email || undefined,
    phone: row.phone || undefined,
    
    minCheckSize: row.min_check_size || undefined,
    maxCheckSize: row.max_check_size || undefined,
    typicalCheckSize: row.typical_check_size || undefined,
    fundSize: row.fund_size || undefined,
    aum: row.aum || undefined,
    totalCapitalInvested: row.total_capital_invested || undefined,
    currency: row.currency || "USD",
    
    investmentStages: row.investment_stages || [],
    investmentSectors: row.investment_sectors || [],
    investmentGeographies: row.investment_geographies || [],
    primaryIndustry: row.primary_industry || undefined,
    investmentThesis: row.investment_thesis || undefined,
    
    numberOfInvestments: row.number_of_investments || undefined,
    numberOfExits: row.number_of_exits || undefined,
    numberOfPortfolioCompanies: row.portfolio_count || undefined,
    successfulExits: row.successful_exits || undefined,
    lastInvestmentDate: row.last_investment_date || undefined,
    
    currentlyActive: row.currently_active !== false,
    investmentsLast12Months: row.investments_last_12_months || undefined,
    investmentsLast24Months: row.investments_last_24_months || undefined,
    
    yearsInvestmentExperience: row.years_investment_experience || undefined,
    founderExperience: row.founder_experience || false,
    previousExits: row.previous_exits || undefined,
    
    fundType: row.fund_type || undefined,
    currentFund: row.current_fund || undefined,
    
    overallScore: row.overall_lead_score || row.fit_score || 0,
    industryMatchScore: row.industry_match_score || undefined,
    investmentCapacityScore: row.investment_capacity_score || undefined,
    contactabilityScore: row.contactability_score || undefined,
    activityScore: row.activity_score || undefined,
    fitScore: row.fit_score || undefined,
    dataQualityScore: row.data_quality_score || undefined,
    
    source: row.source || "unknown",
    sourceId: row.source_id || undefined,
    dateScraped: row.created_at || undefined,
    
    outreachReadiness: row.outreach_readiness || "needs_verification",
    isVerified: row.is_verified || false,
    
    createdAt: new Date(row.created_at).getTime() || Date.now(),
    updatedAt: new Date(row.updated_at).getTime() || Date.now(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const showStats = args.includes("--stats");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

  // Connect to CockroachDB
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();
  console.log("🔌 Connected to CockroachDB\n");

  // Get stats
  const stats = await client.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE source = 'edgar_13f_hr')::int as edgar_13f,
      COUNT(*) FILTER (WHERE source = 'edgar_form_d')::int as edgar_form_d,
      COUNT(*) FILTER (WHERE source = 'edgar_ncen')::int as edgar_ncen,
      COUNT(*) FILTER (WHERE source = 'generated')::int as generated,
      COUNT(*) FILTER (WHERE source = 'apollo_csv')::int as apollo,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::int as with_email,
      COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL AND linkedin_url != '')::int as with_linkedin
    FROM investors
  `);

  console.log("📊 CockroachDB Data:");
  console.log(`   Total: ${stats.rows[0].total}`);
  console.log(`   EDGAR 13F-HR: ${stats.rows[0].edgar_13f}`);
  console.log(`   EDGAR Form D: ${stats.rows[0].edgar_form_d}`);
  console.log(`   EDGAR N-CEN: ${stats.rows[0].edgar_ncen}`);
  console.log(`   Generated: ${stats.rows[0].generated}`);
  console.log(`   Apollo CSV: ${stats.rows[0].apollo}`);
  console.log(`   With Email: ${stats.rows[0].with_email}`);
  console.log(`   With LinkedIn: ${stats.rows[0].with_linkedin}`);

  if (showStats) {
    await client.end();
    return;
  }

  // Estimate Convex storage
  const totalRows = stats.rows[0].total;
  const avgRowSize = 1.5; // KB per investor record
  const estimatedStorageMB = Math.round((totalRows * avgRowSize) / 1024);
  console.log(`\n💾 Estimated Convex storage: ~${estimatedStorageMB}MB of 3GB`);
  console.log(`   Records to migrate: ${limit || totalRows}\n`);

  // Fetch investors from CockroachDB
  const query = `SELECT * FROM investors ORDER BY created_at ${limit ? `LIMIT ${limit}` : ""}`;
  const result = await client.query(query);
  const investors = result.rows;
  console.log(`📥 Fetched ${investors.length} investors from CockroachDB\n`);

  // Migrate in batches
  const BATCH_SIZE = 100;
  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
      try {
        const investorData = mapInvestor(row);
        await convexMutation("investors:insert", investorData);
        migrated++;
      } catch (e) {
        console.log(`❌ Failed: ${row.full_name}: ${e.message?.slice(0, 80)}`);
        failed++;
      }
    }

    process.stdout.write(`\r   📤 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} migrated (${migrated} ok, ${failed} failed)`);
  }

  console.log(`\n\n✅ Migration complete!`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Failed: ${failed}`);
  
  // Verify in Convex
  const convexCount = await convexQuery("investors:count");
  console.log(`   Convex total: ${convexCount}`);

  await client.end();
}

main().catch((err) => {
  console.error("💥 Migration failed:", err.message);
  process.exit(1);
});
