#!/usr/bin/env node
/**
 * Investor dataset snapshot — durable archive per data/investors/README.md.
 *
 * Streams the full compact investors table to a dated, gzipped JSONL file in
 * data/investors/snapshots/ and writes a SHA-256 checksum + line count
 * alongside it. Read-only against Supabase; run before any bulk modification.
 *
 * Usage: node scripts/snapshot-investors.cjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { createGzip } = require("zlib");
const { createHash } = require("crypto");
const fs = require("fs");
const path = require("path");

const COLUMNS = [
  "id", "full_name", "name_normalized", "investor_type",
  "investment_stages", "investment_sectors", "investment_geographies",
  "country", "city", "website_url", "linkedin_url", "email",
  "fit_score", "data_quality_score", "outreach_readiness",
  "verification_status", "last_verified_at", "content_hash",
  "source", "source_id", "source_provider", "is_active",
  "created_at", "updated_at",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sp = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const dir = path.join("data", "investors", "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `investors-${date}.jsonl.gz`);
  if (fs.existsSync(file)) {
    console.error(`Refusing to overwrite existing snapshot: ${file}`);
    process.exit(1);
  }

  const hash = createHash("sha256");
  const gzip = createGzip();
  const out = fs.createWriteStream(file);
  gzip.pipe(out);

  const PAGE = 1000;
  let offset = 0;
  let lines = 0;

  for (;;) {
    const { data, error } = await sp
      .from("investors")
      .select(COLUMNS.join(", "))
      .order("created_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Supabase fetch failed at offset ${offset}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const line = JSON.stringify(row) + "\n";
      hash.update(line);
      gzip.write(line);
      lines++;
    }
    offset += PAGE;
    if (offset % 5000 === 0) process.stdout.write(`  ...${offset} rows\n`);
  }
  gzip.end();
  await new Promise((resolve) => out.on("close", resolve));

  const digest = hash.digest("hex");
  const checksumFile = file + ".sha256";
  fs.writeFileSync(checksumFile, `${digest}  ${path.basename(file)}\nlines=${lines}\n`);

  const sizeMB = (fs.statSync(file).size / 1048576).toFixed(2);
  console.log(`Snapshot: ${file}`);
  console.log(`Rows: ${lines}  Size: ${sizeMB} MB  SHA-256: ${digest.slice(0, 16)}…`);
  if (lines === 0) {
    console.error("WARNING: snapshot contains 0 rows — investigate before proceeding.");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
