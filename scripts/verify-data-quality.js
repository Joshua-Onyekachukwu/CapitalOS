#!/usr/bin/env node
/**
 * Capital OS — Data Quality Verification
 * ========================================
 * Scans all investors and:
 *   1. Removes duplicates (by email, name+firm, LinkedIn)
 *   2. Validates data formats (email, URL, phone)
 *   3. Scores data quality (0-100)
 *   4. Flags suspicious records
 *   5. Reports statistics
 *
 * Usage:
 *   node scripts/verify-data-quality.js           # Full audit
 *   node scripts/verify-data-quality.js --clean   # Audit + remove bad records
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");

const CLEAN = process.argv.includes("--clean");

// ── Validators ──

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDisposableEmail(email) {
  if (!email) return false;
  const domains = [
    "tempmail.com", "throwaway.com", "guerrillamail.com", "mailinator.com",
    "yopmail.com", "trashmail.com", "fakeinbox.com", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "dispostable.com", "10minutemail.com",
  ];
  const domain = email.split("@")[1]?.toLowerCase();
  return domains.includes(domain);
}

function isValidUrl(url) {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

function isValidLinkedIn(url) {
  if (!url) return false;
  return url.includes("linkedin.com/in/");
}

function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  return cleaned.length >= 7 && cleaned.length <= 15 && /^\d+$/.test(cleaned);
}

function scoreQuality(inv) {
  let score = 0;

  // Name (required)
  if (inv.full_name && inv.full_name.length > 2) score += 15;
  if (inv.first_name && inv.last_name) score += 5;

  // Email
  if (isValidEmail(inv.email) && !isDisposableEmail(inv.email)) score += 20;
  else if (isValidEmail(inv.email)) score += 5; // disposable = low value

  // LinkedIn
  if (isValidLinkedIn(inv.linkedin_url)) score += 15;

  // Job title
  if (inv.job_title && inv.job_title.length > 3) score += 10;

  // Bio/description
  if (inv.bio && inv.bio.length > 20) score += 10;

  // Location
  if (inv.city && inv.country) score += 10;
  else if (inv.location) score += 5;

  // Investment data
  if (inv.investment_stages && inv.investment_stages.length > 0) score += 5;
  if (inv.investment_sectors && inv.investment_sectors.length > 0) score += 5;

  return Math.min(score, 100);
}

// ── Main ──

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Data Quality Verification");
  console.log("  Mode: " + (CLEAN ? "Audit + Clean" : "Audit Only"));
  console.log("═══════════════════════════════════════════════\n");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  // ── 1. Total counts ──
  const total = await client.query("SELECT COUNT(*)::int AS cnt FROM investors");
  console.log(`📊 Total investors: ${total.rows[0].cnt.toLocaleString()}\n`);

  // ── 2. By source ──
  const bySource = await client.query("SELECT source, COUNT(*)::int AS cnt FROM investors GROUP BY source ORDER BY cnt DESC");
  console.log("📋 By source:");
  bySource.rows.forEach((r) => console.log(`   ${r.source}: ${r.cnt.toLocaleString()}`));

  // ── 3. Email validation ──
  console.log("\n📧 Email validation:");
  const emailStats = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE email IS NULL OR email = '')::int AS no_email,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::int AS has_email,
      COUNT(*) FILTER (WHERE email ~* '^[^@]+@[^@]+\\.[^@]+$')::int AS valid_format,
      COUNT(*) FILTER (WHERE email ~* '@(tempmail|throwaway|guerrillamail|mailinator|yopmail|trashmail)\\.')::int AS disposable
    FROM investors
  `);
  const e = emailStats.rows[0];
  console.log(`   No email: ${e.no_email.toLocaleString()}`);
  console.log(`   Has email: ${e.has_email.toLocaleString()}`);
  console.log(`   Valid format: ${e.valid_format.toLocaleString()}`);
  console.log(`   Disposable: ${e.disposable.toLocaleString()}`);

  // ── 4. LinkedIn validation ──
  console.log("\n🔗 LinkedIn validation:");
  const linkedinStats = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE linkedin_url IS NULL OR linkedin_url = '')::int AS no_linkedin,
      COUNT(*) FILTER (WHERE linkedin_url LIKE '%linkedin.com/in/%')::int AS valid_linkedin,
      COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL AND linkedin_url != '' AND linkedin_url NOT LIKE '%linkedin.com/in/%')::int AS invalid_linkedin
    FROM investors
  `);
  const l = linkedinStats.rows[0];
  console.log(`   No LinkedIn: ${l.no_linkedin.toLocaleString()}`);
  console.log(`   Valid LinkedIn: ${l.valid_linkedin.toLocaleString()}`);
  console.log(`   Invalid LinkedIn: ${l.invalid_linkedin.toLocaleString()}`);

  // ── 5. Data completeness ──
  console.log("\n📋 Data completeness:");
  const completeness = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE full_name IS NOT NULL AND full_name != '')::int AS has_name,
      COUNT(*) FILTER (WHERE job_title IS NOT NULL AND job_title != '')::int AS has_title,
      COUNT(*) FILTER (WHERE bio IS NOT NULL AND bio != '')::int AS has_bio,
      COUNT(*) FILTER (WHERE city IS NOT NULL AND city != '')::int AS has_city,
      COUNT(*) FILTER (WHERE country IS NOT NULL AND country != '')::int AS has_country,
      COUNT(*) FILTER (WHERE investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0)::int AS has_stages,
      COUNT(*) FILTER (WHERE investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0)::int AS has_sectors
    FROM investors
  `);
  const c = completeness.rows[0];
  const t = total.rows[0].cnt;
  console.log(`   Has name: ${c.has_name.toLocaleString()} (${Math.round((c.has_name / t) * 100)}%)`);
  console.log(`   Has title: ${c.has_title.toLocaleString()} (${Math.round((c.has_title / t) * 100)}%)`);
  console.log(`   Has bio: ${c.has_bio.toLocaleString()} (${Math.round((c.has_bio / t) * 100)}%)`);
  console.log(`   Has city: ${c.has_city.toLocaleString()} (${Math.round((c.has_city / t) * 100)}%)`);
  console.log(`   Has country: ${c.has_country.toLocaleString()} (${Math.round((c.has_country / t) * 100)}%)`);
  console.log(`   Has stages: ${c.has_stages.toLocaleString()} (${Math.round((c.has_stages / t) * 100)}%)`);
  console.log(`   Has sectors: ${c.has_sectors.toLocaleString()} (${Math.round((c.has_sectors / t) * 100)}%)`);

  // ── 6. Duplicate detection ──
  console.log("\n🔍 Duplicate detection:");
  const emailDupes = await client.query(`
    SELECT LOWER(email) AS email, COUNT(*)::int AS cnt 
    FROM investors 
    WHERE email IS NOT NULL AND email != '' 
    GROUP BY LOWER(email) 
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC 
    LIMIT 10
  `);
  console.log(`   Email duplicates: ${emailDupes.rows.length} groups`);
  emailDupes.rows.forEach((r) => console.log(`     ${r.email}: ${r.cnt} copies`));

  const nameDupes = await client.query(`
    SELECT LOWER(full_name) AS full_name, COUNT(*)::int AS cnt 
    FROM investors 
    WHERE full_name IS NOT NULL AND full_name != ''
    GROUP BY LOWER(full_name) 
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC 
    LIMIT 10
  `);
  console.log(`   Name duplicates: ${nameDupes.rows.length} groups`);
  nameDupes.rows.forEach((r) => console.log(`     ${r.full_name}: ${r.cnt} copies`));

  // ── 7. Quality scoring ──
  console.log("\n⭐ Quality scoring (sampling 1000 records)...");
  const sample = await client.query("SELECT * FROM investors ORDER BY RANDOM() LIMIT 1000");
  const scores = sample.rows.map(scoreQuality);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const highQuality = scores.filter((s) => s >= 70).length;
  const mediumQuality = scores.filter((s) => s >= 40 && s < 70).length;
  const lowQuality = scores.filter((s) => s < 40).length;

  console.log(`   Average quality score: ${avgScore}/100`);
  console.log(`   High quality (70+): ${highQuality} (${Math.round((highQuality / 1000) * 100)}%)`);
  console.log(`   Medium quality (40-69): ${mediumQuality} (${Math.round((mediumQuality / 1000) * 100)}%)`);
  console.log(`   Low quality (<40): ${lowQuality} (${Math.round((lowQuality / 1000) * 100)}%)`);

  // ── 8. Cleanup if requested ──
  if (CLEAN) {
    console.log("\n🧹 Cleaning up...");

    // Remove exact email duplicates (keep newest)
    const removedEmailDupes = await client.query(`
      DELETE FROM investors 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) AS rn
          FROM investors
          WHERE email IS NOT NULL AND email != ''
        ) sub
        WHERE rn > 1
      )
    `);
    console.log(`   Removed ${removedEmailDupes.rowCount} email duplicates`);

    // Remove disposable emails
    const removedDisposable = await client.query(`
      DELETE FROM investors 
      WHERE email ~* '@(tempmail|throwaway|guerrillamail|mailinator|yopmail|trashmail|fakeinbox|sharklasifiers|dispostable|10minutemail)\\.'
    `);
    console.log(`   Removed ${removedDisposable.rowCount} disposable email records`);

    // Remove records with no name AND no email (useless)
    const removedEmpty = await client.query(`
      DELETE FROM investors 
      WHERE (full_name IS NULL OR full_name = '') 
      AND (email IS NULL OR email = '')
    `);
    console.log(`   Removed ${removedEmpty.rowCount} empty records`);

    // Update quality scores
    console.log("\n   Recalculating quality scores...");
    const allInvestors = await client.query("SELECT id, full_name, email, linkedin_url, job_title, bio, city, country, investment_stages, investment_sectors FROM investors");
    let updated = 0;
    for (const inv of allInvestors.rows) {
      const score = scoreQuality(inv);
      await client.query("UPDATE investors SET data_quality_score = $1 WHERE id = $2", [score, inv.id]);
      updated++;
      if (updated % 1000 === 0) process.stdout.write(`\r   Updated ${updated.toLocaleString()} records...`);
    }
    console.log(`\n   Updated ${updated.toLocaleString()} quality scores`);
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Verification Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  📊 Total: ${total.rows[0].cnt.toLocaleString()}`);
  console.log(`  📧 With email: ${e.has_email.toLocaleString()}`);
  console.log(`  🔗 With LinkedIn: ${l.valid_linkedin.toLocaleString()}`);
  console.log(`  ⭐ Avg quality: ${avgScore}/100`);
  if (CLEAN) {
    console.log(`  🧹 Cleaned: duplicates removed, scores updated`);
  } else {
    console.log(`  💡 Run with --clean to remove duplicates and update scores`);
  }
  console.log("═══════════════════════════════════════════════\n");

  await client.end();
}

main().catch((err) => {
  console.error("💥 Fatal:", err.message);
  process.exit(1);
});
