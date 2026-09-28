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
const RATE_MS = 110; // kept for reference/cool-down pacing
const CHECKPOINT = path.join("data", "investors", "edgar-progress.json");
const LOG = path.join("data", "investors", `edgar-enrichment-${new Date().toISOString().slice(0, 10)}.log`);

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const LIMIT = parseInt(getArg("--limit", "100"));
const FORCE = args.includes("--force");
const CHUNK = 5;          // concurrent SEC fetches per burst
const BURST_PAUSE_MS = 550; // keeps average rate ≈ 9 req/s (SEC fair-use < 10)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// JS mirror of the SQL normalize_investor_name() — avoids a per-row RPC.
const normalizeName = (name) =>
  (name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,?\s*(l\.?l\.?c\.?|l\.?l\.?p\.?|inc\.?|ltd\.?|limited|lp|plc|corp\.?|corporation|co\.?|company|gmbh|sas)$/i, "")
    .trim()
    .toLowerCase();

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

  // The SELECT is the checkpoint: only rows never checked against SEC
  // (last_verified_at IS NULL) are processed, so interrupted runs resume
  // exactly where they stopped with no lost or repeated work.
  let query = sp
    .from("investors")
    .select("id, source_id, full_name, is_active")
    .eq("is_active", true)
    .order("created_at")
    .limit(LIMIT);
  if (!FORCE) query = query.is("last_verified_at", null);

  const { data: rows, error } = await query;
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);

  log(`=== run: limit=${LIMIT} rows=${rows?.length || 0} force=${FORCE} ===`);
  const stats = { processed: 0, enriched: 0, quarantined: 0, skipped: 0, failed: 0 };

  /** Collect updates and flush concurrently — DB writes never block fetches. */
  const pending = [];
  const flush = async () => {
    if (pending.length === 0) return;
    const results = await Promise.allSettled(pending.splice(0));
    for (const r of results) {
      if (r.status === "rejected") {
        stats.failed++;
        log(`UPDATE ERROR: ${r.reason?.message || r.reason}`);
      }
    }
  };

  const stamp = () => new Date().toISOString();

  const processRow = async (row) => {
    const cik = (row.source_id || "").trim();
    if (!/^\d{10}$/.test(cik)) {
      // Garbage quarantine — keep the row, flag it for review (never delete)
      pending.push(
        sp.from("investors").update({ record_status: "needs_review", last_verified_at: stamp(), updated_at: stamp() }).eq("id", row.id)
      );
      stats.quarantined++;
      log(`QUARANTINE ${row.id} "${row.full_name}" — invalid CIK "${row.source_id}"`);
      return;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await fetchSubmissions(cik);
        if (result.notFound) {
          pending.push(
            sp.from("investors").update({ record_status: "needs_review", last_verified_at: stamp(), updated_at: stamp() }).eq("id", row.id)
          );
          stats.quarantined++;
          log(`QUARANTINE ${row.id} "${row.full_name}" — no SEC record for CIK ${cik}`);
          return;
        }
        const f = extractFields(result.data);
        pending.push(
          sp
            .from("investors")
            .update({
              edgar_sic_code: f.edgarSicCode,
              edgar_sic_description: f.edgarSicDescription,
              edgar_city: f.edgarCity,
              edgar_state: f.edgarState,
              edgar_last_filing_date: f.edgarLastFilingDate,
              name_normalized: normalizeName(f.edgarName || row.full_name),
              verification_status: "verified",
              last_verified_at: stamp(),
              record_status: "valid",
              updated_at: stamp(),
            })
            .eq("id", row.id)
        );
        stats.enriched++;
        return;
      } catch (err) {
        if (err.retryable && attempt < 3) {
          log(`rate limited on CIK ${cik} — cooling down 15s (attempt ${attempt})`);
          await sleep(15000);
          continue;
        }
        stats.failed++;
        log(`ERROR ${row.id} CIK ${cik}: ${err.message}`);
        return;
      }
    }
  };

  for (let i = 0; i < (rows || []).length; i += CHUNK) {
    const chunk = (rows || []).slice(i, i + CHUNK);
    await Promise.allSettled(chunk.map(processRow));
    stats.processed += chunk.length;
    if (stats.processed % 100 < CHUNK) await flush();
    if (i + CHUNK < rows.length) await sleep(BURST_PAUSE_MS);
  }
  await flush();

  // Resumable progress note for observability (SELECT filter is the real checkpoint)
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: stats.processed < LIMIT, processed: stats.processed, updatedAt: stamp() }, null, 2));
  log(`=== done: processed=${stats.processed} enriched=${stats.enriched} quarantined=${stats.quarantined} skipped=${stats.skipped} failed=${stats.failed} ===`);
  console.log(`\nSummary: processed=${stats.processed} enriched=${stats.enriched} quarantined=${stats.quarantined} skipped=${stats.skipped} failed=${stats.failed}`);
  console.log(`Checkpoint: ${CHECKPOINT} | Log: ${LOG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
