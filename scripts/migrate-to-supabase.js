#!/usr/bin/env node
/**
 * Capital OS — Migrate Investors to Supabase
 * ===========================================
 * Moves investor data from CockroachDB to Supabase PostgreSQL.
 * 
 * Usage:
 *   node scripts/migrate-to-supabase.js              # Migrate all
 *   node scripts/migrate-to-supabase.js --limit 1000 # Migrate first 1000
 *   node scripts/migrate-to-supabase.js --stats       # Show stats only
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");

async function main() {
  const args = process.argv.slice(2);
  const showStats = args.includes("--stats");
  const fresh = args.includes("--fresh");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

  // Connect to CockroachDB (source)
  const source = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 30000,
  });
  await source.connect();
  console.log("🔌 Connected to CockroachDB (source)\n");

  // Connect to Supabase (destination)
  const dest = new Client({
    connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 30000,
  });
  
  // For now, we'll use the CockroachDB data and insert into Supabase
  // via the API routes (safer than direct connection)
  
  // Get stats from CockroachDB
  const stats = await source.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE source = 'edgar_13f_hr')::int as edgar_13f,
      COUNT(*) FILTER (WHERE source = 'edgar_form_d')::int as edgar_form_d,
      COUNT(*) FILTER (WHERE source = 'edgar_ncen')::int as edgar_ncen,
      COUNT(*) FILTER (WHERE source = 'generated')::int as generated,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::int as with_email,
      COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL AND linkedin_url != '')::int as with_linkedin,
      COUNT(*) FILTER (WHERE fit_score >= 80)::int as high_fit
    FROM investors
  `);

  console.log("📊 CockroachDB Data:");
  console.log(`   Total: ${stats.rows[0].total}`);
  console.log(`   EDGAR 13F-HR: ${stats.rows[0].edgar_13f}`);
  console.log(`   EDGAR Form D: ${stats.rows[0].edgar_form_d}`);
  console.log(`   EDGAR N-CEN: ${stats.rows[0].edgar_ncen}`);
  console.log(`   With Email: ${stats.rows[0].with_email}`);
  console.log(`   With LinkedIn: ${stats.rows[0].with_linkedin}`);
  console.log(`   High Fit: ${stats.rows[0].high_fit}`);

  if (showStats) {
    await source.end();
    return;
  }

  // Fetch investors
  const query = `SELECT * FROM investors ORDER BY created_at ${limit ? `LIMIT ${limit}` : ""}`;
  const result = await source.query(query);
  const investors = result.rows;
  console.log(`\n📥 Fetched ${investors.length} investors`);

  // Create Supabase tables (if not exists)
  console.log("\n📋 Creating Supabase tables...");
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If --fresh, drop and recreate the table
  if (fresh) {
    console.log("\n🗑️  --fresh: Dropping and recreating investors table...");
    const dropRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ query: "DROP TABLE IF EXISTS investors CASCADE" }),
    });
    if (dropRes.ok) console.log("   ✅ Table dropped");
    else console.log("   ⚠️  Drop may have failed (table might not exist)");
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("❌ Missing Supabase credentials in .env.local");
    console.log("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    await source.end();
    return;
  }

  // Insert in batches
  const BATCH_SIZE = 100;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    
    // Transform to Supabase format — only columns that exist in schema
    const records = batch.map(row => ({
      full_name: row.full_name || 'Unknown',
      first_name: row.first_name,
      last_name: row.last_name,
      job_title: row.job_title,
      investor_type: row.investor_type || 'angel_investor',
      company_name: row.company_name,
      company_website: row.company_website,
      linkedin_url: row.linkedin_url,
      personal_website: row.personal_website,
      country: row.country,
      city: row.city,
      location: row.location,
      email: row.email,
      phone: row.phone,
      min_check_size: row.min_check_size,
      max_check_size: row.max_check_size,
      fund_size: row.fund_size,
      aum: row.aum,
      investment_stages: Array.isArray(row.investment_stages) ? row.investment_stages : [],
      investment_sectors: Array.isArray(row.investment_sectors) ? row.investment_sectors : [],
      investment_geographies: Array.isArray(row.investment_geographies) ? row.investment_geographies : [],
      investment_thesis: row.investment_thesis,
      number_of_investments: row.number_of_investments || 0,
      number_of_exits: row.number_of_exits || 0,
      last_investment_date: row.last_investment_date,
      fit_score: row.fit_score || 0,
      data_quality_score: row.data_quality_score || 0,
      outreach_readiness: row.outreach_readiness || 'needs_verification',
      is_verified: row.is_verified || false,
      source: row.source || 'unknown',
      source_id: row.source_id,
      created_at: row.created_at,
      updated_at: row.updated_at || new Date().toISOString(),
    }));

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(records),
      });

      if (res.ok) {
        inserted += batch.length;
      } else {
        const err = await res.text();
        let errMsg;
        try { errMsg = JSON.parse(err); } catch(e) { errMsg = err; }
        console.log(`\n❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, typeof errMsg === 'object' ? errMsg.message || JSON.stringify(errMsg).slice(0, 200) : errMsg.slice(0, 200));
        failed += batch.length;
      }
    } catch (e) {
      console.log(`❌ Batch error: ${e.message}`);
      failed += batch.length;
    }

    process.stdout.write(`\r   📤 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${inserted} ok, ${failed} failed)`);
  }

  console.log(`\n\n✅ Migration complete!`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Failed: ${failed}`);
  
  await source.end();
}

main().catch((err) => {
  console.error("💥 Migration failed:", err.message);
  process.exit(1);
});
