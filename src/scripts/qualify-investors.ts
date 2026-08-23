import { query, closePool } from "./db";

/** Parse a CockroachDB/PostgreSQL text[] value into a JS array. */
function parsePgArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== "string") return [];
  // CockroachDB returns "{a,b,c}" — strip braces and split
  const inner = val.replace(/^\{/, "").replace(/\}$/, "");
  if (!inner) return [];
  return inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

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
    { s: sectorScore(parsePgArray(inv.investment_sectors), startup.sector), w: 0.25 },
    { s: stageScore(parsePgArray(inv.investment_stages), startup.stage), w: 0.20 },
    { s: geoScore(parsePgArray(inv.investment_geographies), inv.country, startup.geo), w: 0.15 },
    { s: (inv.min_check_size || inv.max_check_size) ? 70 : 50, w: 0.10 },
    { s: completenessScore(inv), w: 0.10 },
    { s: (() => { let o = 0; if (inv.email) o += 30; if (inv.linkedin_url) o += 20; if (inv.is_verified) o += 15; return Math.min(o, 100); })(), w: 0.10 },
    { s: 50, w: 0.05 },
    { s: (inv.bio && inv.bio.length > 50) ? 80 : inv.bio ? 40 : 20, w: 0.05 },
  ];

  const fitScore = Math.round(factors.reduce((sum, f) => sum + f.s * f.w, 0));
  const dq = completenessScore(inv);
  const readiness = outreachReadiness(inv);

  return { fitScore, dq, readiness };
}

async function main() {
  const startup = { sector: "saas", stage: "seed", geo: "United States" };

  const profiles = await query<any>(
    `SELECT industry, company_stage, location FROM company_profiles LIMIT 1`
  );

  if (profiles[0]) {
    startup.sector = profiles[0].industry || startup.sector;
    startup.stage = profiles[0].company_stage || startup.stage;
    startup.geo = profiles[0].location || startup.geo;
  }

  console.log(`\n🎯 Scoring against: ${startup.sector} / ${startup.stage} / ${startup.geo}\n`);

  const startTime = Date.now();
  let processed = 0;
  const BATCH = 5000;
  const scoreGroups = new Map<string, string[]>();

  // Score in memory
  let offset = 0;
  while (true) {
    const batch = await query<any>(
      `SELECT id, email, linkedin_url, job_title, investor_type, investment_stages, investment_sectors, investment_geographies, country, city, min_check_size, max_check_size, bio, is_verified, do_not_contact, data_quality_score
       FROM investors WHERE fit_score = 0 ORDER BY id LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    );

    if (!batch.length) break;

    for (const inv of batch) {
      const { fitScore, dq, readiness } = computeScores(inv, startup);
      const key = `${fitScore}|${dq}|${readiness}`;
      if (!scoreGroups.has(key)) scoreGroups.set(key, []);
      scoreGroups.get(key)!.push(inv.id);
    }

    processed += batch.length;
    offset += BATCH;
    if (batch.length < BATCH) break;
  }

  console.log(`\n📦 Memory scoring complete: ${processed.toLocaleString()} investors, ${scoreGroups.size} score groups`);
  console.log(`⏳ Now updating database in bulk...\n`);

  let updated = 0;
  let groupNum = 0;

  for (const [key, ids] of scoreGroups) {
    const [fitScore, dq, readiness] = key.split("|");

    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const placeholders = chunk.map((_, j) => `$${j + 4}`).join(", ");
      await query(
        `UPDATE investors SET fit_score = $1, data_quality_score = $2, outreach_readiness = $3 WHERE id IN (${placeholders})`,
        [parseInt(fitScore), parseInt(dq), readiness, ...chunk]
      );
      updated += chunk.length;
    }

    groupNum++;
    if (groupNum % 10 === 0 || groupNum === scoreGroups.size) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  📝 Updated ${updated.toLocaleString()} / ${processed.toLocaleString()} (${groupNum}/${scoreGroups.size} groups) — ${elapsed}s`);
    }
  }

  // Final stats
  const ready = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE outreach_readiness = 'ready'`);
  const needsReview = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE outreach_readiness = 'needs_verification'`);
  const highFit = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE fit_score >= 80`);
  const medFit = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE fit_score >= 50 AND fit_score < 80`);
  const withEmail = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE email IS NOT NULL AND outreach_readiness = 'ready'`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Qualification complete!`);
  console.log(`   Total scored: ${updated.toLocaleString()}`);
  console.log(`   Time: ${elapsed}s\n`);
  console.log(`📊 Results:`);
  console.log(`   🟢 Ready for outreach:      ${parseInt(ready[0]?.count || "0").toLocaleString()}`);
  console.log(`   🟡 Needs verification:      ${parseInt(needsReview[0]?.count || "0").toLocaleString()}`);
  console.log(`   ⭐ High fit (80+):          ${parseInt(highFit[0]?.count || "0").toLocaleString()}`);
  console.log(`   🔵 Medium fit (50-79):      ${parseInt(medFit[0]?.count || "0").toLocaleString()}`);
  console.log(`   📧 Ready + has email:       ${parseInt(withEmail[0]?.count || "0").toLocaleString()}\n`);

  await closePool();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
