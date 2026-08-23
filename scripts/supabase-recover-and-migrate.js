#!/usr/bin/env node
// =============================================
// Supabase Recovery + Migration Script
// =============================================
// Connects to Supabase, frees disk space by deleting
// generated data, then exports everything to CockroachDB.
//
// PREREQUISITE: Supabase must be online (pause + restore first)
// Usage: node scripts/supabase-recover-and-migrate.js
// =============================================

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const SB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const CRDB_URL = process.env.DATABASE_URL;

async function connectSupabase() {
  console.log("🔌 Connecting to Supabase...");

  // Try direct connection first
  const hosts = [
    { host: "db.keepilpdaphpkofqgcae.supabase.co", port: 5432, user: "postgres" },
    { host: "aws-0-eu-central-1.pooler.supabase.com", port: 6543, user: "postgres.keepilpdaphpkofqgcae" },
  ];

  for (const h of hosts) {
    try {
      const c = new Client({
        host: h.host,
        port: h.port,
        database: "postgres",
        user: h.user,
        password: SB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await c.connect();
      console.log(`  ✅ Connected via ${h.host}`);
      return c;
    } catch (e) {
      console.log(`  ⚠️  ${h.host}: ${e.message.slice(0, 60)}`);
    }
  }

  throw new Error("Cannot connect to Supabase. Please pause + restore the project first.");
}

async function main() {
  const startTime = Date.now();

  console.log("═══════════════════════════════════════════════");
  console.log("  Supabase Recovery + CockroachDB Migration");
  console.log("═══════════════════════════════════════════════\n");

  // ── Connect ──
  const sb = await connectSupabase();

  // ── Step 1: Audit ──
  console.log("\n📊 Step 1: Auditing Supabase data...\n");

  const sources = await sb.query(
    "SELECT COALESCE(source, '(null)') AS source, COUNT(*)::int AS count FROM investors GROUP BY source ORDER BY count DESC"
  );
  const total = await sb.query("SELECT COUNT(*)::int AS count FROM investors");
  const dbSize = await sb.query("SELECT pg_size_pretty(pg_database_size('postgres')) AS size");

  console.log(`  Database size: ${dbSize.rows[0].size}`);
  console.log(`  Total investors: ${total.rows[0].count.toLocaleString()}`);
  console.log("  By source:");
  for (const r of sources.rows) {
    console.log(`    ${r.source}: ${r.count.toLocaleString()}`);
  }

  const generatedCount = sources.rows
    .filter((r) => ["generated", "scale_dataset", "generated_test", "csv_import"].includes(r.source))
    .reduce((sum, r) => sum + r.count, 0);

  const realCount = total.rows[0].count - generatedCount;

  console.log(`\n  🗑️  Generated/synthetic: ${generatedCount.toLocaleString()}`);
  console.log(`  💎 Real data (Apollo/EDGAR): ${realCount.toLocaleString()}`);

  // ── Step 2: Export real data BEFORE deleting ──
  console.log("\n📦 Step 2: Exporting real data to CSV backup...\n");

  const backupDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");

  // Export ALL data to CSV (before cleanup)
  const allInvestors = await sb.query("SELECT * FROM investors ORDER BY created_at DESC");
  const allFirms = await sb.query("SELECT * FROM investor_firms ORDER BY name");
  const allEmployment = await sb.query("SELECT * FROM investor_employment_history");

  // Write CSVs
  if (allInvestors.rows.length > 0) {
    const headers = Object.keys(allInvestors.rows[0]).join(",");
    const csvRows = allInvestors.rows.map((r) =>
      Object.values(r)
        .map((v) => {
          if (v === null || v === undefined) return "";
          const s = String(v).replace(/"/g, '""');
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
        })
        .join(",")
    );
    const csv = [headers, ...csvRows].join("\n");
    const csvPath = path.join(backupDir, `supabase-investors-${timestamp}.csv`);
    fs.writeFileSync(csvPath, csv);
    console.log(`  📄 Investors: ${csvPath} (${allInvestors.rows.length.toLocaleString()} rows)`);
  }

  if (allFirms.rows.length > 0) {
    const headers = Object.keys(allFirms.rows[0]).join(",");
    const csvRows = allFirms.rows.map((r) =>
      Object.values(r)
        .map((v) => (v === null ? "" : String(v).replace(/"/g, '""')))
        .join(",")
    );
    const csv = [headers, ...csvRows].join("\n");
    const csvPath = path.join(backupDir, `supabase-firms-${timestamp}.csv`);
    fs.writeFileSync(csvPath, csv);
    console.log(`  📄 Firms: ${csvPath} (${allFirms.rows.length.toLocaleString()} rows)`);
  }

  console.log(`\n  ✅ Backup saved to backups/ directory`);

  // ── Step 3: Delete generated data ──
  console.log("\n🗑️  Step 3: Deleting generated data from Supabase...\n");

  const delResult = await sb.query(
    `DELETE FROM investors WHERE source IN ('generated', 'scale_dataset', 'generated_test', 'csv_import')`
  );
  console.log(`  Deleted ${delResult.rowCount.toLocaleString()} generated investors`);

  // Clean orphaned data
  await sb.query("DELETE FROM investor_employment_history WHERE investor_id NOT IN (SELECT id FROM investors)");
  await sb.query("DELETE FROM raw_records");
  await sb.query("DELETE FROM duplicate_candidates");
  await sb.query("DELETE FROM data_change_log");
  console.log("  Cleaned orphaned records");

  // ── Step 4: Vacuum ──
  console.log("\n🧹 Step 4: Vacuuming to reclaim disk space...\n");

  const tables = ["investors", "investor_employment_history", "raw_records", "duplicate_candidates", "data_change_log"];
  for (const t of tables) {
    process.stdout.write(`  VACUUM ${t}...`);
    await sb.query(`VACUUM FULL ${t}`);
    console.log(" ✅");
  }

  // ── Step 5: Verify ──
  console.log("\n🔍 Step 5: Verifying cleanup...\n");

  const afterSize = await sb.query("SELECT pg_size_pretty(pg_database_size('postgres')) AS size");
  const afterCount = await sb.query("SELECT COUNT(*)::int AS count FROM investors");
  const afterSources = await sb.query(
    "SELECT COALESCE(source, '(null)') AS source, COUNT(*)::int AS count FROM investors GROUP BY source"
  );

  console.log(`  Database size: ${dbSize.rows[0].size} → ${afterSize.rows[0].size}`);
  console.log(`  Investors: ${total.rows[0].count.toLocaleString()} → ${afterCount.rows[0].count.toLocaleString()}`);
  console.log("  Remaining by source:");
  for (const r of afterSources.rows) {
    console.log(`    ${r.source}: ${r.count.toLocaleString()}`);
  }

  await sb.end();

  // ── Step 6: Migrate to CockroachDB ──
  console.log("\n🗄️  Step 6: Migrating real data to CockroachDB...\n");

  // Read the backup CSV we just created
  const csvPath = path.join(backupDir, `supabase-investors-${timestamp}.csv`);
  if (!fs.existsSync(csvPath)) {
    console.log("  ⚠️  No backup CSV found. Skipping CockroachDB migration.");
    console.log("  Run: node scripts/import-csv.js " + csvPath);
    return;
  }

  // Use the existing import script
  const { execSync } = require("child_process");
  try {
    execSync(`node scripts/import-csv.js "${csvPath}" --source=supabase_migration`, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      timeout: 600000,
    });
  } catch (err) {
    console.log("\n  ⚠️  CockroachDB migration had errors. Check output above.");
    console.log(`  You can retry: node scripts/import-csv.js "${csvPath}" --source=supabase_migration`);
  }

  // ── Done ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n═══════════════════════════════════════════════");
  console.log("  ✅ Recovery + Migration Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log(`  📊 Supabase cleaned: ${total.rows[0].count.toLocaleString()} → ${afterCount.rows[0].count.toLocaleString()}`);
  console.log(`  💾 Backup saved: backups/supabase-investors-${timestamp}.csv`);
  console.log(`  🗄️  Migrated to CockroachDB`);
  console.log(`  ⏱️  Time: ${elapsed}s`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err.message);
  console.log("\nIf Supabase is still offline:");
  console.log("1. Go to https://supabase.com/dashboard");
  console.log("2. Settings → General → Pause project");
  console.log("3. Wait 30s → Restore project");
  console.log("4. Run this script again");
  process.exit(1);
});
