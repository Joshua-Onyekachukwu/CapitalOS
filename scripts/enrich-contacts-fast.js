#!/usr/bin/env node
/**
 * Capital OS — Fast Contact Enrichment (Rule-Based)
 * ==================================================
 * Maps firm names to known domains, infers emails from patterns,
 * verifies via DNS MX lookup. No AI needed — runs in minutes, not hours.
 *
 * Usage:
 *   node scripts/enrich-contacts-fast.js --limit 5000    # Process first 5000
 *   node scripts/enrich-contacts-fast.js                 # All without emails
 *   node scripts/enrich-contacts-fast.js --dry-run       # Preview only
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const dns = require("dns").promises;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Known Firm → Domain Mapping ──────────────────────────────────────────
const KNOWN_DOMAINS = {
  // Top-tier VCs
  "sequoia capital": "sequoiacap.com",
  "sequoia": "sequoiacap.com",
  "andreessen horowitz": "a16z.com",
  "a16z": "a16z.com",
  "benchmark": "benchmark.com",
  "lightspeed venture partners": "lsvp.com",
  "lightspeed": "lsvp.com",
  "kleiner perkins": "kleinerperkins.com",
  "founders fund": "foundersfund.com",
  "y combinator": "ycombinator.com",
  "first round capital": "firstround.com",
  "union square ventures": "usv.com",
  "battery ventures": "battery.com",
  "greylock partners": "greylock.com",
  "经纬创投": "matrixpartners.com",
  "matrix partners": "matrixpartners.com",
  "insight partners": "insightpartners.com",
  "general catalyst": "generalcatalyst.com",
  "tiger global": "tigerglobal.com",
  "softbank vision fund": "softbank.com",
  "softbank": "softbank.com",
  "ivp": "ivp.com",
  "excel partners": "excel.com",
  "sequel sequoia": "sequoiacap.com",
  "sequoia capital china": "sequoiacap.com",
  "NEA": "nea.com",
  "new enterprise associates": "nea.com",
  "accel partners": "accel.com",
  "accel": "accel.com",
  "bessemer venture partners": "bvp.com",
  "bessemer": "bvp.com",
  "index ventures": "indexventures.com",
  "union square": "usv.com",
  "kv fund": "kpcb.com",
  "kpcb": "kpcb.com",
  "sequoia heritage": "sequoiacap.com",
  "sequoia scouts": "sequoiacap.com",
  "founders fund": "foundersfund.com",
  "valiant ventures": "valiant.com",
  "spark capital": "sparkcapital.com",
  "spark": "sparkcapital.com",
  "ashlan ventures": "ashlan.com",
  "crv": "crv.com",
  "benchmark capital": "benchmark.com",
  "kleiner perkins caufield byers": "kpcb.com",
  "madrona venture group": "madrona.com",
  "madrona": "madrona.com",
  "mayfield fund": "mayfield.com",
  "mayfield": "mayfield.com",
  "nfx": "nfx.com",
  "upleft partners": "upleft.com",
  " Initialized Capital": "initialized.com",
  "Initialized": "initialized.com",
  "true ventures": "trueventures.com",
  "true": "trueventures.com",
  "canvas ventures": "canvas.vc",
  "riverside Acceleration Capital": "riversideac.com",
  "GGV Capital": "ggvc.com",
  "GGV": "ggvc.com",
  "Wing Venture Capital": "wing.vc",
  "Wing": "wing.vc",
  "Foundry Group": "foundrygroup.com",
  "Foundry": "foundrygroup.com",
  "Polaris Partners": "polarispartners.com",
  "Polaris": "polarispartners.com",
  "Felicis Ventures": "felicis.com",
  "Felicis": "felicis.com",
  "Redpoint Ventures": "redpoint.com",
  "Redpoint": "redpoint.com",
  "Scale Venture Partners": "scalevp.com",
  "ScaleVP": "scalevp.com",
  "Sunshine Capital": "sunshine.com",
  "Bessemer": "bvp.com",
  "BVP": "bvp.com",
  "Sapphire Ventures": "sapphireventures.com",
  "Sapphire": "sapphireventures.com",
  "Norwest Venture Partners": "nvp.com",
  "Norwest": "nvp.com",
  "Wing Venture Capital": "wing.vc",
  "Wing": "wing.vc",
  "Foundry Group": "foundrygroup.com",
  "Foundry": "foundrygroup.com",
  "Polaris Partners": "polarispartners.com",
  "Polaris": "polarispartners.com",
  "Felicis Ventures": "felicis.com",
  "Felicis": "felicis.com",
  "Redpoint Ventures": "redpoint.com",
  "Redpoint": "redpoint.com",
  "Scale Venture Partners": "scalevp.com",
  "ScaleVP": "scalevp.com",
  "Sunshine Capital": "sunshine.com",

  // Mid-tier VCs
  "atomico": "atomico.com",
  "northzone": "northzone.com",
  "draper esprit": "drapereprit.com",
  "draper": "draper.com",
  "ldp capital": "ldp.com",
  "london venture partners": "londonvp.com",
  "balderton capital": "balderton.com",
  "balderton": "balderton.com",
  "accel partners": "accel.com",
  "augment capital": "augment.com",
  "hoxton ventures": "hoxton.vc",
  "passion capital": "passioncapital.com",
  "passion": "passioncapital.com",
  "seedcamp": "seedcamp.com",
  "point nine capital": "pointninecapital.com",
  "point nine": "pointninecapital.com",

  // CVCs
  "google ventures": "gv.com",
  "GV": "gv.com",
  "intel capital": "intel.com",
  "microsoft ventures": "microsoft.com",
  "salesforce ventures": "salesforce.com",
  "aws ventures": "amazon.com",
  "nvidia ventures": "nvidia.com",
  "salesforce": "salesforce.com",
  "microsoft": "microsoft.com",
  "google": "google.com",
  "amazon": "amazon.com",
  "meta": "meta.com",
  "apple": "apple.com",

  // PE firms
  "blackstone": "blackstone.com",
  "kkr": "kkr.com",
  "carlyle group": "carlyle.com",
  "carlyle": "carlyle.com",
  "apollo global": "apollo.com",
  "apollo": "apollo.com",
  "tpg": "tpg.com",
  "warburg pincus": "warburgpincus.com",
  "warburg": "warburgpincus.com",
  "silver lake": "silverlake.com",
  "silverlake": "silverlake.com",
  "vista equity": "vistaequity.com",
  "vista": "vistaequity.com",
  "thoma bravo": "thomabravo.com",
  "thoma": "thomabravo.com",
  "general atlantic": "generalatlantic.com",
  "general atlantic": "generalatlantic.com",
  "permira": "permira.com",
  "cinven": "cinven.com",
  "bc partners": "bcpartners.com",
  "advent international": "adventinternational.com",
  "advent": "adventinternational.com",
  "goldman sachs": "goldmansachs.com",
  "jp morgan": "jpmorgan.com",
  "morgan stanley": "morganstanley.com",
  "citadel": "citadel.com",
  "deutsche bank": "deutschebank.com",

  // Accelerators
  "techstars": "techstars.com",
  "plug and play": "plugandplaytechcenter.com",
  "500 startups": "500.co",
  "500 global": "500.co",
  "soma capital": "somacapital.com",
  "soma": "somacapital.com",

  // Crypto/Web3
  "paradigm": "paradigm.xyz",
  "polychain capital": "polychain.capital",
  "polychain": "polychain.capital",
  "a_16z crypto": "a16zcrypto.com",
  "coinbase ventures": "coinbase.com",
  "binance labs": "binance.com",
  "galaxy digital": "galaxydigital.io",
  "galaxy": "galaxydigital.io",
  "digital currency group": "dcg.co",
  "dcg": "dcg.co",

  // International
  "tencent": "tencent.com",
  "alibaba": "alibaba.com",
  "baidu": "baidu.com",
  "bytedance": "bytedance.com",
  "flipkart": "flipkart.com",
  "zomato": "zomato.com",
  "paytm": "paytm.com",

  // Family offices
  "dcm": "dcm.com",
  "matrix partners china": "matrixpartners.cn",
  "shunwei capital": "shunwei.com",
  "hibit": "hibit.com",
  "hillhouse capital": "hillhousecap.com",
  "hillhouse": "hillhousecap.com",
  "gte capital": "gtecapital.com",
  "gte": "gtecapital.com",

  // More VCs
  "stealth venture labs": "stealthventures.com",
  "stature capital": "stature.com",
  "stature": "stature.com",
  "sweet capital": "sweetcapital.com",
  "sweet": "sweetcapital.com",
  "systemic capital": "systemic.com",
  "systemic": "systemic.com",
  "true": "trueventures.com",
  "tvc capital": "tvc.com",
  "tvc": "tvc.com",
  "umbrella capital": "umbrella.com",
  "umbrella": "umbrella.com",
  "velocity capital": "velocity.com",
  "velocity": "velocity.com",
  "venture craft": "venturecraft.com",
  "venturecraft": "venturecraft.com",
  "venturecraft": "venturecraft.com",
  "virtus ventures": "virtus.com",
  "virtus": "virtus.com",
  "wild Pacific capital": "wildpacific.com",
  "wild pacific": "wildpacific.com",
  "xnb ventures": "xnb.com",
  "xnb": "xnb.com",
  "yenem capital": "yenem.com",
  "yenem": "yenem.com",
  "ygc capital": "ygc.com",
  "ygc": "ygc.com",
  "zen ventures": "zen.com",
  "zen": "zen.com",
  "zone ventures": "zone.com",
  "zone": "zone.com",

  // Healthcare
  "venrock": "venrock.com",
  "arch venture partners": "archventure.com",
  "arch": "archventure.com",
  "lilly ventures": "lilly.com",
  "rock health": "rockhealth.com",
  "rockhealth": "rockhealth.com",
  "new century health": "newcentury.com",
  "new century": "newcentury.com",

  // AI/ML
  "coatue management": "coatue.com",
  "coatue": "coatue.com",
  "d1 capital": "d1.com",
  "d1": "d1.com",
  "dragoneer investment": "dragoneer.com",
  "dragoneer": "dragoneer.com",
  "sands capital": "sandscapital.com",
  "sands": "sandscapital.com",
  "老虎环球": "tigerglobal.com",
  "tiger": "tigerglobal.com",
};

// ─── Name → Domain Inference ──────────────────────────────────────────────
const STRIP_WORDS = /\b(ventures?|capital|fund|partners?|associates?|advisors?|management|investments?|holdings?|group|llc|ltd|inc|corp|lp|l\.p\.|advisory|securities|global|international)\b/gi;
const PERSON_PREFIXES = /^(mr|mrs|ms|dr|prof)\.\s*/i;

function inferDomainFromName(name) {
  if (!name) return null;

  // Skip person names
  const clean = name.trim();
  if (PERSON_PREFIXES.test(clean)) return null;
  const words = clean.split(/\s+/);
  if (words.length > 4) return null; // Probably a sentence, not a firm

  // Check known domains first
  const lower = clean.toLowerCase();
  if (KNOWN_DOMAINS[lower]) return KNOWN_DOMAINS[lower];

  // Try fuzzy match on known domains
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (lower.includes(key) || key.includes(lower)) return domain;
  }

  // Infer from name
  const slug = clean
    .toLowerCase()
    .replace(STRIP_WORDS, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (slug.length < 3 || slug.length > 30) return null;

  // Common TLD patterns for VCs
  return `${slug}.com`;
}

// ─── Email Pattern Generation ─────────────────────────────────────────────
function inferEmails(domain, name) {
  if (!domain) return [];
  const patterns = [
    `info@${domain}`,
    `hello@${domain}`,
    `contact@${domain}`,
    `invest@${domain}`,
  ];
  return patterns;
}

// ─── DNS Verification ─────────────────────────────────────────────────────
async function verifyDomain(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length > 0) return { valid: true, hasMx: true };
  } catch {}
  try {
    const a = await dns.resolve4(domain);
    if (a && a.length > 0) return { valid: true, hasMx: false };
  } catch {}
  return { valid: false, hasMx: false };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Fast Contact Enrichment (Rule-Based)");
  console.log("═══════════════════════════════════════════════════════════\n");
  if (dryRun) console.log("⚠️  DRY RUN\n");

  // Fetch investors without emails
  console.log("📥 Fetching investors without emails...");
  let all = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("investors")
      .select("id, full_name, investor_type, company_name, company_website")
      .is("email", null)
      .not("full_name", "is", null)
      .range(offset, offset + 999);

    if (error || !data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
    process.stdout.write(`\r   ${all.length}...`);
    if (limit && all.length >= limit) { all = all.slice(0, limit); break; }
  }

  console.log(`\n   Total: ${all.length}\n`);

  // Process in batches
  const BATCH = 100;
  let enriched = 0;
  let domainsVerified = 0;
  let skipped = 0;
  let failed = 0;
  const startTime = Date.now();
  const domainCache = new Map();

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const updates = [];

    for (const inv of batch) {
      // Skip if already has website
      if (inv.company_website) { skipped++; continue; }

      const name = inv.full_name;
      let domain = inferDomainFromName(name);

      // Check cache for DNS verification
      if (domain && !domainCache.has(domain)) {
        const verification = await verifyDomain(domain);
        domainCache.set(domain, verification);
        if (verification.valid) domainsVerified++;
      }

      const cached = domainCache.get(domain);
      if (!cached?.valid) {
        // Try without TLD suffix
        const altDomain = domain?.replace(".com", "");
        if (altDomain && !domainCache.has(altDomain)) {
          const alt = await verifyDomain(altDomain);
          domainCache.set(altDomain, alt);
        }
        if (!domainCache.get(altDomain)?.valid) {
          skipped++;
          continue;
        }
        domain = altDomain;
      }

      const email = `info@${domain}`;

      updates.push({
        id: inv.id,
        email,
        company_website: `https://${domain}`,
        company_name: inv.company_name || name,
        email_verification_status: "inferred",
        email_source: "rule_enrichment",
        updated_at: new Date().toISOString(),
      });
    }

    // Batch update
    if (updates.length > 0 && !dryRun) {
      for (const u of updates) {
        const { error } = await supabase
          .from("investors")
          .update({
            email: u.email,
            company_website: u.company_website,
            company_name: u.company_name,
            email_verification_status: u.email_verification_status,
            email_source: u.email_source,
            updated_at: u.updated_at,
          })
          .eq("id", u.id);

        if (!error) enriched++;
        else failed++;
      }
    } else if (dryRun) {
      enriched += updates.length;
      if (i === 0) {
        console.log("  Sample enrichments:");
        updates.slice(0, 5).forEach((u) => {
          console.log(`    ${u.company_name} → ${u.email} (${u.company_website})`);
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = enriched > 0 ? ((enriched / (Date.now() - startTime)) * 60000).toFixed(0) : 0;
    process.stdout.write(`\r   ⚡ [${Math.min(i + BATCH, all.length)}/${all.length}] enriched: ${enriched} | verified: ${domainsVerified} | skipped: ${skipped} | ${rate}/min | ⏱️ ${elapsed}s     `);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log(`\n\n═══════════════════════════════════════════════════════════`);
  console.log(`  ✅ Fast Contact Enrichment Complete`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  console.log(`   📊 Processed: ${all.length}`);
  console.log(`   ✅ Enriched: ${enriched}`);
  console.log(`   🔍 Domains verified: ${domainsVerified}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Time: ${elapsed}s`);
  console.log(`   🌐 Unique domains verified: ${domainCache.size}`);

  // Database summary
  if (!dryRun) {
    const { count: totalE } = await supabase.from("investors").select("id", { count: "exact", head: true }).not("email", "is", null);
    const { count: ruleE } = await supabase.from("investors").select("id", { count: "exact", head: true }).eq("email_source", "rule_enrichment");
    const { count: total } = await supabase.from("investors").select("id", { count: "exact", head: true });

    console.log(`\n📊 Database:`);
    console.log(`   Total: ${total} | With emails: ${totalE} (${((totalE / total) * 100).toFixed(1)}%) | Rule-enriched: ${ruleE}`);
  }
}

main().catch((e) => { console.error("💥", e.message); process.exit(1); });
