#!/usr/bin/env node
/**
 * Capital OS — Investor Lead Scoring System
 * ===========================================
 * Calculates a 7-factor lead score (0-100) for every investor.
 * 
 * Scoring Factors:
 * 1. Investment Activity Score (0-15) — Is this investor actively investing?
 * 2. Funding Capacity Score (0-20) — Can they actually write checks?
 * 3. Industry Match Score (0-15) — Do they invest in our sectors?
 * 4. Stage Match Score (0-15) — Do they invest at our stage?
 * 5. Geography Match Score (0-10) — Are they in our geography?
 * 6. Contactability Score (0-15) — Can we reach them?
 * 7. Data Quality Score (0-10) — How complete is their profile?
 * 
 * Total: 0-100
 * 
 * Usage:
 *   node scripts/score-investors.js              # Score all
 *   node scripts/score-investors.js --limit 100  # Score first 100
 *   node scripts/score-investors.js --dry-run    # Show scores without updating
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Target investor profile (customize these for your startup)
const TARGET_PROFILE = {
  stages: ["pre_seed", "seed", "series_a"],
  sectors: ["fintech", "saas", "healthtech", "edtech", "ai", "blockchain", "ecommerce"],
  geographies: ["united_states", "united_kingdom", "nigeria", "africa", "global"],
  minCheckSize: 10000,
  maxCheckSize: 5000000,
};

// ══════════════════════════════════════════════════════════════
// Scoring Functions
// ══════════════════════════════════════════════════════════════

function scoreInvestmentActivity(investor) {
  let score = 0;
  
  // Currently active investor
  if (investor.currently_active === true) score += 3;
  
  // Has made investments
  if ((investor.number_of_investments || 0) > 0) score += 2;
  if ((investor.number_of_investments || 0) > 5) score += 1;
  if ((investor.number_of_investments || 0) > 20) score += 1;
  
  // Recent investment activity
  if (investor.last_investment_date) {
    const monthsAgo = (Date.now() - new Date(investor.last_investment_date).getTime()) / (30 * 86400000);
    if (monthsAgo < 6) score += 4;
    else if (monthsAgo < 12) score += 3;
    else if (monthsAgo < 24) score += 2;
    else if (monthsAgo < 48) score += 1;
  }
  
  // Investments in last 12/24 months
  if ((investor.investments_last_12_months || 0) > 0) score += 2;
  if ((investor.investments_last_24_months || 0) > 0) score += 1;
  
  // Currently deploying capital
  if (investor.currently_deploying_capital === true) score += 1;
  
  return Math.min(score, 15);
}

function scoreFundingCapacity(investor) {
  let score = 0;
  
  // Has fund size or AUM
  if (investor.fund_size > 0) score += 3;
  if (investor.aum > 0) score += 3;
  if (investor.fund_size > 10000000) score += 2; // >$10M fund
  if (investor.aum > 50000000) score += 2; // >$50M AUM
  
  // Check size matches our needs
  if (investor.typical_check_size >= TARGET_PROFILE.minCheckSize && 
      investor.typical_check_size <= TARGET_PROFILE.maxCheckSize) {
    score += 4;
  } else if (investor.min_check_size && investor.max_check_size) {
    if (investor.min_check_size <= TARGET_PROFILE.maxCheckSize && 
        investor.max_check_size >= TARGET_PROFILE.minCheckSize) {
      score += 3;
    }
  }
  
  // Total capital invested
  if ((investor.total_capital_invested || 0) > 1000000) score += 2;
  if ((investor.total_capital_invested || 0) > 10000000) score += 1;
  
  return Math.min(score, 20);
}

function scoreIndustryMatch(investor) {
  let score = 0;
  const sectors = [
    ...(investor.investment_sectors || []),
    ...(investor.sector_focus || []),
    investor.primary_industry,
  ].filter(Boolean).map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  if (sectors.length === 0) return 5; // Neutral if no info
  
  const matches = sectors.filter(s => 
    TARGET_PROFILE.sectors.some(t => s.includes(t) || t.includes(s))
  );
  
  if (matches.length > 0) score += 10;
  if (matches.length > 1) score += 3;
  if (matches.length > 2) score += 2;
  
  // Thesis keywords
  const thesis = (investor.investment_thesis || "").toLowerCase();
  const keywords = TARGET_PROFILE.sectors.filter(s => thesis.includes(s));
  if (keywords.length > 0) score += Math.min(keywords.length, 2);
  
  return Math.min(score, 15);
}

function scoreStageMatch(investor) {
  let score = 0;
  const stages = investor.investment_stages || [];
  
  if (stages.length === 0) return 5; // Neutral if no info
  
  const matches = stages.filter(s => TARGET_PROFILE.stages.includes(s));
  
  if (matches.length > 0) score += 10;
  if (matches.length > 1) score += 3;
  if (matches.length > 2) score += 2;
  
  // Available fund stage
  if (investor.available_fund_stage && TARGET_PROFILE.stages.includes(investor.available_fund_stage)) {
    score += 2;
  }
  
  return Math.min(score, 15);
}

function scoreGeographyMatch(investor) {
  let score = 0;
  const geos = [
    ...(investor.investment_geographies || []),
    investor.country,
    investor.geographic_focus,
  ].filter(Boolean).map(g => g.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  if (geos.length === 0) return 3; // Neutral if no info
  
  const matches = geos.filter(g => 
    TARGET_PROFILE.geographies.some(t => g.includes(t) || t.includes(g))
  );
  
  if (matches.length > 0) score += 6;
  if (matches.length > 1) score += 2;
  
  // Africa/Nigeria focus
  if (investor.africa_focus === true) score += 1;
  if (investor.nigeria_focus === true) score += 1;
  
  return Math.min(score, 10);
}

function scoreContactability(investor) {
  let score = 0;
  
  // Has email
  if (investor.email && investor.email.includes("@")) {
    score += 5;
    
    // Email verified
    if (investor.email_verified === true) score += 3;
    else if (investor.email_verification_status === "verified") score += 3;
    else if (investor.email_verification_status === "risky") score += 1;
  }
  
  // Has LinkedIn
  if (investor.linkedin_url) score += 2;
  
  // Has phone
  if (investor.phone) score += 1;
  
  // Has website
  if (investor.company_website || investor.personal_website) score += 2;
  
  // Has contact form
  if (investor.contact_form_url) score += 1;
  
  // Has Twitter
  if (investor.twitter_url) score += 1;
  
  return Math.min(score, 15);
}

function scoreDataQuality(investor) {
  let score = 0;
  
  // Core fields present
  if (investor.full_name) score += 1;
  if (investor.job_title) score += 1;
  if (investor.company_name) score += 1;
  if (investor.country) score += 1;
  
  // Investment data present
  if (investor.investment_stages && investor.investment_stages.length > 0) score += 1;
  if (investor.investment_sectors && investor.investment_sectors.length > 0) score += 1;
  
  // History data
  if (investor.number_of_investments > 0) score += 1;
  if (investor.portfolio_companies && investor.portfolio_companies.length > 0) score += 1;
  
  // Background
  if (investor.investor_bio) score += 1;
  if (investor.investment_thesis) score += 1;
  
  return Math.min(score, 10);
}

function calculateOverallScore(investor) {
  const activity = scoreInvestmentActivity(investor);
  const capacity = scoreFundingCapacity(investor);
  const industry = scoreIndustryMatch(investor);
  const stage = scoreStageMatch(investor);
  const geo = scoreGeographyMatch(investor);
  const contact = scoreContactability(investor);
  const quality = scoreDataQuality(investor);
  
  const total = activity + capacity + industry + stage + geo + contact + quality;
  
  // Determine rating
  let rating;
  if (total >= 80) rating = "A";
  else if (total >= 65) rating = "B";
  else if (total >= 50) rating = "C";
  else if (total >= 35) rating = "D";
  else rating = "F";
  
  // Determine outreach readiness
  let readiness;
  if (total >= 65 && investor.email) readiness = "ready_for_outreach";
  else if (total >= 50) readiness = "needs_verification";
  else readiness = "low_priority";
  
  return {
    overall_lead_score: total,
    investor_rating: rating,
    outreach_readiness: readiness,
    investment_activity_score: activity,
    funding_capacity_score: capacity,
    industry_match_score: industry,
    stage_match_score: stage,
    geography_match_score: geo,
    contactability_score: contact,
    data_quality_score: quality,
  };
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Investor Lead Scoring System");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials");
    process.exit(1);
  }
  
  // Fetch all investors
  console.log("📥 Fetching investors from Supabase...");
  
  let allInvestors = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/investors?select=*&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    
    if (!res.ok) {
      console.error(`❌ Fetch error: ${res.status}`);
      break;
    }
    
    const batch = await res.json();
    if (batch.length === 0) break;
    
    allInvestors.push(...batch);
    offset += pageSize;
    
    process.stdout.write(`\r   Fetched ${allInvestors.length} investors...`);
    
    if (limit && allInvestors.length >= limit) {
      allInvestors = allInvestors.slice(0, limit);
      break;
    }
  }
  
  console.log(`\n   Total: ${allInvestors.length} investors\n`);
  
  // Score each investor
  console.log("🧮 Scoring investors...\n");
  
  const updates = [];
  const ratings = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  
  for (const investor of allInvestors) {
    const scores = calculateOverallScore(investor);
    
    updates.push({
      id: investor.id,
      ...scores,
    });
    
    ratings[scores.investor_rating]++;
  }
  
  // Show distribution
  console.log("📊 Score Distribution:");
  console.log(`   A (80-100): ${ratings.A} investors`);
  console.log(`   B (65-79):  ${ratings.B} investors`);
  console.log(`   C (50-64):  ${ratings.C} investors`);
  console.log(`   D (35-49):  ${ratings.D} investors`);
  console.log(`   F (0-34):   ${ratings.F} investors`);
  
  // Show top 10
  const top10 = updates.sort((a, b) => b.overall_lead_score - a.overall_lead_score).slice(0, 10);
  console.log("\n🏆 Top 10 Investors:");
  for (const u of top10) {
    const inv = allInvestors.find(i => i.id === u.id);
    console.log(`   ${u.overall_lead_score}/100 [${u.investor_rating}] ${inv?.full_name || "Unknown"} (${inv?.source})`);
    console.log(`     Activity: ${u.investment_activity_score}/15 | Capacity: ${u.funding_capacity_score}/20 | Industry: ${u.industry_match_score}/15 | Stage: ${u.stage_match_score}/15 | Geo: ${u.geography_match_score}/10 | Contact: ${u.contactability_score}/15 | Quality: ${u.data_quality_score}/10`);
  }
  
  if (dryRun) {
    console.log("\n⚠️  Dry run — no updates made");
    return;
  }
  
  // Update Supabase
  console.log("\n📝 Updating Supabase...\n");
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    
    for (const update of batch) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${update.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            overall_lead_score: update.overall_lead_score,
            investor_rating: update.investor_rating,
            outreach_readiness: update.outreach_readiness,
            investment_activity_score: update.investment_activity_score,
            funding_capacity_score: update.funding_capacity_score,
            industry_match_score: update.industry_match_score,
            stage_match_score: update.stage_match_score,
            geography_match_score: update.geography_match_score,
            contactability_score: update.contactability_score,
            data_quality_score: update.data_quality_score,
            updated_at: new Date().toISOString(),
          }),
        });
        
        if (res.ok) updated++;
        else failed++;
      } catch (e) {
        failed++;
      }
    }
    
    process.stdout.write(`\r   Updated ${updated}/${updates.length} (${failed} failed)`);
  }
  
  console.log(`\n\n✅ Scoring complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total scored: ${updates.length}`);
}

main().catch(err => {
  console.error("\n💥 Fatal:", err.message);
  process.exit(1);
});
