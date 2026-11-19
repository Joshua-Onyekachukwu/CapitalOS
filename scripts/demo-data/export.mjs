#!/usr/bin/env node
/**
 * Export the *organic* Supabase corpus to CSV.
 *
 * Purpose: the database is the only copy of the real investor data. Before any
 * cleanup or demo reload, take a portable snapshot that can be restored without
 * Supabase and committed to git.
 *
 * Synthetic demo rows (is_synthetic = true) are deliberately excluded: this is
 * the backup of real records, not the demo dataset.
 *
 * Usage: node scripts/demo-data/export.mjs [outDir]
 *   outDir defaults to exports/supabase-backup-<YYYY-MM-DD>
 */

import dotenv from "dotenv";
import pg from "pg";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, appendFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const outDir =
  process.argv[2] ||
  `exports/supabase-backup-${new Date().toISOString().slice(0, 10)}`;

// Columns that must never go in a CSV: vectors, tsvectors and raw JSONB blobs
// are large and cannot be restored by a plain insert anyway.
const SKIP_COLUMNS = new Set([
  "thesis_embedding",
  "search_vector",
  "iapd_row",
  "embedding_updated_at",
]);

const TABLES = [
  { name: "investors", where: "is_synthetic = false", order: "id" },
  { name: "investor_firms", where: "is_synthetic = false", order: "id" },
  { name: "investor_people", where: "true", order: "id" },
  { name: "company_profiles", where: "true", order: "id" },
  { name: "waitlist", where: "true", order: "id" },
];

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  let text;
  if (value instanceof Date) text = value.toISOString();
  else if (Buffer.isBuffer(value)) text = value.toString("base64");
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 0,
  connectionTimeoutMillis: 20000,
});
client.on("error", (err) => console.log(`socket error: ${err.message.slice(0, 80)}`));
await client.connect();

await mkdir(outDir, { recursive: true });

const manifest = [];
for (const table of TABLES) {
  const exists = await client.query(
    `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
    [table.name]
  );
  if (exists.rowCount === 0) {
    console.log(`${table.name}: table does not exist, skipped`);
    continue;
  }

  const colRes = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name=$1 order by ordinal_position`,
    [table.name]
  );
  const cols = colRes.rows
    .map((r) => r.column_name)
    .filter((c) => !SKIP_COLUMNS.has(c));

  const file = path.join(outDir, `${table.name}.csv`);
  await writeFile(file, `${cols.join(",")}\n`);

  const countRes = await client.query(
    `select count(*)::int n from public.${table.name} where ${table.where}`
  );
  const expected = countRes.rows[0].n;

  const PAGE = 2000;
  let written = 0;
  let lastId = null;
  const started = Date.now();

  for (;;) {
    const params = [];
    let keyset = "";
    if (lastId !== null) {
      params.push(lastId);
      keyset = `and id > $${params.length}`;
    }
    params.push(PAGE);
    const { rows } = await client.query(
      `select ${cols.join(",")} from public.${table.name}
       where ${table.where} ${keyset}
       order by ${table.order}
       limit $${params.length}`,
      params
    );
    if (rows.length === 0) break;
    const body = rows
      .map((row) => cols.map((c) => csvCell(row[c])).join(","))
      .join("\n");
    await appendFile(file, `${body}\n`);
    written += rows.length;
    lastId = rows[rows.length - 1][table.order];
    process.stdout.write(`\r${table.name}: ${written}/${expected}`);
    if (rows.length < PAGE) break;
  }

  const bytes = (await stat(file)).size;
  const hash = crypto
    .createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  manifest.push({
    table: table.name,
    rows: written,
    expected,
    bytes,
    sha256: hash,
    file: path.basename(file),
  });
  console.log(
    `\r${table.name}: ${written}/${expected} rows, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${(
      (Date.now() - started) / 1000
    ).toFixed(1)}s`
  );
  if (written !== expected) {
    console.log(`  WARNING: expected ${expected} rows, wrote ${written}`);
  }
}

const size = await client.query(
  `select pg_size_pretty(pg_database_size(current_database())) as db`
);
await client.end();

const lines = [
  `# Supabase organic data export`,
  ``,
  `Exported: ${new Date().toISOString()}`,
  `Database size at export: ${size.rows[0].db}`,
  `Synthetic demo rows are excluded (${"is_synthetic = true"}); this is the real corpus only.`,
  ``,
  `| table | rows | size | sha256 |`,
  `| --- | --- | --- | --- |`,
  ...manifest.map(
    (m) =>
      `| ${m.table} | ${m.rows} | ${(m.bytes / 1024 / 1024).toFixed(1)} MB | \`${m.sha256.slice(0, 16)}…\` |`
  ),
  ``,
  `Vectors, tsvectors and raw IAPD JSON are not included; re-embed after restore.`,
];
await writeFile(path.join(outDir, "MANIFEST.md"), lines.join("\n"));

console.log(`\nmanifest: ${path.join(outDir, "MANIFEST.md")}`);
