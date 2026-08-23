// =============================================
// Capital OS — Batch Investor Qualification (Optimized)
// =============================================
// Scores all un-scored investors using deterministic rules.
// Uses grouped bulk updates for speed on 1M+ records.
//
// Run: npx tsx src/scripts/qualify-investors.ts
// =============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================
// Scoring Functions
// =============================================

const SECTOR_GROUPS: Record<string, string[]> = {
  ai: ["ai", "machinelearning", "ml", "datascience", "nlp", "deeplearning"],
  fintech: ["fintech", "financialtechnology", "payments", "banking", "insurtech"],
  saas: ["saas", "enterprise", "b2b", "software", "cloud", "devtools"],
  healthtech: ["healthtech", "healthcare", "biotech", "medtech", "digitalhealth"],
  climatetech: ["climatetech", "cleantech", "energy", "sustainability"],
  consumer: ["consumer", "b2c", "marketplace", "ecommerce", "retail"],
  web3: ["web3", "blockchain", "crypto", "defi"],
  deeptech: ["deeptech", "robotics", "hardware", "spacetech", "quantum"],
};

const STAGE_ORDER = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];

function sectorScore(invSectors: string[], startupSector: string): number {
  if (!invSectors.length || !startupSector) return 50;
  const s = startupSector.toLowerCase().replace(/[^a-z0-9]/g, "");
  const inv = invSectors.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (inv.includes(s)) return 100;
  for (const [, kw] of Object.entries(SECTOR_GROUPS)) {
    if (kw.includes(s) && inv.some(x => kw.includes(x))) return 85;
  }
  for (const sector of inv) {
    if (sector.includes(s) || s.includes(sector)) return 70;
  }
  return 20;
}

function stageScore(invStages: string[], startupStage: string): number {
  if (!invStages.length || !startupStage) return 50;
  const s = startupStage.toLowerCase().replace(/\s+/g, "_");
  const inv = invStages.map(x => x.toLowerCase().replace(/\s+/g, "_"));
  if (inv.includes(s)) return 100;
  const si = STAGE_ORDER.indexOf(s);
  for (const st of inv) {
    const ii = STAGE_ORDER.indexOf(st);
    if (si >= 0 && ii >= 0) {
      const d = Math.abs(si - ii);
      if (d === 1) return 75;
      if (d === 2) return 40;
    }
  }
  return 15;
}

function geoScore(invGeos: string[], invCountry: string | null, startupGeo: string): number {
  if (!startupGeo) return 50;
  const n = startupGeo.toLowerCase().trim();
  if (invCountry && invCountry.toLowerCase() === n) return 100;
  if (invGeos.some(g => g.toLowerCase().includes(n) || n.includes(g.toLowerCase()))) return 100;
  if (invGeos.some(g => g.toLowerCase().includes("global"))) return 90;
  return 30;
}

function completenessScore(inv: any): number {
  const fields = ["email", "linkedin_url", "job_title", "investment_stages", "investment_sectors", "bio", "country", "city"];
  let filled = 0;
  for (const f of fields) {
    const v = inv[f];
    if (v && (Array.isArray(v) ? v.length > 0 : String(v).length > 0)) filled++;
  }
  return Math.round((filled / fields.length) * 100);
}

function outreachReadiness(inv: any): string {
  if (inv.do_not_contact) return "do_not_contact";
  let score = 0;
  if (inv.email) score += 30;
  if (inv.linkedin_url) score += 20;
  if (inv.is_verified) score += 15;
  if ((inv.data_quality_score || 0) >= 70) score += 15;
  if (inv.investment_sectors?.length > 0) score += 10;
  if (score >= 70) return "ready";
  if (score >= 40) return "needs_verification";
  return "not_ready";
}

function computeScores(inv: any, startup: { sector: string; stage: string; geo: string }) {
  const factors = [
    { s: sectorScore(inv.investment_sectors || [], startup.sector), w: 0.25 },
    { s: stageScore(inv.investment_stages || [], startup.stage), w: 0.20 },
    { s: geoScore(inv.investment_geographies || [], inv.country, startup.geo), w: 0.15 },
    { s: (inv.min_check_size || inv.max_check_size) ? 70 : 50, w: 0.10 },
    { s: completenessScore(inv), w: 0.10 },
    { s: (() => { let o = 0; if (inv.email) o += 30; if (inv.linkedin_url) o += 20; if (inv.is_verified) o += 15; return Math.min(o, 100); })(), w: 0.10 },
    { s: 50, w: 0.05 }, // activity (default)
    { s: (inv.bio && inv.bio.length > 50) ? 80 : inv.bio ? 40 : 20, w: 0.05 },
  ];
  
  const fitScore = Math.round(factors.reduce((sum, f) => sum + f.s * f.w, 0));
  const dq = completenessScore(inv);
  const readiness = outreachReadiness(inv);
  
  return { fitScore, dq, readiness };
}

// =============================================
// Main
// =============================================

async function main() {
  const startup = { sector: "saas", stage: "seed", geo: "United States" };
  
  // Check for company profile override
  const { data: profiles } = await supabase
    .from("company_profiles")
    .select("industry, company_stage, location")
    .limit(1);
  
  if (profiles?.[0]) {
    startup.sector = profiles[0].industry || startup.sector;
    startup.stage = profiles[0].company_stage || startup.stage;
    startup.geo = profiles[0].location || startup.geo;
  }
  
  console.log(`\n🎯 Scoring against: ${startup.sector} / ${startup.stage} / ${startup.geo}\n`);
  
  const startTime = Date.now();
  let processed = 0;
  let offset = 0;
  const BATCH = 5000;
  
  // Collect all unique (fit_score, dq, readiness) combinations
  // Then do bulk updates per combination
  const scoreGroups = new Map<string, string[]>(); // key -> [id, id, ...]
  
  while (true) {
    const { data: batch, error } = await supabase
      .from("investors")
      .select("id, email, linkedin_url, job_title, investor_type, investment_stages, investment_sectors, investment_geographies, country, city, min_check_size, max_check_size, bio, is_verified, do_not_contact, data_quality_score")
      .eq("fit_score", 0)
      .order("id")
      .range(offset, offset + BATCH - 1);
    
    if (error) { console.error("Error:", error.message); break; }
    if (!batch || batch.length === 0) break;
    
    // Score in memory (fast)
    for (const inv of batch) {
      const { fitScore, dq, readiness } = computeScores(inv, startup);
      const key = `${fitScore}|${dq}|${readiness}`;
      if (!scoreGroups.has(key)) scoreGroups.set(key, []);
      scoreGroups.get(key)!.push(inv.id);
    }
    
    processed += batch.length;
    
    if (processed % 10000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = Math.round(processed / (Date.now() - startTime) * 1000);
      console.log(`  📊 Scored ${processed.toLocaleString()} in memory — ${rate}/s (${scoreGroups.size} unique score groups)`);
    }
    
    offset += BATCH;
    if (batch.length < BATCH) break;
  }
  
  console.log(`\n📦 Memory scoring complete: ${processed.toLocaleString()} investors, ${scoreGroups.size} score groups`);
  console.log(`⏳ Now updating database in bulk...\n`);
  
  let updated = 0;
  let groupNum = 0;
  
  for (const [key, ids] of scoreGroups) {
    const [fitScore, dq, readiness] = key.split("|").map(v => parseInt(v) || v);
    
    // Update in chunks of 500 (Supabase limit for IN clause)
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase
        .from("investors")
        .update({
          fit_score: Number(fitScore),
          data_quality_score: Number(dq),
          outreach_readiness: readiness,
        })
        .in("id", chunk);
      
      if (error) {
        console.error(`  ⚠️  Update error for group ${key}: ${error.message}`);
      } else {
        updated += chunk.length;
      }
    }
    
    groupNum++;
    if (groupNum % 10 === 0 || groupNum === scoreGroups.size) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  📝 Updated ${updated.toLocaleString()} / ${processed.toLocaleString()} (${groupNum}/${scoreGroups.size} groups) — ${elapsed}s`);
    }
  }
  
  // Final stats
  const { count: ready } = await supabase.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", "ready");
  const { count: needsReview } = await supabase.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", "needs_verification");
  const { count: highFit } = await supabase.from("investors").select("id", { count: "exact", head: true }).gte("fit_score", 80);
  const { count: medFit } = await supabase.from("investors").select("id", { count: "exact", head: true }).gte("fit_score", 50).lt("fit_score", 80);
  const { count: withEmail } = await supabase.from("investors").select("id", { count: "exact", head: true }).not("email", "is", null).eq("outreach_readiness", "ready");
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`\n✅ Qualification complete!`);
  console.log(`   Total scored: ${updated.toLocaleString()}`);
  console.log(`   Time: ${elapsed}s\n`);
  console.log(`📊 Results:`);
  console.log(`   🟢 Ready for outreach:      ${ready?.toLocaleString() || 0}`);
  console.log(`   🟡 Needs verification:      ${needsReview?.toLocaleString() || 0}`);
  console.log(`   ⭐ High fit (80+):          ${highFit?.toLocaleString() || 0}`);
  console.log(`   🔵 Medium fit (50-79):      ${medFit?.toLocaleString() || 0}`);
  console.log(`   📧 Ready + has email:       ${withEmail?.toLocaleString() || 0}\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
