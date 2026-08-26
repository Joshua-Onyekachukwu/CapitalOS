#!/usr/bin/env node
/**
 * Email Inference Pipeline
 * ========================
 * Rule-based email inference for investors without emails.
 * Uses company names and websites to generate likely professional emails.
 *
 * Usage:
 *   node scripts/infer-emails.js --dry-run        # Test with 100 records
 *   node scripts/infer-emails.js --limit 5000     # Process 5000 records
 *   node scripts/infer-emails.js                  # Process all without emails
 *   node scripts/infer-emails.js --stats          # Show statistics
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const CHECKPOINT_FILE = path.resolve(__dirname, "../data-backups/email-inference-checkpoint.json");

// Common professional email prefixes
const COMMON_PREFIXES = [
  "info",
  "contact",
  "hello",
  "invest",
  "ir",
  "partnerships",
];

// Institutional name patterns that map to known domains
const KNOWN_DOMAINS = {
  "sequoia": "sequoiacap.com",
  "andreessen horowitz": "a16z.com",
  "a16z": "a16z.com",
  "kleiner perkins": "kp.org",
  "benchmark": "benchmark.com",
  "greylock": "greylock.com",
  "accel": "accel.com",
  "battery ventures": "battery.com",
  "general catalyst": "generalcatalyst.com",
  "founders fund": "foundersfund.com",
  "lightspeed": "lsvp.com",
  "index ventures": "indexventures.com",
  "atomico": "atomico.com",
  "balderton": "balderton.com",
  "y combinator": "ycombinator.com",
  "techstars": "techstars.com",
  "500 global": "500.co",
  "seedcamp": "seedcamp.com",
  "northzone": "northzone.com",
  "lakestar": "lakestar.com",
  "first round": "firstround.com",
  "spark capital": "sparkcapital.com",
  "union square": "usv.com",
  "tiger global": "tiger global",
  "softbank": "softbank.com",
  "blackrock": "blackrock.com",
  "vanguard": "vanguard.com",
  "fidelity": "fidelity.com",
  "goldman sachs": "goldmansachs.com",
  "jpmorgan": "jpmorgan.com",
  "morgan stanley": "morganstanley.com",
  "citadel": "citadel.com",
  "bridgewater": "bridgewater.com",
  "two sigma": "twosigma.com",
  "renaissance": "renaissance.com",
  "point72": "point72.com",
  "d.e. shaw": "deshaw.com",
  "warburg pincus": "warburgpincus.com",
  "carlyle": "carlyle.com",
  "apollo": "apollo.com",
  "blackstone": "blackstone.com",
  "kkr": "kkr.com",
  "tpg": "tpg.com",
  "silver lake": "silverlake.com",
  "brookfield": "brookfield.com",
  "jc flowers": "jcflowers.com",
  " permira": "permira.com",
  "cinven": "cinven.com",
  "advent international": "adventinternational.com",
  "hellman": "hellmanfriedman.com",
  "thoma bravo": "thomabravo.com",
  "venture": null,  // generic - skip
  "capital": null,  // generic - skip
  "partners": null, // generic - skip
  "ventures": null, // generic - skip
};

function extractDomainFromWebsite(website) {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const parsed = new URL(url);
    let domain = parsed.hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return null;
  }
}

function inferEmailFromDomain(domain, firstName, lastName, fullName) {
  if (!domain) return [];

  const emails = [];

  // Pattern 1: info@domain
  emails.push({ email: `info@${domain}`, pattern: "info@domain", confidence: 0.3 });

  // Pattern 2: contact@domain
  emails.push({ email: `contact@${domain}`, pattern: "contact@domain", confidence: 0.3 });

  // Pattern 3: firstname@domain (if we have a real first name)
  if (firstName && firstName.length > 2 && !firstName.includes(" ")) {
    const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
    if (fn.length > 1) {
      emails.push({ email: `${fn}@${domain}`, pattern: "firstname@domain", confidence: 0.4 });
    }
  }

  // Pattern 4: firstname.lastname@domain
  if (firstName && lastName && firstName.length > 2 && lastName.length > 2) {
    const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
    if (fn.length > 1 && ln.length > 1) {
      emails.push({ email: `${fn}.${ln}@${domain}`, pattern: "first.last@domain", confidence: 0.35 });
    }
  }

  return emails;
}

function inferDomainFromCompanyName(companyName) {
  if (!companyName) return null;

  const lower = companyName.toLowerCase().trim();

  // Check known domains
  for (const [pattern, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (lower.includes(pattern)) return domain;
  }

  // Skip generic/suffix-only names
  const genericWords = [
    "angel", "group", "associates", "office", "family", "fund",
    "investment", "holdings", "ventures", "capital", "partners",
    "llc", "inc", "ltd", "corp", "lp", "l.p.", "co",
    "the", "and", "&", "of", "for", "global", "international",
    "investments", "advisors", "advisory", "management",
    "wealth", "financial", "strategies", "advisors", "services",
    "separate", "account", "series", "class", "shares",
    "offshore", "onshore", "master", "spv", "lihtc",
  ];

  const words = lower.split(/[\s&,.]+/).filter(w => w.length > 2);
  const meaningfulWords = words.filter(w => !genericWords.includes(w));

  if (meaningfulWords.length === 0) return null;

  // Build domain from first 2-3 meaningful words, joined
  const domainParts = meaningfulWords.slice(0, 3).map(w => w.replace(/[^a-z0-9]/g, ""));
  const domain = domainParts.join("");

  if (domain.length < 4) return null;

  // Skip if domain is just a number or too short
  if (/^\d+$/.test(domain)) return null;

  return `${domain}.com`;
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"));
    }
  } catch {}
  return { lastCreated: null, processed: 0, enriched: 0 };
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

async function showStats() {
  const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { count: total } = await sp.from("investors").select("*", { count: "exact", head: true });
  const { count: withEmail } = await sp.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null).neq("email", "");
  const { count: withWebsite } = await sp.from("investors").select("*", { count: "exact", head: true }).not("company_website", "is", null).neq("company_website", "");
  const { count: withCompany } = await sp.from("investors").select("*", { count: "exact", head: true }).not("company_name", "is", null).neq("company_name", "");

  console.log("═══════════════════════════════════════════════");
  console.log("  Email Inference Stats");
  console.log("═══════════════════════════════════════════════\n");
  console.log(`  Total investors:          ${(total || 0).toLocaleString()}`);
  console.log(`  With email:               ${(withEmail || 0).toLocaleString()} (${Math.round(((withEmail || 0) / (total || 1)) * 100)}%)`);
  console.log(`  Without email:            ${((total || 0) - (withEmail || 0)).toLocaleString()}`);
  console.log(`  With company website:     ${(withWebsite || 0).toLocaleString()}`);
  console.log(`  With company name:        ${(withCompany || 0).toLocaleString()}`);
  console.log(`  Potential for inference:   ${((withWebsite || 0) - (withEmail || 0)).toLocaleString()}`);
  console.log("");
}

async function runInference(dryRun = false, limit = Infinity) {
  const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("═══════════════════════════════════════════════");
  console.log("  Email Inference Pipeline");
  console.log("═══════════════════════════════════════════════\n");

  if (dryRun) console.log("🧪 DRY RUN — testing with records, no DB updates\n");

  // First count total
  const { count: totalNoEmail } = await sp
    .from("investors")
    .select("*", { count: "exact", head: true })
    .or("email.is.null,email.eq.");

  console.log(`   Total without email: ${(totalNoEmail || 0).toLocaleString()}\n`);

  // Paginate through all investors without email
  const BATCH_SIZE = 1000;
  let offset = 0;
  let allInvestors = [];

  while (offset < (totalNoEmail || 0) && allInvestors.length < limit) {
    const { data: batch } = await sp
      .from("investors")
      .select("id, full_name, first_name, last_name, company_name, company_website, email")
      .or("email.is.null,email.eq.")
      .order("created_at", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (!batch || batch.length === 0) break;
    allInvestors = allInvestors.concat(batch);
    offset += BATCH_SIZE;
    process.stdout.write(`\r   Fetched ${allInvestors.length.toLocaleString()} / ${Math.min(totalNoEmail || 0, limit).toLocaleString()}...`);
  }

  console.log(`\n\n   Processing ${allInvestors.length.toLocaleString()} investors...\n`);

  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  const updates = [];

  for (const investor of allInvestors) {
    // Use company_name if available, otherwise use full_name (many EDGAR entries are fund names)
    const companyName = investor.company_name || investor.full_name;
    const domain = extractDomainFromWebsite(investor.company_website) ||
                   inferDomainFromCompanyName(companyName);

    if (!domain) {
      skipped++;
      continue;
    }

    // Skip generic domains
    if (domain === "null" || domain.includes("null")) {
      skipped++;
      continue;
    }

    const firstName = investor.first_name || investor.full_name?.split(" ")[0] || "";
    const lastName = investor.last_name || investor.full_name?.split(" ").slice(-1)[0] || "";
    const fullName = investor.full_name || "";

    const inferredEmails = inferEmailFromDomain(domain, firstName, lastName, fullName);

    if (inferredEmails.length === 0) {
      skipped++;
      continue;
    }

    // For institutional names (all caps, contains 'fund', 'capital', etc.), prefer info@
    const isInstitutional = /[A-Z]{3,}/.test(investor.full_name) ||
      /fund|capital|management|advisors|advisory|wealth|financial|group|associates|llc|inc|ltd|corp|lp|separate account/i.test(investor.full_name);
    const best = isInstitutional
      ? inferredEmails.find(e => e.pattern === "info@domain") || inferredEmails.sort((a, b) => b.confidence - a.confidence)[0]
      : inferredEmails.sort((a, b) => b.confidence - a.confidence)[0];

    updates.push({
      id: investor.id,
      email: best.email,
      email_source: `inferred_${best.pattern}`,
      email_verification_status: "unknown",
    });

    enriched++;

    if (enriched % 100 === 0) {
      process.stdout.write(`\r   Processed ${enriched}...`);
    }
  }

  console.log(`\n\n   📊 Results:`);
  console.log(`      Enrichable:     ${enriched}`);
  console.log(`      Skipped:        ${skipped}`);
  console.log(`      Total batch:    ${allInvestors.length}`);

  if (dryRun) {
    console.log(`\n   🧪 Sample inferred emails (first 10):`);
    updates.slice(0, 10).forEach(u => {
      console.log(`      ${u.email} (${u.email_source})`);
    });
    console.log(`\n   Run without --dry-run to apply changes.\n`);
    return;
  }

  // Apply updates in batches of 50 using Promise.all for parallelism
  let applied = 0;
  const BATCH = 50;

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const promises = batch.map(update =>
      sp
        .from("investors")
        .update({
          email: update.email,
          email_source: update.email_source,
          email_verification_status: update.email_verification_status,
        })
        .eq("id", update.id)
        .then(({ error }) => (error ? { err: true } : { ok: true }))
    );

    const results = await Promise.all(promises);
    results.forEach(r => (r.err ? errors++ : applied++));

    if (applied % 500 === 0 || i + BATCH >= updates.length) {
      process.stdout.write(`\r   Applied ${applied} / ${updates.length}...`);
    }
  }

  console.log(`\n\n   ✅ Email inference complete!`);
  console.log(`      Applied:   ${applied}`);
  console.log(`      Errors:    ${errors}`);
  console.log(`      Skipped:   ${skipped}\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--stats")) {
    await showStats();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

  await runInference(dryRun, limit);
}

main().catch(console.error);
