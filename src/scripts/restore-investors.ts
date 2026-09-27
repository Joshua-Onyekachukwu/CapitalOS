/**
 * Investor data restore — imports the on-disk EDGAR mega backup into the
 * (re)provisioned Supabase project.
 *
 * Usage:
 *   npx tsx src/scripts/restore-investors.ts [csvPath]
 *
 * Default CSV: backups/edgar-mega/mega-all-investors-2026-08-26.csv
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 * pointing at the target project.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import "./load-env"; // side-effect: loads .env.local before anything reads process.env
import { importCsvToSupabase } from "@/lib/services/investor/csv-import";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const ref = (url.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/) || [])[1];

  console.log("=== Capital OS — Investor Restore ===\n");
  console.log(`Target project ref: ${ref || "UNKNOWN (bad NEXT_PUBLIC_SUPABASE_URL)"}`);

  if (!key || key.length < 100) {
    console.error(
      "\n✖ SUPABASE_SERVICE_ROLE_KEY missing/invalid in .env.local.\n" +
        "  Get it from: Supabase Dashboard → Project Settings → API → service_role key\n" +
        "  Then re-run this script."
    );
    process.exit(1);
  }

  const csvPath =
    process.argv[2] ||
    resolve(__dirname, "../../backups/edgar-mega/mega-all-investors-2026-08-26.csv");

  if (!existsSync(csvPath)) {
    console.error(`\n✖ Backup CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const content = readFileSync(csvPath, "utf-8");
  const rows = content.split("\n").filter((l) => l.trim()).length - 1;
  console.log(`Source CSV: ${csvPath}`);
  console.log(`Rows: ${rows.toLocaleString()}\n`);

  console.log("Importing (normalization + dedup handled by the pipeline)...\n");
  const started = Date.now();
  const result = await importCsvToSupabase(content, "edgar_restore_2026_09");

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n=== Restore Results (${elapsed}s) ===`);
  console.log(`  Total rows:   ${result.totalRows.toLocaleString()}`);
  console.log(`  Inserted:     ${result.inserted.toLocaleString()}`);
  console.log(`  Duplicates:   ${result.duplicates.toLocaleString()}`);
  console.log(`  Failed:       ${result.failed.toLocaleString()}`);
  if (result.errors.length > 0) {
    console.log(`  Errors (first 5):`);
    result.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }

  console.log("\nNext: verify counts in Supabase → Table Editor → investors, or run:");
  console.log("  curl \"$NEXT_PUBLIC_SUPABASE_URL/rest/v1/investors?select=id\" -H \"Prefer: count=exact\" -H \"apikey: <anon>\" -I | grep content-range");
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
