#!/usr/bin/env node
/**
 * Capital OS — Data Cleaning Pipeline
 * =====================================
 * Deduplicates, validates, and normalizes all investor records.
 *
 * Pipeline Steps:
 * 1. DEDUPLICATION — Merge exact-name duplicates (keep richest record)
 * 2. NAME NORMALIZATION — Title case, remove legal suffixes, fix encoding
 * 3. EMAIL VALIDATION — Check format, flag free providers, remove bad emails
 * 4. INVESTOR TYPE STANDARDIZATION — Normalize type values
 * 5. COUNTRY NORMALIZATION — Standardize country names
 * 6. DATA QUALITY SCORING — Recalculate data quality scores
 *
 * Usage:
 *   node scripts/clean-data.js                  # Full pipeline
 *   node scripts/clean-data.js --dry-run        # Preview changes only
 *   node scripts/clean-data.js --step dedup     # Run single step
 *   node scripts/clean-data.js --limit 1000     # Process first N records
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const LEGAL_SUFFIXES = /\b(LLC|L\.L\.C\.|LP|L\.P\.|INC|INC\.|CORP|CORP\.|LTD|LTD\.|LLP|LLP\.|PLC|PLC\.|AG|GmbH|S\.A\.|S\.A\.S\.|B\.V\.|N\.V\.)\b/gi;
const FUND_WORDS = /\b(FUND[S]?|VENTURE[S]?|CAPITAL|PARTNER[S]?|ADVISOR[S]?|HOLDING[S]?|MANAGEMENT|INVESTMENT[S]?|GROUP|COMPANY|CO\.|ENTERPRISE[S]?)\b/gi;
const FREE_EMAIL_PROVIDERS = /^(gmail|yahoo|hotmail|outlook|aol|protonmail|proton\.me|icloud|me\.com|live\.com|msn\.com|ymail|mail\.com|zoho\.com|gmx\.com)$/i;

const INVESTOR_TYPE_MAP = {
  "venture capital": "venture_capital",
  "vc": "venture_capital",
  "private equity": "private_equity",
  "pe": "private_equity",
  "angel investor": "angel_investor",
  "angel": "angel_investor",
  "family office": "family_office",
  "accelerator": "accelerator",
  "incubator": "accelerator",
  "micro vc": "micro_vc",
  "micro-vc": "micro_vc",
  "fund of funds": "fund_of_funds",
  "corporate investor": "corporate_investor",
  "strategic investor": "strategic_investor",
  "hedge fund": "hedge_fund",
  "mutual fund": "mutual_fund",
  "endowment": "endowment",
  "pension fund": "pension_fund",
  "sovereign wealth": "sovereign_wealth_fund",
};

const COUNTRY_MAP = {
  "us": "United States",
  "usa": "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  "england": "United Kingdom",
  "scotland": "United Kingdom",
  "wales": "United Kingdom",
  "deutschland": "Germany",
  "schweiz": "Switzerland",
  "swiss": "Switzerland",
  "france": "France",
  "république française": "France",
  "japan": "Japan",
  "nippon": "Japan",
  "china": "China",
  "prc": "China",
  "india": "India",
  "bharat": "India",
  "australia": "Australia",
  "aussie": "Australia",
  "brasil": "Brazil",
  "brazil": "Brazil",
  "canada": "Canada",
  "ca": "Canada",
};

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "protonmail.com", "proton.me", "icloud.com", "me.com", "live.com",
  "msn.com", "ymail.com", "mail.com", "zoho.com", "gmx.com",
  "yahoo.co.uk", "hotmail.co.uk", "live.co.uk", "gmail.co.uk",
  "yahoo.co.in", "rediffmail.com",
]);

// ══════════════════════════════════════════════════════════════
// Step 1: Deduplication
// ══════════════════════════════════════════════════════════════

async function deduplicate(dryRun, limit) {
  console.log("\n📋 Step 1: DEDUPLICATION\n");

  // Fetch all investors
  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("investors")
      .select("id, full_name, email, company_website, linkedin_url, phone, company_name, investor_type, source, overall_lead_score, fit_score, data_quality_score")
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
    process.stdout.write(`\r   Fetched ${all.length}...`);
    if (limit && all.length >= limit) { all = all.slice(0, limit); break; }
  }

  console.log(`\n   Total: ${all.length}`);

  // Group by normalized name
  const groups = {};
  all.forEach((inv) => {
    const key = normalizeNameForDedup(inv.full_name);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(inv);
  });

  // Find groups with duplicates
  const dupeGroups = Object.entries(groups).filter(([, v]) => v.length > 1);
  const recordsToRemove = dupeGroups.reduce((sum, [, v]) => sum + v.length - 1, 0);

  console.log(`   Duplicate groups: ${dupeGroups.length}`);
  console.log(`   Records to remove: ${recordsToRemove}`);
  console.log(`   Records after dedup: ${all.length - recordsToRemove}\n`);

  if (dryRun) {
    console.log("   Top 10 duplicate groups:");
    dupeGroups.sort((a, b) => b[1].length - a[1].length).slice(0, 10).forEach(([name, recs]) => {
      const best = pickBestRecord(recs);
      console.log(`     "${name}" (${recs.length}x) → keep ${best.id.substring(0, 8)}... (${best.email || "no email"})`);
    });
    return { removed: recordsToRemove, groups: dupeGroups.length };
  }

  // Merge each duplicate group
  let removed = 0;
  let errors = 0;

  for (let i = 0; i < dupeGroups.length; i += 100) {
    const batch = dupeGroups.slice(i, i + 100);

    for (const [, recs] of batch) {
      const best = pickBestRecord(recs);
      const toDelete = recs.filter((r) => r.id !== best.id).map((r) => r.id);

      if (toDelete.length > 0) {
        // Merge data from deleted records into best
        const merged = mergeRecords(best, recs.filter((r) => r.id !== best.id));

        // Update best record with merged data
        const { error: updateErr } = await supabase
          .from("investors")
          .update(merged)
          .eq("id", best.id);

        if (updateErr) { errors++; continue; }

        // Delete duplicates in batches of 50
        for (let j = 0; j < toDelete.length; j += 50) {
          const delBatch = toDelete.slice(j, j + 50);
          const { error: delErr } = await supabase
            .from("investors")
            .delete()
            .in("id", delBatch);
          if (delErr) errors++;
        }

        removed += toDelete.length;
      }
    }

    process.stdout.write(`\r   Deduplicated ${Math.min(i + 100, dupeGroups.length)}/${dupeGroups.length} groups (${removed} removed)...`);
  }

  console.log(`\n\n   ✅ Removed ${removed} duplicate records (${errors} errors)`);
  return { removed, groups: dupeGroups.length };
}

function normalizeNameForDedup(name) {
  if (!name) return null;
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove all punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

function pickBestRecord(records) {
  // Prefer: has email > has website > has linkedin > highest score
  return records.sort((a, b) => {
    // Email is most valuable
    if (a.email && !b.email) return -1;
    if (!a.email && b.email) return 1;
    // Then website
    if (a.company_website && !b.company_website) return -1;
    if (!a.company_website && b.company_website) return 1;
    // Then LinkedIn
    if (a.linkedin_url && !b.linkedin_url) return -1;
    if (!a.linkedin_url && b.linkedin_url) return 1;
    // Then score
    return (b.overall_lead_score || 0) - (a.overall_lead_score || 0);
  })[0];
}

function mergeRecords(best, duplicates) {
  const merged = {};

  // Merge fields: prefer non-null values from duplicates
  const mergeFields = [
    "email", "company_website", "linkedin_url", "phone", "company_name",
    "job_title", "investor_bio", "investment_thesis", "twitter_url",
    "personal_website", "contact_form_url", "secondary_email",
  ];

  for (const field of mergeFields) {
    if (!best[field] && duplicates.some((d) => d[field])) {
      merged[field] = duplicates.find((d) => d[field])[field];
    }
  }

  // Take highest scores
  const scoreFields = [
    "overall_lead_score", "fit_score", "data_quality_score",
    "investment_activity_score", "funding_capacity_score",
    "industry_match_score", "stage_match_score",
    "geography_match_score", "contactability_score",
  ];

  for (const field of scoreFields) {
    const maxScore = Math.max(best[field] || 0, ...duplicates.map((d) => d[field] || 0));
    if (maxScore > (best[field] || 0)) {
      merged[field] = maxScore;
    }
  }

  merged.updated_at = new Date().toISOString();
  return merged;
}

// ══════════════════════════════════════════════════════════════
// Step 2: Name Normalization
// ══════════════════════════════════════════════════════════════

async function normalizeNames(dryRun, limit) {
  console.log("\n📋 Step 2: NAME NORMALIZATION\n");

  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("investors")
      .select("id, full_name")
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
    process.stdout.write(`\r   Fetched ${all.length}...`);
    if (limit && all.length >= limit) { all = all.slice(0, limit); break; }
  }

  console.log(`\n   Total: ${all.length}`);

  const updates = [];
  let uppercaseCount = 0;
  let suffixCount = 0;
  let specialCount = 0;
  let whitespaceCount = 0;

  for (const inv of all) {
    const original = inv.full_name;
    let cleaned = original;

    // Fix encoding issues
    cleaned = cleaned
      .replace(/[\u2018\u2019\u201A\uFFFD]/g, "'") // Smart quotes
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/\u00A0/g, " ") // Non-breaking space
      .replace(/\u200B/g, ""); // Zero-width space

    // Fix whitespace
    if (/\s{2,}/.test(cleaned) || /^\s|\s$/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+/g, " ").trim();
      whitespaceCount++;
    }

    // ALL CAPS → Title Case (only for short names that look like company names)
    if (cleaned === cleaned.toUpperCase() && cleaned.length > 3 && cleaned.length < 80) {
      cleaned = toTitleCase(cleaned);
      // Restore legal suffixes to uppercase (L.P., LLC, etc.)
      cleaned = cleaned.replace(/\b(L\.p\.|L\.l\.c\.|Inc\.|Corp\.|Ltd\.|Llp)\b/g, (m) => m.toUpperCase());
      uppercaseCount++;
    }

    // Remove excessive legal suffixes for display but keep in separate field
    // Don't remove if it's the ONLY meaningful part of the name
    const withoutSuffix = cleaned.replace(LEGAL_SUFFIXES, "").replace(/[,\s]+$/, "").trim();
    if (withoutSuffix.length > 2 && withoutSuffix !== cleaned) {
      // Keep the original with suffix — it's useful for entity identification
      // But clean up formatting
      cleaned = cleaned
        .replace(/\s*,\s*/g, ", ") // Normalize comma spacing
        .replace(/\.\s*\./g, ".") // Double dots
        .replace(/\s+/g, " ");
      suffixCount++;
    }

    // Fix special characters in names
    if (/[^\w\s,.\-'()&]/.test(cleaned)) {
      cleaned = cleaned
        .replace(/[^\w\s,.\-'()&]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      specialCount++;
    }

    if (cleaned !== original) {
      updates.push({ id: inv.id, full_name: cleaned });
    }
  }

  console.log(`\n   Changes needed:`);
  console.log(`     ALL CAPS → Title Case: ${uppercaseCount}`);
  console.log(`     Whitespace fixes: ${whitespaceCount}`);
  console.log(`     Special char fixes: ${specialCount}`);
  console.log(`     Total updates: ${updates.length}`);

  if (dryRun) {
    console.log("\n   Sample changes:");
    updates.slice(0, 10).forEach((u) => {
      const orig = all.find((a) => a.id === u.id)?.full_name;
      console.log(`     "${orig}" → "${u.full_name}"`);
    });
    return { updated: updates.length };
  }

  // Apply updates in batches
  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        supabase
          .from("investors")
          .update({ full_name: u.full_name, updated_at: new Date().toISOString() })
          .eq("id", u.id)
          .then((r) => { if (!r.error) updated++; })
      )
    );
    process.stdout.write(`\r   Updated ${updated}/${updates.length}...`);
  }

  console.log(`\n\n   ✅ Normalized ${updated} names`);
  return { updated };
}

function toTitleCase(str) {
  const smallWords = /^(a|an|and|as|at|but|by|for|in|nor|of|on|or|so|the|to|up|via|vs)$/i;
  return str
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (smallWords.test(word)) return word;
      // Keep roman numerals uppercase
      if (/^(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|XL|L|XC|C{1,3}|CD|D|CM|M{1,3})$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// ══════════════════════════════════════════════════════════════
// Step 3: Email Validation
// ══════════════════════════════════════════════════════════════

async function validateEmails(dryRun, limit) {
  console.log("\n📋 Step 3: EMAIL VALIDATION\n");

  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("investors")
      .select("id, email, email_verification_status, email_source")
      .not("email", "is", null)
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
    process.stdout.write(`\r   Fetched ${all.length}...`);
    if (limit && all.length >= limit) { all = all.slice(0, limit); break; }
  }

  console.log(`\n   Total with emails: ${all.length}`);

  const updates = [];
  let invalidFormat = 0;
  let freeProvider = 0;
  let needsVerification = 0;
  let alreadyVerified = 0;

  for (const inv of all) {
    const email = inv.email.toLowerCase().trim();
    let newStatus = inv.email_verification_status;
    let newEmail = inv.email;

    // Check format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      invalidFormat++;
      newEmail = null; // Clear invalid email
      newStatus = "invalid";
    }

    // Check free provider
    const domain = email.split("@")[1];
    if (FREE_EMAIL_DOMAINS.has(domain)) {
      freeProvider++;
      if (!newStatus || newStatus === "unknown") {
        newStatus = "risky"; // Free emails are less reliable for outreach
      }
    }

    // Flag unverified inferred emails
    if (inv.email_source === "ai_enrichment" && newStatus !== "verified") {
      needsVerification++;
      newStatus = "inferred";
    }

    if (newStatus === "verified") alreadyVerified++;

    if (newEmail !== inv.email || newStatus !== inv.email_verification_status) {
      updates.push({
        id: inv.id,
        email: newEmail,
        email_verification_status: newStatus,
      });
    }
  }

  console.log(`\n   Email analysis:`);
  console.log(`     Invalid format: ${invalidFormat}`);
  console.log(`     Free email providers: ${freeProvider}`);
  console.log(`     Needs verification: ${needsVerification}`);
  console.log(`     Already verified: ${alreadyVerified}`);
  console.log(`     Updates needed: ${updates.length}`);

  if (dryRun) return { updated: updates.length };

  // Apply updates
  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        supabase
          .from("investors")
          .update({
            email: u.email,
            email_verification_status: u.email_verification_status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", u.id)
          .then((r) => { if (!r.error) updated++; })
      )
    );
    process.stdout.write(`\r   Updated ${updated}/${updates.length}...`);
  }

  console.log(`\n\n   ✅ Validated ${updated} email records`);
  return { updated };
}

// ══════════════════════════════════════════════════════════════
// Step 4: Investor Type Standardization
// ══════════════════════════════════════════════════════════════

async function standardizeTypes(dryRun, limit) {
  console.log("\n📋 Step 4: INVESTOR TYPE STANDARDIZATION\n");

  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("investors")
      .select("id, investor_type, full_name")
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
    process.stdout.write(`\r   Fetched ${all.length}...`);
    if (limit && all.length >= limit) { all = all.slice(0, limit); break; }
  }

  console.log(`\n   Total: ${all.length}`);

  // Show current distribution
  const typeCounts = {};
  all.forEach((inv) => {
    const t = inv.investor_type || "null";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  console.log("   Current types:");
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([t, c]) => console.log(`     ${t}: ${c}`));

  const updates = [];
  let standardized = 0;
  let inferred = 0;

  for (const inv of all) {
    let newType = inv.investor_type;

    // Standardize existing types
    if (newType && INVESTOR_TYPE_MAP[newType.toLowerCase()]) {
      newType = INVESTOR_TYPE_MAP[newType.toLowerCase()];
      standardized++;
    }

    // Infer type from name if missing or generic
    if (!newType || newType === "unknown" || newType === "other") {
      newType = inferInvestorType(inv.full_name);
      if (newType !== inv.investor_type) inferred++;
    }

    // Fix formatting: snake_case
    if (newType && newType.includes(" ")) {
      newType = newType.toLowerCase().replace(/\s+/g, "_");
    }

    if (newType !== inv.investor_type) {
      updates.push({ id: inv.id, investor_type: newType });
    }
  }

  console.log(`\n   Changes:`);
  console.log(`     Standardized: ${standardized}`);
  console.log(`     Inferred from name: ${inferred}`);
  console.log(`     Total updates: ${updates.length}`);

  if (dryRun) return { updated: updates.length };

  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        supabase
          .from("investors")
          .update({ investor_type: u.investor_type, updated_at: new Date().toISOString() })
          .eq("id", u.id)
          .then((r) => { if (!r.error) updated++; })
      )
    );
    process.stdout.write(`\r   Updated ${updated}/${updates.length}...`);
  }

  console.log(`\n\n   ✅ Standardized ${updated} investor types`);
  return { updated };
}

function inferInvestorType(name) {
  if (!name) return "other";
  const lower = name.toLowerCase();

  if (/fund\s*(i{1,3}|iv|v|vi{0,3}|ix|x{1,3})?\b/i.test(lower) && !/mutual|hedge/i.test(lower)) return "fund_of_funds";
  if (/ventures?|venture\s*capital/i.test(lower)) return "venture_capital";
  if (/capital\s*(partners?|management|group|advisors?)?/i.test(lower)) return "private_equity";
  if (/partners?/i.test(lower)) return "private_equity";
  if (/advisors?|advisory/i.test(lower)) return "investment_advisor";
  if (/holdings?/i.test(lower)) return "private_equity";
  if (/management/i.test(lower)) return "asset_manager";
  if (/wealth/i.test(lower)) return "wealth_manager";
  if (/family/i.test(lower)) return "family_office";
  if (/angel/i.test(lower)) return "angel_investor";
  if (/accelerat/i.test(lower)) return "accelerator";
  if (/incubat/i.test(lower)) return "accelerator";
  if (/trust/i.test(lower)) return "trust";
  if (/endowment/i.test(lower)) return "endowment";
  if (/pension/i.test(lower)) return "pension_fund";

  // Default based on EDGAR context
  return "investment_firm";
}

// ══════════════════════════════════════════════════════════════
// Step 5: Recalculate Data Quality Scores
// ══════════════════════════════════════════════════════════════

async function recalcQualityScores(dryRun, limit) {
  console.log("\n📋 Step 5: RECALCULATE DATA QUALITY SCORES\n");

  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("investors")
      .select("id, full_name, job_title, company_name, country, email, linkedin_url, phone, company_website, investment_stages, investment_sectors, number_of_investments, portfolio_companies, investor_bio, investment_thesis, data_quality_score")
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
    process.stdout.write(`\r   Fetched ${all.length}...`);
    if (limit && all.length >= limit) { all = all.slice(0, limit); break; }
  }

  console.log(`\n   Total: ${all.length}`);

  const updates = [];
  let improved = 0;
  let degraded = 0;

  for (const inv of all) {
    let score = 0;
    if (inv.full_name) score += 1;
    if (inv.job_title) score += 1;
    if (inv.company_name) score += 1;
    if (inv.country) score += 1;
    if (inv.investment_stages?.length > 0) score += 1;
    if (inv.investment_sectors?.length > 0) score += 1;
    if ((inv.number_of_investments || 0) > 0) score += 1;
    if (inv.portfolio_companies?.length > 0) score += 1;
    if (inv.investor_bio) score += 1;
    if (inv.investment_thesis) score += 1;
    score = Math.min(score, 10);

    if (score !== (inv.data_quality_score || 0)) {
      updates.push({ id: inv.id, score });
      if (score > (inv.data_quality_score || 0)) improved++;
      else degraded++;
    }
  }

  console.log(`\n   Score changes:`);
  console.log(`     Improved: ${improved}`);
  console.log(`     Degraded: ${degraded}`);
  console.log(`     No change: ${all.length - updates.length}`);
  console.log(`     Total updates: ${updates.length}`);

  if (dryRun) return { updated: updates.length };

  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((u) =>
        supabase
          .from("investors")
          .update({ data_quality_score: u.score, updated_at: new Date().toISOString() })
          .eq("id", u.id)
          .then((r) => { if (!r.error) updated++; })
      )
    );
    process.stdout.write(`\r   Updated ${updated}/${updates.length}...`);
  }

  console.log(`\n\n   ✅ Recalculated ${updated} quality scores`);
  return { updated };
}

// ══════════════════════════════════════════════════════════════
// Main Pipeline
// ══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const stepIdx = args.indexOf("--step");
  const step = stepIdx >= 0 ? args[stepIdx + 1] : null;
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Data Cleaning Pipeline");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(`🗄️  Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  if (dryRun) console.log("⚠️  DRY RUN — no changes will be made");
  if (step) console.log(`🎯 Running step: ${step}`);
  if (limit) console.log(`📊 Limit: ${limit} records`);

  const startTime = Date.now();
  const results = {};

  const steps = step
    ? [step]
    : ["dedup", "names", "emails", "types", "quality"];

  for (const s of steps) {
    switch (s) {
      case "dedup":
        results.dedup = await deduplicate(dryRun, limit);
        break;
      case "names":
        results.names = await normalizeNames(dryRun, limit);
        break;
      case "emails":
        results.emails = await validateEmails(dryRun, limit);
        break;
      case "types":
        results.types = await standardizeTypes(dryRun, limit);
        break;
      case "quality":
        results.quality = await recalcQualityScores(dryRun, limit);
        break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  📊 Pipeline Summary");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (results.dedup) console.log(`   🔄 Deduplication: ${results.dedup.removed} records removed from ${results.dedup.groups} groups`);
  if (results.names) console.log(`   📝 Names normalized: ${results.names.updated}`);
  if (results.emails) console.log(`   📧 Emails validated: ${results.emails.updated}`);
  if (results.types) console.log(`   🏷️  Types standardized: ${results.types.updated}`);
  if (results.quality) console.log(`   📊 Quality scores recalculated: ${results.quality.updated}`);

  console.log(`\n   ⏱️  Total time: ${elapsed}s`);

  // Final database stats
  if (!dryRun) {
    const { count: total } = await supabase.from("investors").select("*", { count: "exact", head: true });
    const { count: withEmail } = await supabase.from("investors").select("*", { count: "exact", head: true }).not("email", "is", null);
    const { count: withType } = await supabase.from("investors").select("*", { count: "exact", head: true }).not("investor_type", "is", null);

    console.log(`\n📊 Final Database:`);
    console.log(`   Total records: ${total}`);
    console.log(`   With emails: ${withEmail} (${((withEmail / total) * 100).toFixed(1)}%)`);
    console.log(`   With investor type: ${withType} (${((withType / total) * 100).toFixed(1)}%)`);
  }
}

main().catch((e) => { console.error("💥", e.message); process.exit(1); });
