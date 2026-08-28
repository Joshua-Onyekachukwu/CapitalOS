#!/usr/bin/env node
/**
 * Contact Enrichment Pipeline
 * 
 * Infers email addresses from investor names + company domains.
 * Uses common email patterns and AI-powered inference.
 * 
 * Usage: node scripts/contact-enrichment-pipeline.js [--limit 500] [--batch 50] [--dry-run]
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const { createClient } = require("@supabase/supabase-js");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 50;

function generateEmailPatterns(firstName, lastName, domain) {
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  
  if (!fn || !ln || !domain) return [];

  return [
    `${fn}.${ln}@${domain}`,
    `${fn}${ln}@${domain}`,
    `${fn[0]}${ln}@${domain}`,
    `${fn}@${domain}`,
    `${ln}@${domain}`,
    `${fn}.${ln[0]}@${domain}`,
    `${fn[0]}.${ln}@${domain}`,
  ];
}

function inferDomainFromCompany(companyName) {
  if (!companyName) return null;
  
  const clean = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  
  // Common domain patterns
  const words = clean.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return null;

  // Try common TLDs
  const base = words.join("");
  return `${base}.com`;
}

function guessEmailDomain(investor) {
  // Try website first
  if (investor.website && investor.website.startsWith("http")) {
    try {
      const url = new URL(investor.website);
      return url.hostname.replace(/^www\./, "");
    } catch {}
  }

  // Try to extract from existing email
  if (investor.email && investor.email.includes("@")) {
    return investor.email.split("@")[1];
  }

  // Infer from firm name
  if (investor.firm_name) {
    return inferDomainFromCompany(investor.firm_name);
  }

  return null;
}

async function enrichBatch(investors) {
  const results = {
    enriched: 0,
    alreadyHaveEmail: 0,
    noDomain: 0,
    errors: 0,
  };

  for (const investor of investors) {
    // Skip if already has email
    if (investor.email && investor.email.includes("@")) {
      results.alreadyHaveEmail++;
      continue;
    }

    // Try to get domain
    const domain = guessEmailDomain(investor);
    if (!domain) {
      results.noDomain++;
      continue;
    }

    // Generate patterns
    const firstName = investor.first_name || investor.full_name?.split(" ")[0];
    const lastName = investor.last_name || investor.full_name?.split(" ").slice(1).join(" ");
    
    if (!firstName || !lastName) {
      results.noDomain++;
      continue;
    }

    const patterns = generateEmailPatterns(firstName, lastName, domain);
    if (patterns.length === 0) {
      results.noDomain++;
      continue;
    }

    // Use the most common pattern (first.last@domain)
    const inferredEmail = patterns[0];

    // Update the investor record
    try {
      const { error } = await sp
        .from("investors")
        .update({
          email: inferredEmail,
          email_source: "ai_inferred",
          email_verification_status: "inferred",
          email_confidence: 60,
          updated_at: new Date().toISOString(),
        })
        .eq("id", investor.id);

      if (error) {
        results.errors++;
      } else {
        results.enriched++;
      }
    } catch {
      results.errors++;
    }
  }

  return results;
}

async function main() {
  console.log("=== Contact Enrichment Pipeline ===\n");

  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a, i) => args[i - 1] === "--limit") || "1000");
  const batchSize = parseInt(args.find((a, i) => args[i - 1] === "--batch") || String(BATCH_SIZE));
  const dryRun = args.includes("--dry-run");

  // Get investors without emails
  const { data: investors, count } = await sp
    .from("investors")
    .select("id, full_name, first_name, last_name, email, firm_name, website, investor_type")
    .or("email.is.null,email.eq.")
    .order("fit_score", { ascending: false })
    .limit(limit);

  console.log(`Found ${investors?.length || 0} investors without emails`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Limit: ${limit}\n`);

  if (!investors || investors.length === 0) {
    console.log("No investors to enrich.");
    return;
  }

  if (dryRun) {
    console.log("[DRY RUN] Would enrich these investors:");
    for (const inv of investors.slice(0, 10)) {
      const domain = guessEmailDomain(inv);
      const firstName = inv.first_name || inv.full_name?.split(" ")[0];
      const lastName = inv.last_name || inv.full_name?.split(" ").slice(1).join(" ");
      const patterns = domain ? generateEmailPatterns(firstName, lastName, domain) : [];
      console.log(`  ${inv.full_name} (${inv.firm_name || "no firm"}) → ${patterns[0] || "no domain"}`);
    }
    return;
  }

  // Process in batches
  let totalEnriched = 0;
  let totalAlready = 0;
  let totalNoDomain = 0;
  let totalErrors = 0;

  for (let i = 0; i < investors.length; i += batchSize) {
    const batch = investors.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(investors.length / batchSize)}...`);
    
    const results = await enrichBatch(batch);
    totalEnriched += results.enriched;
    totalAlready += results.alreadyHaveEmail;
    totalNoDomain += results.noDomain;
    totalErrors += results.errors;

    console.log(`  Enriched: ${results.enriched}, Already have email: ${results.alreadyHaveEmail}, No domain: ${results.noDomain}, Errors: ${results.errors}`);
  }

  console.log("\n=== Results ===");
  console.log(`Total enriched: ${totalEnriched}`);
  console.log(`Already had email: ${totalAlready}`);
  console.log(`No domain found: ${totalNoDomain}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(console.error);
