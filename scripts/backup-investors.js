#!/usr/bin/env node
/**
 * Comprehensive Investor Backup System
 * =====================================
 * Maintains two local copies:
 *   1. data-backups/raw/       — All scraped investor data (unmodified)
 *   2. data-backups/enriched/  — Clean, enriched, qualified investor data
 *
 * Also creates timestamped snapshots for disaster recovery.
 *
 * Usage:
 *   node scripts/backup-investors.js              # Full backup (both copies)
 *   node scripts/backup-investors.js --raw        # Raw backup only
 *   node scripts/backup-investors.js --enriched   # Enriched backup only
 *   node scripts/backup-investors.js --stats      # Show backup stats only
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKUP_ROOT = path.resolve(__dirname, "../data-backups");
const RAW_DIR = path.join(BACKUP_ROOT, "raw");
const ENRICHED_DIR = path.join(BACKUP_ROOT, "enriched");
const PAGE_SIZE = 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(d) {
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Fetch all investors from Supabase with pagination
 */
async function fetchAllInvestors(filter = null) {
  let all = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from("investors").select("*");

    if (filter) {
      query = query.or(filter);
    }

    const { data, error } = await query
      .range(from, to)
      .order("id", { ascending: true });

    if (error) {
      console.error(`\n   ❌ Page ${page} error:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    all.push(...data);
    page++;
    process.stdout.write(`\r   Fetched ${all.length.toLocaleString()}...`);
  }

  console.log(`\n   Total: ${all.length.toLocaleString()} investors`);
  return all;
}

/**
 * Save investors to JSON + CSV
 */
function saveBackup(investors, dir, prefix) {
  const timestamp = formatDate(new Date());
  const baseName = `${prefix}-${timestamp}`;

  // JSON backup (full data)
  const jsonPath = path.join(dir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(investors, null, 2));
  const jsonSize = formatBytes(fs.statSync(jsonPath).size);
  console.log(`   📄 JSON: ${jsonPath} (${jsonSize})`);

  // CSV backup (for spreadsheets)
  if (investors.length > 0) {
    const columns = Object.keys(investors[0]);
    const header = columns.map((c) => `"${c}"`).join(",");
    const rows = investors.map((inv) =>
      columns
        .map((c) => {
          let val = inv[c];
          if (val === null || val === undefined) return '""';
          if (typeof val === "object") val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const csvPath = path.join(dir, `${baseName}.csv`);
    fs.writeFileSync(csvPath, csv);
    const csvSize = formatBytes(fs.statSync(csvPath).size);
    console.log(`   📊 CSV: ${csvPath} (${csvSize})`);
  }

  // Metadata file
  const metaPath = path.join(dir, `${baseName}.meta.json`);
  const meta = {
    timestamp: new Date().toISOString(),
    count: investors.length,
    columns: investors.length > 0 ? Object.keys(investors[0]) : [],
    stats: computeStats(investors),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`   📋 Meta: ${metaPath}`);

  return { jsonPath, count: investors.length };
}

/**
 * Compute useful stats about the backup
 */
function computeStats(investors) {
  const stats = {
    total: investors.length,
    withEmail: 0,
    withPhone: 0,
    withLinkedIn: 0,
    withFitScore: 0,
    bySource: {},
    byInvestorType: {},
    avgFitScore: 0,
  };

  let fitSum = 0;
  let fitCount = 0;

  for (const inv of investors) {
    if (inv.email) stats.withEmail++;
    if (inv.phone) stats.withPhone++;
    if (inv.linkedin_url) stats.withLinkedIn++;
    if (inv.fit_score) {
      stats.withFitScore++;
      fitSum += inv.fit_score;
      fitCount++;
    }

    const src = inv.source || "unknown";
    stats.bySource[src] = (stats.bySource[src] || 0) + 1;

    const type = inv.investor_type || "unknown";
    stats.byInvestorType[type] = (stats.byInvestorType[type] || 0) + 1;
  }

  stats.avgFitScore = fitCount > 0 ? Math.round(fitSum / fitCount) : 0;
  stats.emailCoverage = stats.total > 0 ? ((stats.withEmail / stats.total) * 100).toFixed(1) + "%" : "0%";

  return stats;
}

/**
 * Show backup directory stats
 */
function showStats() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Local Backup Statistics");
  console.log("═══════════════════════════════════════════════\n");

  for (const [label, dir] of [
    ["Raw (all scraped)", RAW_DIR],
    ["Enriched (clean/qualified)", ENRICHED_DIR],
  ]) {
    console.log(`📁 ${label}: ${dir}`);
    if (!fs.existsSync(dir)) {
      console.log("   (no backups yet)\n");
      continue;
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".meta.json"));
    if (files.length === 0) {
      console.log("   (no backups yet)\n");
      continue;
    }

    // Find latest backup
    files.sort().reverse();
    const latest = files[0];
    const metaFile = latest.replace(".json", ".meta.json");
    const metaPath = path.join(dir, metaFile);

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      console.log(`   Latest: ${latest}`);
      console.log(`   Count: ${meta.count.toLocaleString()}`);
      console.log(`   Email coverage: ${meta.stats.emailCoverage}`);
      console.log(`   With fit score: ${meta.stats.withFitScore.toLocaleString()}`);
      console.log(`   Sources:`);
      for (const [src, cnt] of Object.entries(meta.stats.bySource).sort((a, b) => b[1] - a[1])) {
        console.log(`     ${src}: ${cnt.toLocaleString()}`);
      }
    } else {
      const size = formatBytes(fs.statSync(path.join(dir, latest)).size);
      console.log(`   Latest: ${latest} (${size})`);
    }

    console.log(`   Total backup files: ${files.length}\n`);
  }

  // Also show EDGAR and FishTank backups
  for (const [label, dir] of [
    ["EDGAR XML data", path.join(BACKUP_ROOT, "edgar-xml")],
    ["FishTank VC data", path.join(BACKUP_ROOT, "fishtank")],
  ]) {
    console.log(`📁 ${label}: ${dir}`);
    if (!fs.existsSync(dir)) {
      console.log("   (no data yet)\n");
      continue;
    }
    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      console.log("   (no data yet)\n");
      continue;
    }
    let totalSize = 0;
    for (const f of files) {
      const s = fs.statSync(path.join(dir, f)).size;
      totalSize += s;
    }
    console.log(`   Files: ${files.length}`);
    console.log(`   Total size: ${formatBytes(totalSize)}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doRaw = !args.includes("--enriched");
  const doEnriched = !args.includes("--raw");

  if (args.includes("--stats")) {
    showStats();
    return;
  }

  ensureDir(RAW_DIR);
  ensureDir(ENRICHED_DIR);

  console.log("═══════════════════════════════════════════════");
  console.log("  Investor Backup System");
  console.log("═══════════════════════════════════════════════\n");

  if (doRaw) {
    console.log("📦 BACKUP 1: Raw (all scraped data)\n");
    console.log("   Fetching all investors from Supabase...");
    const allInvestors = await fetchAllInvestors();
    if (allInvestors.length > 0) {
      saveBackup(allInvestors, RAW_DIR, "raw-investors");
    } else {
      console.log("   ⚠️  No investors found");
    }
    console.log();
  }

  if (doEnriched) {
    console.log("📦 BACKUP 2: Enriched (clean/qualified data)\n");
    console.log("   Fetching enriched investors (has email OR fit_score > 0)...");
    const enriched = await fetchAllInvestors(
      "email.not.is.null,fit_score.gt.0"
    );
    if (enriched.length > 0) {
      saveBackup(enriched, ENRICHED_DIR, "enriched-investors");
    } else {
      console.log("   ⚠️  No enriched investors found");
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════");
  console.log("  ✅ Backup Complete!");
  console.log("═══════════════════════════════════════════════\n");

  showStats();
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
