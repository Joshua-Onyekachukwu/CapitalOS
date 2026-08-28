#!/usr/bin/env node
/**
 * Email Verification Service
 * 
 * Verifies inferred email addresses using DNS MX record checks
 * and common validation patterns.
 * 
 * Usage: node scripts/verify-emails.js [--limit 500] [--batch 50] [--dry-run]
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const { createClient } = require("@supabase/supabase-js");
const dns = require("dns");
const { promisify } = require("util");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);

const BATCH_SIZE = 50;

async function verifyEmail(email) {
  if (!email || !email.includes("@")) {
    return { valid: false, reason: "invalid_format" };
  }

  const [, domain] = email.split("@");
  
  if (!domain) {
    return { valid: false, reason: "no_domain" };
  }

  // Check common disposable email domains
  const disposableDomains = [
    "tempmail.com", "throwaway.com", "guerrillamail.com", "mailinator.com",
    "yopmail.com", "temp-mail.org", "fakeinbox.com", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "dispostable.com", "maildrop.cc",
  ];
  
  if (disposableDomains.includes(domain.toLowerCase())) {
    return { valid: false, reason: "disposable_email" };
  }

  try {
    // Check MX records
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: "no_mx_records" };
    }

    // Check if domain resolves
    const aRecords = await resolve4(domain);
    if (!aRecords || aRecords.length === 0) {
      return { valid: false, reason: "domain_not_resolving" };
    }

    // Common valid providers
    const validProviders = [
      "google.com", "gmail.com", "googlemail.com",
      "outlook.com", "hotmail.com", "live.com",
      "yahoo.com", "icloud.com", "me.com",
      "protonmail.com", "proton.me",
      "zoho.com", "fastmail.com",
    ];

    const isKnownProvider = validProviders.some(p => domain.toLowerCase().includes(p));
    const confidence = isKnownProvider ? 85 : 70;

    return {
      valid: true,
      reason: "mx_records_found",
      confidence,
      mxProvider: mxRecords[0]?.exchange || null,
    };
  } catch (err) {
    if (err.code === "ENOTFOUND") {
      return { valid: false, reason: "domain_not_found" };
    }
    return { valid: false, reason: `dns_error: ${err.code}` };
  }
}

async function verifyBatch(investors) {
  const results = {
    verified: 0,
    likely: 0,
    invalid: 0,
    errors: 0,
    alreadyVerified: 0,
  };

  for (const investor of investors) {
    // Skip if already verified
    if (investor.email_verification_status === "verified") {
      results.alreadyVerified++;
      continue;
    }

    if (!investor.email) {
      results.errors++;
      continue;
    }

    try {
      const verification = await verifyEmail(investor.email);
      
      let status;
      let confidence;
      
      if (verification.valid) {
        if (verification.confidence >= 80) {
          status = "verified";
          confidence = verification.confidence;
          results.verified++;
        } else {
          status = "likely";
          confidence = verification.confidence;
          results.likely++;
        }
      } else {
        status = "invalid";
        confidence = 0;
        results.invalid++;
      }

      // Update the investor record
      const { error } = await sp
        .from("investors")
        .update({
          email_verification_status: status,
          email_confidence: confidence,
          email_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", investor.id);

      if (error) {
        results.errors++;
      }
    } catch {
      results.errors++;
    }
  }

  return results;
}

async function main() {
  console.log("=== Email Verification Service ===\n");

  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a, i) => args[i - 1] === "--limit") || "1000");
  const batchSize = parseInt(args.find((a, i) => args[i - 1] === "--batch") || String(BATCH_SIZE));
  const dryRun = args.includes("--dry-run");

  // Get investors with emails but not yet verified
  const { data: investors } = await sp
    .from("investors")
    .select("id, email, email_verification_status, full_name")
    .not("email", "is", null)
    .neq("email", "")
    .or("email_verification_status.is.null,email_verification_status.eq.inferred,email_verification_status.eq.unverified")
    .order("fit_score", { ascending: false })
    .limit(limit);

  console.log(`Found ${investors?.length || 0} emails to verify`);
  console.log(`Batch size: ${batchSize}\n`);

  if (!investors || investors.length === 0) {
    console.log("No emails to verify.");
    return;
  }

  if (dryRun) {
    console.log("[DRY RUN] Would verify:");
    for (const inv of investors.slice(0, 10)) {
      const result = await verifyEmail(inv.email);
      console.log(`  ${inv.email} → ${result.valid ? "VALID" : "INVALID"} (${result.reason})`);
    }
    return;
  }

  // Process in batches
  let totalVerified = 0;
  let totalLikely = 0;
  let totalInvalid = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (let i = 0; i < investors.length; i += batchSize) {
    const batch = investors.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(investors.length / batchSize)}...`);
    
    const results = await verifyBatch(batch);
    totalVerified += results.verified;
    totalLikely += results.likely;
    totalInvalid += results.invalid;
    totalErrors += results.errors;
    totalSkipped += results.alreadyVerified;

    console.log(`  Verified: ${results.verified}, Likely: ${results.likely}, Invalid: ${results.invalid}, Errors: ${results.errors}`);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n=== Results ===");
  console.log(`Verified: ${totalVerified}`);
  console.log(`Likely valid: ${totalLikely}`);
  console.log(`Invalid: ${totalInvalid}`);
  console.log(`Already verified (skipped): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(console.error);
