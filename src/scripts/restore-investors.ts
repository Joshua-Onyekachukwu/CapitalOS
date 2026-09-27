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

  // Accept both key formats:
  //   legacy JWT service_role ("eyJ...", ~200+ chars)
  //   modern secret key ("sb_secret_...", ~50 chars)
  const isLegacyJwt = key.startsWith("eyJ") && key.length >= 100;
  const isSecretKey = /^sb_secret_[A-Za-z0-9]{40,}$/.test(key);
  if (!isLegacyJwt && !isSecretKey) {
    console.error(
      "\n✖ SUPABASE_SERVICE_ROLE_KEY missing/malformed in .env.local.\n" +
        "  Expected either the legacy JWT service_role key or a modern sb_secret_ key.\n" +
        "  Get it from: Supabase Dashboard → Project Settings → API → secret keys\n" +
        "  (copy the FULL value — a truncated key will fail the live check below)."
    );
    process.exit(1);
  }

  // Live preflight: reject bad keys before a long import run.
  console.log("Preflight: checking service key against REST API...");
  const probe = await fetch(`${url}/rest/v1/investors?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!probe.ok) {
    console.error(
      `\n✖ Service key rejected by Supabase (HTTP ${probe.status}).\n` +
        "  The URL is reachable but this key does not authenticate.\n" +
        "  Re-copy the full secret key from Dashboard → Project Settings → API."
    );
    process.exit(1);
  }
  console.log("Preflight OK.\n");

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
  const result = await importCsvToSupabase(content, "edgar_restore_2026_09", {
    // Dedup on (source, source_id) via investors_source_unique — EDGAR rows
    // carry no email/linkedin, so re-runs only skip via this conflict target.
    onConflict: "source,source_id",
  });

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
