#!/usr/bin/env node
/**
 * Score remaining unscored investors — picks up where the last run left off.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_STAGES = ["pre_seed", "seed", "series_a"];
const TARGET_SECTORS = ["fintech", "saas", "healthtech", "edtech", "ai", "blockchain", "ecommerce"];
const TARGET_GEOS = ["united_states", "united_kingdom", "nigeria", "africa", "global"];

function calcScores(inv) {
  let activity = 0;
  if (inv.currently_active === true) activity += 3;
  if ((inv.number_of_investments || 0) > 0) activity += 2;
  if ((inv.number_of_investments || 0) > 5) activity += 1;
  if ((inv.number_of_investments || 0) > 20) activity += 1;
  if (inv.last_investment_date) {
    const m = (Date.now() - new Date(inv.last_investment_date).getTime()) / (30 * 86400000);
    if (m < 6) activity += 4; else if (m < 12) activity += 3; else if (m < 24) activity += 2; else if (m < 48) activity += 1;
  }
  if ((inv.investments_last_12_months || 0) > 0) activity += 2;
  if ((inv.investments_last_24_months || 0) > 0) activity += 1;
  if (inv.currently_deploying_capital === true) activity += 1;
  activity = Math.min(activity, 15);

  let capacity = 0;
  if ((inv.fund_size || 0) > 0) capacity += 3;
  if ((inv.aum || 0) > 0) capacity += 3;
  if ((inv.fund_size || 0) > 10e6) capacity += 2;
  if ((inv.aum || 0) > 50e6) capacity += 2;
  if (inv.typical_check_size >= 10000 && inv.typical_check_size <= 5e6) capacity += 4;
  else if (inv.min_check_size && inv.max_check_size && inv.min_check_size <= 5e6 && inv.max_check_size >= 10000) capacity += 3;
  if ((inv.total_capital_invested || 0) > 1e6) capacity += 2;
  if ((inv.total_capital_invested || 0) > 10e6) capacity += 1;
  capacity = Math.min(capacity, 20);

  let industry = 0;
  const sects = [...(inv.investment_sectors || []), ...(inv.sector_focus || []), inv.primary_industry].filter(Boolean).map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (sects.length === 0) { industry = 5; } else {
    const matches = sects.filter(s => TARGET_SECTORS.some(t => s.includes(t) || t.includes(s)));
    if (matches.length > 0) industry += 10;
    if (matches.length > 1) industry += 3;
    if (matches.length > 2) industry += 2;
    const thesis = (inv.investment_thesis || "").toLowerCase();
    const kw = TARGET_SECTORS.filter(s => thesis.includes(s));
    if (kw.length > 0) industry += Math.min(kw.length, 2);
  }
  industry = Math.min(industry, 15);

  let stage = 0;
  const stages = inv.investment_stages || [];
  if (stages.length === 0) { stage = 5; } else {
    const matches = stages.filter(s => TARGET_STAGES.includes(s));
    if (matches.length > 0) stage += 10;
    if (matches.length > 1) stage += 3;
    if (matches.length > 2) stage += 2;
    if (inv.available_fund_stage && TARGET_STAGES.includes(inv.available_fund_stage)) stage += 2;
  }
  stage = Math.min(stage, 15);

  let geo = 0;
  const geos = [...(inv.investment_geographies || []), inv.country].filter(Boolean).map(g => g.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (geos.length === 0) { geo = 3; } else {
    const matches = geos.filter(g => TARGET_GEOS.some(t => g.includes(t) || t.includes(g)));
    if (matches.length > 0) geo += 6;
    if (matches.length > 1) geo += 2;
    if (inv.africa_focus === true) geo += 1;
    if (inv.nigeria_focus === true) geo += 1;
  }
  geo = Math.min(geo, 10);

  let contact = 0;
  if (inv.email && inv.email.includes("@")) {
    contact += 5;
    if (inv.email_verified === true) contact += 3;
    else if (inv.email_verification_status === "verified") contact += 3;
    else if (inv.email_verification_status === "risky") contact += 1;
  }
  if (inv.linkedin_url) contact += 2;
  if (inv.phone) contact += 1;
  if (inv.company_website || inv.personal_website) contact += 2;
  if (inv.contact_form_url) contact += 1;
  if (inv.twitter_url) contact += 1;
  contact = Math.min(contact, 15);

  let quality = 0;
  if (inv.full_name) quality += 1;
  if (inv.job_title) quality += 1;
  if (inv.company_name) quality += 1;
  if (inv.country) quality += 1;
  if (inv.investment_stages?.length > 0) quality += 1;
  if (inv.investment_sectors?.length > 0) quality += 1;
  if ((inv.number_of_investments || 0) > 0) quality += 1;
  if (inv.portfolio_companies?.length > 0) quality += 1;
  if (inv.investor_bio) quality += 1;
  if (inv.investment_thesis) quality += 1;
  quality = Math.min(quality, 10);

  const total = activity + capacity + industry + stage + geo + contact + quality;
  const rating = total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : total >= 35 ? "D" : "F";
  const readiness = total >= 65 && inv.email ? "ready_for_outreach" : total >= 50 ? "needs_verification" : "low_priority";

  return { overall_lead_score: total, investor_rating: rating, outreach_readiness: readiness,
    investment_activity_score: activity, funding_capacity_score: capacity, industry_match_score: industry,
    stage_match_score: stage, geography_match_score: geo, contactability_score: contact, data_quality_score: quality };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Score Remaining Investors");
  console.log("═══════════════════════════════════════════════════════════\n");

  const BATCH = 1000;
  let offset = 0;
  let totalScored = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  while (true) {
    // Only fetch unscored investors
    const { data: batch, error } = await supabase
      .from("investors")
      .select("id, full_name, job_title, company_name, country, email, email_verified, email_verification_status, linkedin_url, phone, company_website, personal_website, contact_form_url, twitter_url, investment_stages, investment_sectors, investment_geographies, investor_bio, investment_thesis, primary_industry, sector_focus, fund_size, aum, typical_check_size, min_check_size, max_check_size, total_capital_invested, number_of_investments, currently_active, currently_deploying_capital, last_investment_date, investments_last_12_months, investments_last_24_months, available_fund_stage, portfolio_companies, africa_focus, nigeria_focus")
      .eq("fit_score", 0)
      .range(offset, offset + BATCH - 1);

    if (error) { console.error("❌", error.message); break; }
    if (!batch || batch.length === 0) break;

    // Score in parallel batches of 100
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      const results = chunk.map(inv => {
        const s = calcScores(inv);
        return supabase.from("investors").update({
          fit_score: s.overall_lead_score,
          overall_lead_score: s.overall_lead_score, investor_rating: s.investor_rating,
          outreach_readiness: s.outreach_readiness, investment_activity_score: s.investment_activity_score,
          funding_capacity_score: s.funding_capacity_score, industry_match_score: s.industry_match_score,
          stage_match_score: s.stage_match_score, geography_match_score: s.geography_match_score,
          contactability_score: s.contactability_score, data_quality_score: s.data_quality_score,
          updated_at: new Date().toISOString(),
        }).eq("id", inv.id).then(r => r.error ? 0 : 1).catch(() => 0);
      });
      const ok = (await Promise.all(results)).reduce((a, b) => a + b, 0);
      totalScored += ok;
      totalFailed += chunk.length - ok;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`\r   ✅ ${totalScored} scored | ❌ ${totalFailed} failed | ⏱️ ${elapsed}s | remaining: ~${Math.max(0, 122819 - totalScored - 66705)}`);

    offset += BATCH;
    if (batch.length < BATCH) break;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n\n✅ Done in ${elapsed}s — Scored: ${totalScored}, Failed: ${totalFailed}`);

  // Show distribution
  const { data: dist } = await supabase.from("investors").select("investor_rating, outreach_readiness").limit(1000);
  if (dist) {
    const ratings = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    dist.forEach(d => { if (d.investor_rating) ratings[d.investor_rating]++; });
    console.log("\n📊 Distribution (sample 1K):", JSON.stringify(ratings));
  }
}

main().catch(e => { console.error("💥", e.message); process.exit(1); });
