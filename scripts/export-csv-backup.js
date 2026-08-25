#!/usr/bin/env node
/**
 * Export all investors to CSV for local backup
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKUP_DIR = path.resolve(__dirname, "../data-backups");

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = path.join(BACKUP_DIR, `investors-backup-${timestamp}.csv`);

  console.log("📥 Exporting investors to CSV...");

  let all = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("investors")
      .select("*")
      .range(from, to);
    if (error) { console.error("\n   ❌", error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    page++;
    process.stdout.write(`\r   Fetched ${all.length}...`);
    if (all.length >= 100000) break; // safety
  }

  console.log(`\n   Total: ${all.length} investors`);

  if (all.length === 0) {
    console.log("   No data to export");
    return;
  }

  const columns = Object.keys(all[0]);
  const header = columns.map(c => `"${c}"`).join(",");
  const rows = all.map(inv =>
    columns.map(c => {
      let val = inv[c];
      if (val === null || val === undefined) return '""';
      if (typeof val === "object") val = JSON.stringify(val);
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csv = [header, ...rows].join("\n");
  fs.writeFileSync(filename, csv);

  console.log(`\n✅ Exported ${all.length} investors to ${filename}`);
  console.log(`   File size: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(1)} MB`);

  const jsonFile = path.join(BACKUP_DIR, `investors-backup-${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(all, null, 2));
  console.log(`   JSON backup: ${jsonFile}`);
}

main().catch(e => { console.error("💥", e.message); process.exit(1); });
