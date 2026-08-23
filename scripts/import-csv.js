#!/usr/bin/env node
// =============================================
// Universal CSV → CockroachDB Investor Importer
// =============================================
// Imports investor data from ANY CSV file into CockroachDB.
// Auto-detects column mappings, deduplicates, and batch inserts.
//
// Usage:
//   node scripts/import-csv.js <path-to-csv>
//   node scripts/import-csv.js test-data/apollo-investor-export.csv
//   node scripts/import-csv.js ~/Downloads/apollo-export.csv
//
// Options:
//   --dry-run         Preview without inserting
//   --source=NAME     Set source label (default: csv_import)
//   --batch=SIZE      Batch size (default: 500)
//   --skip-dedup      Skip dedup check (faster but may create dupes)
//   --update-existing Update existing records instead of skipping
// =============================================

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Parse CLI args ──
const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    flags[key] = val === undefined ? true : val;
  } else {
    positional.push(arg);
  }
}

const CSV_PATH = positional[0];
const DRY_RUN = !!flags["dry-run"];
const SOURCE_LABEL = flags.source || "csv_import";
const BATCH_SIZE = parseInt(flags.batch || "500");
const SKIP_DEDUP = !!flags["skip-dedup"];
const UPDATE_EXISTING = !!flags["update-existing"];

if (!CSV_PATH) {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  Universal CSV → CockroachDB Investor Importer       ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  Usage:                                               ║
║    node scripts/import-csv.js <file.csv>              ║
║                                                       ║
║  Options:                                             ║
║    --dry-run         Preview without inserting         ║
║    --source=NAME     Set source label (default: csv)   ║
║    --batch=SIZE      Batch size (default: 500)         ║
║    --skip-dedup      Skip dedup check                  ║
║    --update-existing Update existing records           ║
║                                                       ║
║  Supported CSV formats:                               ║
║    • Apollo.io exports                                ║
║    • Crunchbase exports                               ║
║    • Manual spreadsheets (Google Sheets, Excel)        ║
║    • Any CSV with investor name/email columns          ║
╚═══════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// ── CSV Parser ──

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content) {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 2) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

// ── Column Mapping ──

// Maps various CSV header names → CockroachDB column names
const COLUMN_ALIASES = {
  // Name fields
  full_name: "full_name",
  fullname: "full_name",
  "full name": "full_name",
  name: "full_name",
  "investor name": "full_name",
  "contact name": "full_name",
  first_name: "first_name",
  firstname: "first_name",
  "first name": "full_name", // Will be split later
  last_name: "last_name",
  lastname: "last_name",
  "last name": "full_name", // Will be split later

  // Contact fields
  email: "email",
  "email address": "email",
  "e-mail": "email",
  phone: "phone",
  "phone number": "phone",
  telephone: "phone",
  mobile: "phone",

  // Social links
  linkedin_url: "linkedin_url",
  linkedin: "linkedin_url",
  "linkedin url": "linkedin_url",
  "linkedin profile": "linkedin_url",
  twitter_url: "twitter_url",
  twitter: "twitter_url",

  // Professional
  job_title: "job_title",
  jobtitle: "job_title",
  "job title": "job_title",
  title: "job_title",
  position: "job_title",
  role: "job_title",

  // Bio
  bio: "bio",
  description: "bio",
  summary: "bio",
  about: "bio",

  // Location
  location: "location",
  address: "location",
  country: "country",
  nation: "country",
  city: "city",
  region: "city",

  // Investor type
  investor_type: "investor_type",
  investortype: "investor_type",
  "investor type": "investor_type",
  type: "investor_type",
  "contact type": "investor_type",

  // Firm
  firm_name: "firm_name",
  firmname: "firm_name",
  "firm name": "firm_name",
  company_name: "firm_name",
  companyname: "firm_name",
  "company name": "firm_name",
  organization: "firm_name",
  org: "firm_name",
  employer: "firm_name",

  // Firm details
  firm_domain: "firm_domain",
  firmdomain: "firm_domain",
  "firm domain": "firm_domain",
  company_domain: "firm_domain",
  "company domain": "firm_domain",
  domain: "firm_domain",
  firm_website: "firm_website",
  firmwebsite: "firm_website",
  "firm website": "firm_website",
  company_website: "firm_website",
  website: "firm_website",

  // Investment preferences
  investment_stages: "investment_stages",
  investmentstages: "investment_stages",
  "investment stages": "investment_stages",
  stages: "investment_stages",
  "check sizes": "investment_stages",
  investment_sectors: "investment_sectors",
  investmentsectors: "investment_sectors",
  "investment sectors": "investment_sectors",
  sectors: "investment_sectors",
  industries: "investment_sectors",
  industry: "investment_sectors",
  investment_geographies: "investment_geographies",
  investmentgeographies: "investment_geographies",
  "investment geographies": "investment_geographies",
  geographies: "investment_geographies",
  geos: "investment_geographies",
  regions: "investment_geographies",

  // Check sizes
  min_check_size: "min_check_size",
  minchecksize: "min_check_size",
  "min check size": "min_check_size",
  "minimum check": "min_check_size",
  max_check_size: "max_check_size",
  maxchecksize: "max_check_size",
  "max check size": "max_check_size",
  "maximum check": "max_check_size",

  // Portfolio
  portfolio_count: "portfolio_count",
  portfoliocount: "portfolio_count",
  "portfolio count": "portfolio_count",
  portfolio: "portfolio_count",
  investments: "portfolio_count",

  // Verification
  is_verified: "is_verified",
  isverified: "is_verified",
  verified: "is_verified",

  // Source tracking
  source: "source",
  source_id: "source_id",
  sourceid: "source_id",
  "source id": "source_id",
  apollo_id: "source_id",
  "apollo id": "source_id",

  // Website
  website_url: "website_url",
  websiteurl: "website_url",
  "website url": "website_url",
  website: "website_url",
  url: "website_url",

  // Avatar
  avatar_url: "avatar_url",
  avatarurl: "avatar_url",
  "avatar url": "avatar_url",
  photo: "avatar_url",
  image: "avatar_url",
  headshot: "avatar_url",

  // Additional
  investment_thesis: "investment_thesis",
  investmentthesis: "investment_thesis",
  "investment thesis": "investment_thesis",
  thesis: "investment_thesis",
  currency: "currency",
};

function mapColumns(headers) {
  const mapping = {}; // csvHeader → cockroachColumn
  const unmapped = [];

  for (const header of headers) {
    const normalized = header.toLowerCase().trim().replace(/["']/g, "");
    const target = COLUMN_ALIASES[normalized];

    if (target) {
      mapping[header] = target;
    } else {
      unmapped.push(header);
    }
  }

  return { mapping, unmapped };
}

// ── Data Normalization ──

function normalizeValue(col, value) {
  if (!value || value === "" || value === "null" || value === "undefined") return null;
  const v = value.toString().trim();

  switch (col) {
    // Strings
    case "full_name":
    case "first_name":
    case "last_name":
    case "email":
    case "phone":
    case "linkedin_url":
    case "twitter_url":
    case "job_title":
    case "bio":
    case "location":
    case "country":
    case "city":
    case "firm_name":
    case "firm_domain":
    case "firm_website":
    case "investment_thesis":
    case "website_url":
    case "avatar_url":
    case "source":
    case "source_id":
    case "source_provider":
    case "currency":
      return v || null;

    // Arrays (PostgreSQL format)
    case "investment_stages":
    case "investment_sectors":
    case "investment_geographies":
      return normalizeArray(v);

    // Numbers
    case "min_check_size":
    case "max_check_size":
      return v ? Number(v.replace(/[^0-9.\-]/g, "")) || null : null;
    case "portfolio_count":
      return v ? parseInt(v.replace(/[^0-9\-]/g, "")) || 0 : 0;

    // Booleans
    case "is_verified":
      return ["true", "1", "yes", "verified"].includes(v.toLowerCase());

    default:
      return v || null;
  }
}

function normalizeArray(value) {
  if (!value) return "{}";

  // Already a PG array
  if (value.startsWith("{") && value.endsWith("}")) return value;

  // JSON array
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const arr = JSON.parse(value);
      return `{${arr.map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(",")}}`;
    } catch {
      // Fall through
    }
  }

  // Semicolon, pipe, comma, or slash separated
  const parts = value
    .split(/[;|/,]/)
    .map((s) => s.trim().replace(/["']/g, ""))
    .filter((s) => s.length > 0);

  if (parts.length === 0) return "{}";
  return `{${parts.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
}

function normalizeInvestorType(value) {
  if (!value) return "angel_investor";
  const v = value.toLowerCase().trim().replace(/[\s-]/g, "_");

  const typeMap = {
    venture_capital: "venture_capital",
    vc: "venture_capital",
    "venture capital": "venture_capital",
    angel: "angel_investor",
    angel_investor: "angel_investor",
    "angel investor": "angel_investor",
    accelerator: "accelerator",
    incubator: "accelerator",
    family_office: "family_office",
    "family office": "family_office",
    corporate_venture: "corporate_venture",
    cvc: "corporate_venture",
    "corporate venture": "corporate_venture",
    micro_vc: "micro_vc",
    "micro vc": "micro_vc",
    private_equity: "private_equity",
    "private equity": "private_equity",
    pe: "private_equity",
    impact_investor: "impact_investor",
    "impact investor": "impact_investor",
    strategic_investor: "strategic_investor",
    "strategic investor": "strategic_investor",
  };

  return typeMap[v] || "angel_investor";
}

function generateId() {
  return crypto.randomUUID();
}

// ── Main Import ──

async function main() {
  const startTime = Date.now();

  console.log("═══════════════════════════════════════════════");
  console.log("  CSV → CockroachDB Investor Importer");
  console.log("═══════════════════════════════════════════════\n");

  if (DRY_RUN) {
    console.log("  ⚠️  DRY RUN MODE — no data will be inserted\n");
  }

  // ── Read CSV ──
  const resolvedPath = path.resolve(CSV_PATH);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`  ❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const { headers, rows } = parseCsv(content);

  console.log(`📄 File: ${path.basename(resolvedPath)}`);
  console.log(`   Size: ${(content.length / 1024).toFixed(1)} KB`);
  console.log(`   Rows: ${rows.length.toLocaleString()}`);
  console.log(`   Headers: ${headers.length}`);
  console.log("");

  if (rows.length === 0) {
    console.log("  ❌ No data rows found in CSV.");
    process.exit(1);
  }

  // ── Map columns ──
  const { mapping, unmapped } = mapColumns(headers);

  console.log("📋 Column Mapping:");
  const mapped = Object.entries(mapping);
  for (const [csvCol, dbCol] of mapped) {
    console.log(`   ✓ ${csvCol} → ${dbCol}`);
  }
  if (unmapped.length > 0) {
    console.log(`   ⚠ Unmapped: ${unmapped.join(", ")}`);
  }
  console.log("");

  // Check we have at least a name
  const hasName = mapped.some(([, dbCol]) => dbCol === "full_name");
  const hasFirstName = mapped.some(([, dbCol]) => dbCol === "first_name");
  const hasLastName = mapped.some(([, dbCol]) => dbCol === "last_name");

  if (!hasName && !(hasFirstName && hasLastName)) {
    console.error("  ❌ CSV must have a name column (full_name, first_name+last_name, or name)");
    process.exit(1);
  }

  // ── Connect to CockroachDB ──
  console.log("🗄️  Connecting to CockroachDB...\n");

  const cockroach = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await cockroach.connect();

  // ── Dedup index ──
  let existingEmails = new Set();
  let existingIds = new Set();

  if (!SKIP_DEDUP) {
    console.log("  🔍 Building dedup index...");
    const emailResult = await cockroach.query(
      "SELECT email FROM investors WHERE email IS NOT NULL"
    );
    existingEmails = new Set(
      emailResult.rows.map((r) => r.email?.toLowerCase()).filter(Boolean)
    );

    const idResult = await cockroach.query("SELECT id FROM investors");
    existingIds = new Set(idResult.rows.map((r) => r.id));

    console.log(`  📋 ${existingEmails.size.toLocaleString()} existing emails`);
    console.log(`  📋 ${existingIds.size.toLocaleString()} existing IDs\n`);
  }

  // ── Transform rows ──
  console.log("🔄 Transforming data...\n");

  const INSERT_COLUMNS = [
    "id", "full_name", "first_name", "last_name", "email", "phone",
    "linkedin_url", "twitter_url", "job_title", "bio", "location",
    "country", "city", "investor_type", "investment_stages",
    "investment_sectors", "investment_geographies",
    "min_check_size", "max_check_size", "currency", "investment_thesis",
    "portfolio_count", "website_url", "avatar_url",
    "is_active", "is_verified", "do_not_contact",
    "outreach_readiness", "data_quality_score", "source", "source_id",
    "source_provider", "created_at",
  ];

  const transformed = [];
  let skippedDup = 0;
  let skippedEmpty = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    // Build investor object from mapped columns
    const investor = {};
    for (const [csvCol, dbCol] of mapped) {
      investor[dbCol] = normalizeValue(dbCol, row[csvCol]);
    }

    // Handle split names (if we have first+last but no full_name)
    if (!investor.full_name && investor.first_name && investor.last_name) {
      investor.full_name = `${investor.first_name} ${investor.last_name}`;
    }

    // Handle combined name (if we have full_name but no first/last)
    if (investor.full_name && !investor.first_name) {
      const parts = investor.full_name.split(/\s+/);
      investor.first_name = parts[0] || null;
      investor.last_name = parts.slice(1).join(" ") || null;
    }

    // Validate
    if (!investor.full_name || investor.full_name.length < 2) {
      skippedEmpty++;
      continue;
    }

    // Normalize investor type
    investor.investor_type = normalizeInvestorType(investor.investor_type);

    // Check dedup
    const email = investor.email?.toLowerCase();
    if (email && existingEmails.has(email)) {
      skippedDup++;
      continue;
    }

    // Build final row
    const id = generateId();
    investor.id = id;
    investor.is_active = true;
    investor.do_not_contact = false;
    investor.outreach_readiness = email ? "needs_verification" : "not_ready";
    investor.data_quality_score = computeQualityScore(investor);
    investor.source = SOURCE_LABEL;
    investor.source_provider = SOURCE_LABEL;
    investor.created_at = new Date().toISOString();

    // Add to dedup index
    if (email) existingEmails.add(email);
    existingIds.add(id);

    // Build values array
    const values = INSERT_COLUMNS.map((col) => {
      const val = investor[col];
      if (val === undefined || val === null) return null;
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val;
      return String(val);
    });

    transformed.push({ values, name: investor.full_name, email });

    if (email) skippedDup = skippedDup; // Already counted
  }

  console.log(`  ✅ Transformed: ${transformed.length.toLocaleString()} rows`);
  console.log(`  ⏭️  Skipped (empty name): ${skippedEmpty}`);
  console.log(`  ⏭️  Skipped (duplicate email): ${skippedDup}`);
  console.log("");

  if (transformed.length === 0) {
    console.log("  ❌ No new records to insert.");
    await cockroach.end();
    return;
  }

  // ── Show preview ──
  console.log("📝 Preview (first 5 records):");
  for (const t of transformed.slice(0, 5)) {
    console.log(`   ${t.name}${t.email ? ` <${t.email}>` : ""}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("  ⚠️  DRY RUN — no data inserted. Remove --dry-run to import.");
    await cockroach.end();
    return;
  }

  // ── Batch insert ──
  console.log("📤 Importing to CockroachDB...\n");

  let inserted = 0;
  let errors = 0;
  const insertStart = Date.now();

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const placeholders = [];
    const params = [];

    for (let j = 0; j < batch.length; j++) {
      const rowPlaceholders = INSERT_COLUMNS.map(
        (_, k) => `$${j * INSERT_COLUMNS.length + k + 1}`
      );
      placeholders.push(`(${rowPlaceholders.join(",")})`);
      params.push(...batch[j].values);
    }

    try {
      await cockroach.query(
        `INSERT INTO investors (${INSERT_COLUMNS.join(", ")}) VALUES ${placeholders.join(", ")} ON CONFLICT (id) DO NOTHING`,
        params
      );
      inserted += batch.length;
    } catch (err) {
      // Batch failed — try row by row
      let batchErrors = 0;
      for (const item of batch) {
        try {
          const rowPlaceholders = INSERT_COLUMNS.map((_, k) => `$${k + 1}`);
          await cockroach.query(
            `INSERT INTO investors (${INSERT_COLUMNS.join(", ")}) VALUES (${rowPlaceholders.join(",")}) ON CONFLICT (id) DO NOTHING`,
            item.values
          );
          inserted++;
        } catch (rowErr) {
          batchErrors++;
          if (batchErrors <= 3) {
            console.log(`     ⚠️ ${item.name}: ${rowErr.message.slice(0, 80)}`);
          }
        }
      }
      errors += batchErrors;
    }

    const pct = Math.round(((i + batch.length) / transformed.length) * 100);
    const elapsed = ((Date.now() - insertStart) / 1000).toFixed(0);
    process.stdout.write(
      `\r  📤 ${inserted.toLocaleString()} / ${transformed.length.toLocaleString()} (${pct}%) — ${elapsed}s`
    );
  }

  console.log("\n\n");

  // ── Final verification ──
  console.log("🔍 Verifying import...\n");

  const totalResult = await cockroach.query("SELECT COUNT(*)::int as count FROM investors");
  const sourceResult = await cockroach.query(
    `SELECT COUNT(*)::int as count FROM investors WHERE source = $1`,
    [SOURCE_LABEL]
  );
  const qualityResult = await cockroach.query(
    `SELECT 
      COUNT(*)::int as total,
      COUNT(CASE WHEN email IS NOT NULL THEN 1 END)::int as with_email,
      COUNT(CASE WHEN linkedin_url IS NOT NULL THEN 1 END)::int as with_linkedin,
      ROUND(AVG(data_quality_score))::int as avg_quality
    FROM investors WHERE source = $1`,
    [SOURCE_LABEL]
  );

  const q = qualityResult.rows[0];
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("═══════════════════════════════════════════════");
  console.log("  ✅ Import Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log(`  📊 Inserted:       ${inserted.toLocaleString()}`);
  console.log(`  ❌ Errors:         ${errors.toLocaleString()}`);
  console.log(`  ⏭️  Duplicates:     ${skippedDup.toLocaleString()}`);
  console.log(`  📦 Total in DB:    ${totalResult.rows[0].count.toLocaleString()}`);
  console.log(`  📧 With email:     ${q.with_email.toLocaleString()}`);
  console.log(`  🔗 With LinkedIn:  ${q.with_linkedin.toLocaleString()}`);
  console.log(`  ⭐ Avg quality:    ${q.avg_quality}%`);
  console.log(`  ⏱️  Time:           ${elapsed}s`);
  console.log("═══════════════════════════════════════════════\n");

  await cockroach.end();
}

// ── Quality Score ──

function computeQualityScore(investor) {
  let score = 0;

  if (investor.full_name) score += 15;
  if (investor.email) score += 25;
  if (investor.linkedin_url) score += 15;
  if (investor.job_title) score += 10;
  if (investor.bio && investor.bio.length > 50) score += 10;
  if (investor.firm_name) score += 5;
  if (investor.country) score += 5;
  if (investor.investment_stages && investor.investment_stages !== "{}") score += 5;
  if (investor.investment_sectors && investor.investment_sectors !== "{}") score += 5;
  if (investor.portfolio_count && investor.portfolio_count > 0) score += 5;

  return Math.min(score, 100);
}

// ── Run ──

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message || err);
  process.exit(1);
});
