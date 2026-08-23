// =============================================
// Supabase → CockroachDB Migration Script
// =============================================
// Exports all investors from Supabase and imports into CockroachDB.
// Supports two modes:
//   1. Direct PostgreSQL connection (fast — use SUPABASE_DB_PASSWORD)
//   2. REST API fallback (slower but no password needed)
//
// Usage:
//   node scripts/migrate-supabase-to-cockroach.js
//
// Add to .env.local:
//   SUPABASE_DB_PASSWORD=<your Supabase database password>
// =============================================

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

// ── Config ──
const BATCH_SIZE = 10000; // rows per batch
const COCKROACH_BATCH = 5000; // rows per insert batch
const SUPABASE_REST_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

const SUPABASE_HOST = "db.keepilpdaphpkofqgcae.supabase.co";
const SUPABASE_DB_USER = "postgres";
const SUPABASE_DB_NAME = "postgres";

// Shared column mapping (Supabase → CockroachDB)
const INSERT_COLUMNS = [
  "id", "full_name", "first_name", "last_name", "email", "phone",
  "linkedin_url", "twitter_url", "job_title", "bio", "location",
  "country", "city", "investor_type", "current_firm_id",
  "investment_stages", "investment_sectors", "investment_geographies",
  "min_check_size", "max_check_size", "currency", "investment_thesis",
  "portfolio_count", "website_url", "avatar_url",
  "is_active", "is_verified", "do_not_contact",
  "outreach_readiness", "data_quality_score", "fit_score",
  "source", "source_id", "source_provider",
  "merged_into_id", "fit_score_breakdown", "qualification_notes",
  "role_normalized", "created_at", "updated_at",
];

// ── Helpers ──

function parsePgArray(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const inner = val.replace(/^\{/, "").replace(/\}$/, "");
    if (!inner) return "{}";
    // Return as PG array literal: {val1,val2}
    return `{${inner.split(",").map(s => s.trim().replace(/^"|"$/g, "").replace(/"/g, '\\"')).join(",")}}`;
  }
  return null;
}

function transformRow(row) {
  return INSERT_COLUMNS.map((col) => {
    const val = row[col];
    if (val === null || val === undefined) return null;

    // Array columns
    if (["investment_stages", "investment_sectors", "investment_geographies"].includes(col)) {
      return parsePgArray(val);
    }

    // JSON columns
    if (["fit_score_breakdown", "merge_history"].includes(col)) {
      if (typeof val === "string") return val;
      return JSON.stringify(val);
    }

    // Boolean
    if (["is_active", "is_verified", "do_not_contact"].includes(col)) {
      return Boolean(val);
    }

    // Numeric
    if (["min_check_size", "max_check_size"].includes(col)) {
      return val !== null ? Number(val) : null;
    }

    // Integer
    if (["portfolio_count", "data_quality_score", "fit_score"].includes(col)) {
      return val !== null ? Number(val) : null;
    }

    // UUIDs — keep as strings, pg driver handles them
    if (["id", "current_firm_id", "merged_into_id"].includes(col)) {
      return String(val);
    }

    return val;
  });
}

// ── Mode 1: Direct PostgreSQL ──

async function exportViaDirectPG() {
  console.log("🔌 Connecting to Supabase via direct PostgreSQL...\n");

  const client = new Client({
    host: SUPABASE_HOST,
    port: 5432,
    database: SUPABASE_DB_NAME,
    user: SUPABASE_DB_USER,
    password: SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();

  // Count
  const countResult = await client.query("SELECT COUNT(*)::int AS count FROM investors");
  const total = countResult.rows[0].count;
  console.log(`📊 Found ${total.toLocaleString()} investors in Supabase\n`);

  // Export in batches using cursor-like approach
  let offset = 0;
  const allRows = [];

  while (offset < total) {
    const result = await client.query(
      `SELECT ${INSERT_COLUMNS.join(", ")} FROM investors ORDER BY id LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    allRows.push(...result.rows);
    offset += BATCH_SIZE;

    const pct = Math.round((offset / total) * 100);
    process.stdout.write(`\r  📥 Exported ${allRows.length.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`);
  }

  console.log("\n");
  await client.end();

  return { rows: allRows, total };
}

// ── Mode 2: REST API ──

async function exportViaRestAPI() {
  console.log("🌐 Connecting to Supabase via REST API (slower for large datasets)...\n");

  const headers = {
    apikey: SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };

  // Count first
  const countRes = await fetch(
    `${SUPABASE_REST_URL}/rest/v1/investors?select=count`,
    { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } }
  );
  const contentRange = countRes.headers.get("content-range") || "";
  const totalMatch = contentRange.match(/\/(\d+)/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;

  console.log(`📊 Found ${total.toLocaleString()} investors in Supabase\n`);

  const allRows = [];
  let offset = 0;

  while (offset < total) {
    const end = offset + BATCH_SIZE - 1;
    const res = await fetch(
      `${SUPABASE_REST_URL}/rest/v1/investors?select=${INSERT_COLUMNS.join(",")}&order=id&limit=${BATCH_SIZE}&offset=${offset}`,
      { headers }
    );

    if (!res.ok) {
      console.error(`\n  ❌ REST API error at offset ${offset}: ${res.status} ${res.statusText}`);
      // Retry once
      await new Promise((r) => setTimeout(r, 2000));
      const retry = await fetch(
        `${SUPABASE_REST_URL}/rest/v1/investors?select=${INSERT_COLUMNS.join(",")}&order=id&limit=${BATCH_SIZE}&offset=${offset}`,
        { headers }
      );
      if (!retry.ok) {
        console.error(`  ❌ Retry failed. Stopping at ${allRows.length} rows.`);
        break;
      }
      const data = await retry.json();
      allRows.push(...data);
    } else {
      const data = await res.json();
      allRows.push(...data);
    }

    offset += BATCH_SIZE;
    const pct = Math.round((offset / total) * 100);
    process.stdout.write(`\r  📥 Exported ${allRows.length.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`);

    // Rate limit: 200ms between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\n\n");
  return { rows: allRows, total };
}

// ── Import into CockroachDB ──

async function importToCockroachDB(rows) {
  console.log("🗄️  Connecting to CockroachDB...\n");

  const cockroach = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await cockroach.connect();

  // Get existing emails for dedup
  console.log("  🔍 Building dedup index from existing data...");
  const existing = await cockroach.query("SELECT email FROM investors WHERE email IS NOT NULL");
  const existingEmails = new Set(existing.rows.map((r) => r.email?.toLowerCase()).filter(Boolean));
  console.log(`  📋 ${existingEmails.size.toLocaleString()} existing emails for dedup\n`);

  // Also get existing IDs
  const existingIds = await cockroach.query("SELECT id FROM investors");
  const existingIdSet = new Set(existingIds.rows.map((r) => r.id));
  console.log(`  📋 ${existingIdSet.size.toLocaleString()} existing IDs for dedup\n`);

  // Filter out duplicates
  const toInsert = [];
  let skippedEmail = 0;
  let skippedId = 0;
  let skippedEmpty = 0;

  for (const row of rows) {
    // Skip if no full_name
    if (!row.full_name || row.full_name.length < 2) {
      skippedEmpty++;
      continue;
    }

    // Skip if ID already exists
    if (row.id && existingIdSet.has(row.id)) {
      skippedId++;
      continue;
    }

    // Skip if email already exists
    const email = typeof row.email === "string" ? row.email.toLowerCase().trim() : null;
    if (email && existingEmails.has(email)) {
      skippedEmail++;
      continue;
    }

    if (email) existingEmails.add(email);
    if (row.id) existingIdSet.add(row.id);
    toInsert.push(row);
  }

  console.log(`  📊 Dedup results:`);
  console.log(`     Skipped (existing email): ${skippedEmail.toLocaleString()}`);
  console.log(`     Skipped (existing ID):    ${skippedId.toLocaleString()}`);
  console.log(`     Skipped (empty name):     ${skippedEmpty.toLocaleString()}`);
  console.log(`     To insert:                ${toInsert.length.toLocaleString()}\n`);

  if (toInsert.length === 0) {
    console.log("  ✅ No new records to insert — all already exist in CockroachDB.\n");
    await cockroach.end();
    return { inserted: 0, errors: 0 };
  }

  // Batch insert
  let inserted = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < toInsert.length; i += COCKROACH_BATCH) {
    const batch = toInsert.slice(i, i + COCKROACH_BATCH);
    const params = [];
    const placeholders = [];

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const values = transformRow(row);
      const rowPlaceholders = values.map((_, k) => `$${j * INSERT_COLUMNS.length + k + 1}`);
      placeholders.push(`(${rowPlaceholders.join(",")})`);
      params.push(...values);
    }

    try {
      await cockroach.query(
        `INSERT INTO investors (${INSERT_COLUMNS.join(", ")}) VALUES ${placeholders.join(", ")} ON CONFLICT (id) DO NOTHING`,
        params
      );
      inserted += batch.length;
    } catch (err) {
      // If batch fails, try row by row
      let batchErrors = 0;
      for (const row of batch) {
        try {
          const values = transformRow(row);
          const rowPlaceholders = values.map((_, k) => `$${k + 1}`);
          await cockroach.query(
            `INSERT INTO investors (${INSERT_COLUMNS.join(", ")}) VALUES (${rowPlaceholders.join(",")}) ON CONFLICT (id) DO NOTHING`,
            values
          );
          inserted++;
        } catch (rowErr) {
          batchErrors++;
          if (batchErrors <= 3) {
            console.log(`     ⚠️ Row error (${row.full_name}): ${rowErr.message.slice(0, 80)}`);
          }
        }
      }
      errors += batchErrors;
    }

    const pct = Math.round(((i + batch.length) / toInsert.length) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`\r  📤 Inserted ${inserted.toLocaleString()} / ${toInsert.length.toLocaleString()} (${pct}%) — ${elapsed}s`);
  }

  console.log("\n");
  await cockroach.end();

  return { inserted, errors };
}

// ── Verify ──

async function verifyMigration() {
  console.log("🔍 Verifying migration...\n");

  const cockroach = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await cockroach.connect();

  const counts = await cockroach.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::int as with_email,
      COUNT(CASE WHEN linkedin_url IS NOT NULL AND linkedin_url != '' THEN 1 END)::int as with_linkedin,
      COUNT(CASE WHEN is_verified THEN 1 END)::int as verified,
      COUNT(CASE WHEN fit_score >= 80 THEN 1 END)::int as high_fit,
      COUNT(CASE WHEN outreach_readiness = 'ready' THEN 1 END)::int as ready,
      ROUND(AVG(data_quality_score))::int as avg_quality
    FROM investors
  `);

  const byType = await cockroach.query(`
    SELECT investor_type, COUNT(*)::int as count 
    FROM investors GROUP BY investor_type ORDER BY count DESC
  `);

  const bySource = await cockroach.query(`
    SELECT source, COUNT(*)::int as count 
    FROM investors GROUP BY source ORDER BY count DESC LIMIT 10
  `);

  const c = counts.rows[0];
  console.log(`📊 CockroachDB investor counts:`);
  console.log(`   Total:            ${c.total.toLocaleString()}`);
  console.log(`   With email:       ${c.with_email.toLocaleString()}`);
  console.log(`   With LinkedIn:    ${c.with_linkedin.toLocaleString()}`);
  console.log(`   Verified:         ${c.verified.toLocaleString()}`);
  console.log(`   High fit (80+):   ${c.high_fit.toLocaleString()}`);
  console.log(`   Ready:            ${c.ready.toLocaleString()}`);
  console.log(`   Avg quality:      ${c.avg_quality}%\n`);

  console.log(`   By type:`);
  for (const r of byType.rows) {
    console.log(`     ${r.investor_type}: ${r.count.toLocaleString()}`);
  }

  console.log(`\n   By source:`);
  for (const r of bySource.rows) {
    console.log(`     ${r.source || "null"}: ${r.count.toLocaleString()}`);
  }

  await cockroach.end();
}

// ── Main ──

async function main() {
  const startTime = Date.now();

  console.log("═══════════════════════════════════════════════");
  console.log("  Supabase → CockroachDB Investor Migration");
  console.log("═══════════════════════════════════════════════\n");

  let rows, total;

  // Try direct PG first, fall back to REST API
  if (SUPABASE_DB_PASSWORD) {
    try {
      const result = await exportViaDirectPG();
      rows = result.rows;
      total = result.total;
    } catch (err) {
      console.log(`\n  ⚠️ Direct PG connection failed: ${err.message.slice(0, 100)}`);
      console.log(`  🔄 Falling back to REST API...\n`);
      const result = await exportViaRestAPI();
      rows = result.rows;
      total = result.total;
    }
  } else {
    console.log("  ℹ️  No SUPABASE_DB_PASSWORD in .env.local — using REST API (slower)\n");
    console.log("  💡 Add SUPABASE_DB_PASSWORD to .env.local for 10x faster export.\n");
    const result = await exportViaRestAPI();
    rows = result.rows;
    total = result.total;
  }

  if (!rows || rows.length === 0) {
    console.log("  ❌ No data exported from Supabase. Check connectivity.\n");
    process.exit(1);
  }

  // Import to CockroachDB
  const { inserted, errors } = await importToCockroachDB(rows);

  // Verify
  await verifyMigration();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  ✅ Migration complete!`);
  console.log(`  📊 Exported: ${rows.length.toLocaleString()} from Supabase`);
  console.log(`  📊 Inserted: ${inserted.toLocaleString()} into CockroachDB`);
  console.log(`  ❌ Errors:   ${errors.toLocaleString()}`);
  console.log(`  ⏱️  Time:     ${elapsed}s`);
  console.log(`═══════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message || err);
  process.exit(1);
});
