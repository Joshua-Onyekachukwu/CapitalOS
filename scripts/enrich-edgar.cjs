#!/usr/bin/env node
/**
 * EDGAR enrichment — deterministic, evidence-backed investor enrichment.
 *
 * Every investor row carries its SEC CIK in source_id. The SEC submissions
 * API (data.sec.gov) authoritatively answers: official registrant name, SIC
 * industry classification, business address (city/state), and the last 13F-HR
 * filing date. Nothing is inferred, guessed, or AI-generated; fields the API
 * does not answer stay null.
 *
 * - Rate limited to ~8 req/s (SEC fair-use: max 10 req/s), resumable via
 *   checkpoint file, logs failures, never rewrites names or scores.
 * - Invalid/missing CIKs and dead registrants are quarantined to
 *   record_status='needs_review' — never deleted (§18 of the data plan).
 *
 * Usage:
 *   node scripts/enrich-edgar.cjs --limit 25     # pilot batch
 *   node scripts/enrich-edgar.cjs --limit 500    # production batches
 *   node scripts/enrich-edgar.cjs --force        # re-fetch already-enriched
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const UA = "CapitalOS-Investor-Intelligence/1.0 (data-quality enrichment; contact: ops@capital-os.local)";
const RATE_MS = 125; // ~8 requests/sec, under SEC's 10 req/s fair-use cap
const CHECKPOINT = path.join("data", "investors", "edgar-progress.json");
const LOG = path.join("data", "investors", `edgar-enrichment-${new Date().toISOString().slice(0, 10)}.log`);

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const LIMIT = parseInt(getArg("--limit", "100"));
const OFFSET = parseInt(getArg("--offset", "0"));
const FORCE = args.includes("--force");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  fs.appendFileSync(LOG, stamped + "\n");
}

async function fetchSubmissions(cik10) {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik10}.json`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (res.status === 404) return { notFound: true };
  if (res.status === 429) throw Object.assign(new Error("rate_limited"), { retryable: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { data: await res.json() };
}

function extractFields(j) {
  // filer identity + classification + address + most recent 13F-HR
  const addr = (j.addresses && (j.addresses.business || j.addresses.mailing)) || {};
  const recent = (j.filings && j.filings.recent) || {};
  let last13F = null;
  if (Array.isArray(recent.form) && Array.isArray(recent.filingDate)) {
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] === "13F-HR") {
        last13F = recent.filingDate[i];
        break;
      }
    }
  }
  return {
    edgarName: j.name || null,
    edgarSicCode: j.sic ? String(j.sic) : null,
    edgarSicDescription: j.sicDescription || null,
    edgarCity: addr.city || null,
    edgarState: addr.stateOrCountryDescription || null,
    edgarLastFilingDate: last13F,
    formerNames: Array.isArray(j.formerNames) ? j.formerNames.map((f) => f.name).filter(Boolean) : [],
  };
}

async function main() {
  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Resumable checkpoint: resume from where the last run stopped.
  let startOffset = OFFSET;
  if (OFFSET === 0 && fs.existsSync(CHECKPOINT)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
      if (cp.done === false && cp.nextOffset) {
        startOffset = cp.nextOffset;
        log(`resuming from checkpoint at offset ${startOffset}`);
      }
    } catch { /* corrupt checkpoint — start clean */ }
  }

  const { data: rows, error } = await sp
    .from("investors")
    .select("id, source_id, full_name, edgar_sic_code, is_active")
    .eq("is_active", true)
    .order("created_at")
    .range(startOffset, startOffset + LIMIT - 1);
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);

  log(`=== run: offset=${startOffset} limit=${LIMIT} rows=${rows?.length || 0} force=${FORCE} ===`);
  let processed = 0, enriched = 0, quarantined = 0, skipped = 0, failed = 0;

  for (const row of rows || []) {
    // Incremental: rows already carrying EDGAR data are skipped unless --force
    if (!FORCE && row.edgar_sic_code != null) {
      skipped++;
      continue;
    }

    const cik = (row.source_id || "").trim();
    if (!/^\d{10}$/.test(cik)) {
      // Garbage quarantine — keep the row, flag it for review (never delete)
      await sp.from("investors").update({ record_status: "needs_review", updated_at: new Date().toISOString() }).eq("id", row.id);
      quarantined++;
      log(`QUARANTINE ${row.id} "${row.full_name}" — invalid CIK "${row.source_id}"`);
      continue;
    }

    try {
      const result = await fetchSubmissions(cik);
      if (result.notFound) {
        await sp.from("investors").update({ record_status: "needs_review", updated_at: new Date().toISOString() }).eq("id", row.id);
        quarantined++;
        log(`QUARANTINE ${row.id} "${row.full_name}" — no SEC record for CIK ${cik}`);
      } else {
        const f = extractFields(result.data);
        // normalize name from the authoritative SEC registrant name
        const { data: norm } = await sp.rpc("normalize_investor_name", { name: f.edgarName || row.full_name });
        const { error: upErr } = await sp
          .from("investors")
          .update({
            edgar_sic_code: f.edgarSicCode,
            edgar_sic_description: f.edgarSicDescription,
            edgar_city: f.edgarCity,
            edgar_state: f.edgarState,
            edgar_last_filing_date: f.edgarLastFilingDate,
            name_normalized: norm || row.full_name.toLowerCase(),
            verification_status: "verified",
            last_verified_at: new Date().toISOString(),
            record_status: "valid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (upErr) throw new Error(`update failed: ${upErr.message}`);
        enriched++;
        if (f.formerNames.length > 0) {
          log(`ENRICHED ${row.id} "${row.full_name}" sic=${f.edgarSicCode} city=${f.edgarCity || "-"} state=${f.edgarState || "-"} last13F=${f.edgarLastFilingDate || "-"} former=[${f.formerNames.slice(0, 3).join("; ")}]`);
        }
      }
    } catch (err) {
      failed++;
      log(`ERROR ${row.id} CIK ${cik}: ${err.message}`);
      if (err.retryable) {
        log("rate limited — cooling down 15s");
        await sleep(15000);
      }
    }

    processed++;
    await sleep(RATE_MS);
  }

  fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: processed < LIMIT, nextOffset: startOffset + (rows?.length || 0), updatedAt: new Date().toISOString() }, null, 2));
  log(`=== done: processed=${processed} enriched=${enriched} quarantined=${quarantined} skipped=${skipped} failed=${failed} ===`);
  console.log(`\nSummary: processed=${processed} enriched=${enriched} quarantined=${quarantined} skipped=${skipped} failed=${failed}`);
  console.log(`Checkpoint: ${CHECKPOINT} | Log: ${LOG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
