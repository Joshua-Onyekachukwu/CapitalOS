// Backfill cheque size / thesis from raw_records (IAPD payloads already held).
//
// Rules that make this honest rather than inventive:
//  - Only copies values that exist verbatim in the source payload.
//  - Never overwrites a value the investor row already has.
//  - Never derives a cheque size from holdings, fund size, or anything else.
//  - Writes provenance so the origin of every value is traceable.
//
// Usage:
//   node scripts/backfill-investor-fields.cjs --dry-run
//   node scripts/backfill-investor-fields.cjs --limit 500

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const maxRecords = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

function loadEnv() {
  // The project keeps secrets in .env.local (or the shell); .env is optional.
  const env = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      if (env[key]) continue; // real environment wins
      env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const sp = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const THESIS_KEYS = ["investment_thesis", "thesis", "strategy_summary", "investment_strategy"];

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function text(value) {
  return typeof value === "string" && value.trim().length >= 20 ? value.trim() : null;
}

(async () => {
  let offset = 0;
  const pageSize = 500;
  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  const errors = [];

  while (scanned < maxRecords) {
    const { data: rows, error } = await sp
      .from("raw_records")
      .select("id, matched_investor_id, raw_data")
      .not("matched_investor_id", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("read failed:", error.message);
      break;
    }
    if (!rows || rows.length === 0) break;
    offset += rows.length;
    scanned += rows.length;

    for (const row of rows) {
      const raw = row.raw_data || {};
      const minCheque = num(raw.min_check_usd);
      const maxCheque = num(raw.max_check_usd);
      const thesis = THESIS_KEYS.map((k) => text(raw[k])).find(Boolean) || null;

      if (!minCheque && !maxCheque && !thesis) continue;
      candidates++;

      // Read the current row so existing values are never overwritten.
      const { data: investor, error: invErr } = await sp
        .from("investors")
        .select("id, min_check_size, max_check_size, investment_thesis, provenance, thesis_source")
        .eq("id", row.matched_investor_id)
        .maybeSingle();

      if (invErr || !investor) {
        errors.push(`${row.id}: ${invErr?.message || "investor missing"}`);
        continue;
      }

      const patch = {};
      if (minCheque && (investor.min_check_size === null || Number(investor.min_check_size) === 0)) {
        patch.min_check_size = minCheque;
      }
      if (maxCheque && (investor.max_check_size === null || Number(investor.max_check_size) === 0)) {
        patch.max_check_size = maxCheque;
      }
      if (thesis && !investor.investment_thesis) {
        patch.investment_thesis = thesis;
        patch.thesis_source = "iapd_raw_record";
      }

      if (Object.keys(patch).length === 0) continue;

      patch.provenance = {
        ...(investor.provenance || {}),
        backfill: {
          source: "raw_records.raw_data",
          source_record_id: row.id,
          fields: Object.keys(patch).filter((k) => k !== "provenance"),
          at: new Date().toISOString(),
        },
      };

      if (dryRun) {
        updated++;
        continue;
      }

      const { error: writeError } = await sp
        .from("investors")
        .update(patch)
        .eq("id", investor.id);
      if (writeError) errors.push(`${investor.id}: ${writeError.message}`);
      else updated++;
    }
  }

  console.log(
    JSON.stringify(
      { dryRun, scanned, candidates, wouldUpdateOrUpdated: updated, errors: errors.slice(0, 10) },
      null,
      2
    )
  );
})();
