#!/usr/bin/env node
/**
 * Contact Enrichment Pipeline
 * 
 * Infers emails from investor names + company domains.
 * Uses common email patterns: first.last@, first@, flast@, etc.
 * Validates via MX record check.
 * 
 * Usage:
 *   node scripts/enrich-pipeline.js [--batch 200] [--offset 0] [--dry-run]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const dns = require("dns");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHECKPOINT_FILE = path.join(__dirname, "../data-backups/enrich-pipeline-checkpoint.json");
const BATCH_SIZE = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--batch") || "200");
const OFFSET = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--offset") || "0");
const DRY_RUN = process.argv.includes("--dry-run");

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")); }
  catch { return { lastOffset: 0, enriched: 0, verified: 0, failed: 0 }; }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function checkMxRecord(domain) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    dns.resolveMx(domain, (err, addresses) => {
      clearTimeout(timer);
      if (err || !addresses?.length) resolve(false);
      else resolve(true);
    });
  });
}

function getDomainFromWebsite(website) {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

function generateEmailPatterns(firstName, lastName, domain) {
  if (!firstName || !lastName || !domain) return [];
  
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const f = fn[0] || "";
  
  return [
    `${fn}.${ln}@${domain}`,
    `${fn}@${domain}`,
    `${f}${ln}@${domain}`,
    `${fn}${ln}@${domain}`,
    `${fn}_${ln}@${domain}`,
    `${ln}@${domain}`,
    `${ln}.${fn}@${domain}`,
  ];
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "dispostable.com", "trashmail.com", "10minutemail.com", "maildrop.cc",
]);

const COMMON_PERSONAL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "protonmail.com", "live.com", "msn.com", "me.com",
]);

async function main() {
  const checkpoint = loadCheckpoint();
  const startOffset = OFFSET || checkpoint.lastOffset;
  
  console.log("=".repeat(60));
  console.log("Contact Enrichment Pipeline");
  console.log("=".repeat(60));
  console.log(`Batch: ${BATCH_SIZE}, Offset: ${startOffset}`);
  console.log(`Previous: ${checkpoint.enriched} enriched, ${checkpoint.verified} verified\n`);

  // Get investors without emails but with company websites
  const { data: investors, error } = await sp
    .from("investors")
    .select("id, first_name, last_name, company_name, company_website, email")
    .is("email", null)
    .not("company_website", "is", null)
    .like("company_website", "http%")
    .not("company_name", "is", null)
    .range(startOffset, startOffset + BATCH_SIZE - 1);

  if (error) {
    console.error("Query error:", error.message);
    return;
  }

  if (!investors?.length) {
    console.log("No more investors to enrich.");
    return;
  }

  console.log(`Processing ${investors.length} investors...\n`);

  let enriched = checkpoint.enriched;
  let verified = checkpoint.verified;
  let failed = checkpoint.failed;
  const updates = [];

  // Pre-fetch existing emails to avoid duplicates
  const { data: existingEmails } = await sp
    .from("investors")
    .select("email")
    .not("email", "is", null)
    .limit(10000);
  
  const existingEmailSet = new Set(existingEmails?.map(e => e.email?.toLowerCase()) || []);

  // Also check a known corporate email pattern: info@domain
  const domainsToCheck = new Set();
  for (const inv of investors) {
    const domain = getDomainFromWebsite(inv.company_website);
    if (domain) domainsToCheck.add(domain);
  }

  // Check which domains have valid MX records
  const validDomains = new Set();
  for (const domain of domainsToCheck) {
    const hasMx = await checkMxRecord(domain);
    if (hasMx) validDomains.add(domain);
    await new Promise(r => setTimeout(r, 100)); // Rate limit DNS
  }

  console.log(`Valid domains (MX found): ${validDomains.size}/${domainsToCheck.size}\n`);

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    const domain = getDomainFromWebsite(inv.company_website);
    
    if (!domain || !validDomains.has(domain)) {
      failed++;
      continue;
    }

    const patterns = generateEmailPatterns(inv.first_name, inv.last_name, domain);
    let foundEmail = null;
    let confidence = "inferred";

    // Check if any pattern is already known (in our existing set)
    for (const pattern of patterns) {
      if (existingEmailSet.has(pattern)) {
        foundEmail = pattern;
        confidence = "likely";
        break;
      }
    }

    // If no known email, try the most common pattern
    if (!foundEmail && patterns.length > 0) {
      foundEmail = patterns[0]; // first.last@domain is most common
      confidence = "inferred";
    }

    if (foundEmail) {
      updates.push({
        id: inv.id,
        email: foundEmail,
        email_source: "enrichment-pipeline",
        email_verification_status: confidence === "likely" ? "likely" : "inferred",
      });
      enriched++;
    } else {
      failed++;
    }

    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\rProgress: ${i + 1}/${investors.length} | Enriched: ${enriched} | Verified: ${verified}`);
    }
  }

  // Apply updates
  if (!DRY_RUN && updates.length > 0) {
    console.log(`\n\nApplying ${updates.length} email enrichments...`);
    
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      for (const u of batch) {
        const { error } = await sp
          .from("investors")
          .update({
            email: u.email,
            email_source: u.email_source,
            email_verification_status: u.email_verification_status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", u.id);
        
        if (!error) verified++;
      }
      process.stdout.write(`\rUpdated: ${verified}/${updates.length}`);
    }
  }

  saveCheckpoint({
    lastOffset: startOffset + investors.length,
    enriched,
    verified,
    failed,
  });

  // Get updated totals
  const { count: totalWithEmail } = await sp
    .from("investors")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null);

  console.log("\n\n" + "=".repeat(60));
  console.log("ENRICHMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`Batch processed: ${investors.length}`);
  console.log(`Emails inferred: ${enriched}`);
  console.log(`Updates applied: ${verified}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total with email (DB): ${totalWithEmail}`);
  console.log(`\nNext batch: node scripts/enrich-pipeline.js --offset ${startOffset + investors.length}`);
}

main().catch(console.error);
