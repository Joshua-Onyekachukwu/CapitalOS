// ============================================================
// SEC Form D pooled-fund acquirer
// ============================================================
// Source: SEC EDGAR full-text search (EFTS), public and permitted under the
// SEC's fair-access policy: one identifying User-Agent, <=10 requests/second.
//
// Why Form D "Item 3C": a Form D is filed by an issuer raising securities. Item
// 3C is checked by pooled investment funds — the authoritative signal that the
// filer is a fund vehicle rather than an operating startup. We still treat the
// result as a *candidate*: a fund vehicle is not yet a verified investor, has no
// stage/sector/cheque evidence, and is never written to `investors` here.
//
// Pipeline:
//   EFTS → raw JSONL (exactly what SEC returned)
//        → classify (3C / name-evidence)
//        → normalize name, parse location
//        → dedupe against `investors` and within the batch
//        → insert into `investor_candidates` (idempotent on provider+source_id)
//        → run report (JSON) in investor-intelligence/data/reports/
//
// Usage:
//   node investor-intelligence/scripts/acquire/sec-formd-pooled.cjs \
//     --start 2026-07-01 --end 2026-09-30 [--max 20000] [--dry-run]
//
// Resumable: completed weekly windows are recorded in the run's checkpoint
// file, so an interrupted run continues instead of refetching everything.

require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { query, close } = require("../../../scripts/db.cjs");

const UA = process.env.SEC_USER_AGENT || "CapitalOS Research contact@capital-os.com";
const EFTS = "https://efts.sec.gov/LATEST/search-index";
const PAGE = 100;
const REQUEST_GAP_MS = 140;
const ROOT = path.resolve(__dirname, "..", "..");

// ── args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def = "") => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const startArg = arg("start", iso(new Date(today.getTime() - 90 * 86400000)));
const endArg = arg("end", iso(today));
const maxFilings = Number(arg("max", "20000"));
const dryRun = flag("dry-run");

const runId = `formd-${startArg}-${endArg}-${Date.now()}`;
const rawDir = path.join(ROOT, "data", "raw", "sec-formd", runId);
const processedDir = path.join(ROOT, "data", "processed", "sec-formd", runId);
const reportDir = path.join(ROOT, "data", "reports");
const checkpointPath = path.join(ROOT, "data", "checkpoints", `${runId}.json`);

for (const dir of [rawDir, processedDir, reportDir, path.dirname(checkpointPath)]) {
  fs.mkdirSync(dir, { recursive: true });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── checkpoint ──────────────────────────────────────────────────────────
const checkpoint = fs.existsSync(checkpointPath)
  ? JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
  : { doneWindows: [], fetched: 0, startedAt: new Date().toISOString() };
const saveCheckpoint = () => fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

// ── helpers ─────────────────────────────────────────────────────────────
function weeksBetween(start, end) {
  const windows = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const from = new Date(cursor);
    const to = new Date(cursor.getTime() + 6 * 86400000);
    if (to > last) to.setTime(last.getTime());
    windows.push({ start: iso(from), end: iso(to) });
    cursor = new Date(to.getTime() + 86400000);
  }
  return windows;
}

async function efts(params, attempt = 1) {
  const url = `${EFTS}?${new URLSearchParams(params).toString()}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw err;
    await sleep(500 * attempt * attempt);
    return efts(params, attempt + 1);
  }
}

const LEGAL_SUFFIXES = new Set([
  "llc", "l l c", "lp", "l p", "llp", "inc", "incorporated", "corp", "corporation",
  "ltd", "limited", "co", "company", "plc", "sa", "ag", "gmbh", "bv", "nv", "pte",
]);

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !LEGAL_SUFFIXES.has(w))
    .join(" ")
    .trim();
}

/** Item 3C means the issuer is a pooled investment fund. */
function isPooledFund(items) {
  const list = Array.isArray(items) ? items : [];
  return list.some((it) => /^3C(\.|$)/i.test(String(it)));
}

const FUND_NAME_RE =
  /(?:\bfund\b|\bventures?\b|\bcapital\b|\bpartners?\b|\bequity\b|\bangel\b|\bsyndicate\b|\baccelerator\b|\binvestments?\b|\bholdings?\b|\bvc\b)/i;

function classify(items, name) {
  if (isPooledFund(items)) {
    return {
      kind: "fund_vehicle",
      reason: "Form D item 3C (pooled investment fund)",
      confidence: 0.95,
    };
  }
  if (FUND_NAME_RE.test(name)) {
    return {
      kind: "fund_vehicle",
      reason: "Name indicates a fund/firm; no 3C item on this filing",
      confidence: 0.5,
    };
  }
  return { kind: "unknown", reason: "Issuer with no fund evidence on this filing", confidence: 0.15 };
}

/**
 * Preliminary qualification. Deliberately low: a Form D proves a fund vehicle
 * exists and is raising, not that it invests at pre-seed/seed, in a compatible
 * geography, at a usable cheque size. Missing dimensions score zero and the
 * record is stamped 'unverified' until enrichment supplies evidence.
 */
function prelimScore(candidate, filedAt) {
  let score = 0;
  const breakdown = {};
  breakdown.recency = 5; // filed within the window
  score += 5;
  if (candidate.country === "United States") {
    breakdown.geo = 7.5; // neutral: US is in scope, but founder fit is unknown
    score += 7.5;
  }
  breakdown.completeness = 3.75; // name, location, source
  score += 3.75;
  return { score: Math.round(score), breakdown };
}

function parseLocation(bizLocations) {
  const first = Array.isArray(bizLocations) ? bizLocations[0] : null;
  if (!first || typeof first !== "string") return { city: null, region: null };
  const [city, region] = first.split(",").map((s) => s.trim());
  return { city: city || null, region: region || null };
}

function filingUrl(cik, adsh) {
  if (!cik || !adsh) return null;
  const cikNum = String(Number(cik));
  const adshClean = adsh.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${adshClean}/${adsh}-index.htm`;
}

function stripCik(displayName) {
  return String(displayName || "").replace(/\s*\(CIK\s*\d+\)\s*$/i, "").trim();
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`run ${runId} · ${startArg} → ${endArg} · max ${maxFilings}${dryRun ? " · DRY RUN" : ""}`);

  // Existing corpus names for dedupe (one read, kept in memory).
  const existing = await query("select id, full_name from public.investors");
  const byNormalized = new Map();
  for (const row of existing) {
    const key = normalizeName(row.full_name || "");
    if (key && !byNormalized.has(key)) byNormalized.set(key, row.id);
  }

  // Names already staged by earlier batches. A fund files Form D every quarter,
  // so without this the same manager would be inserted once per filing under a
  // different accession number.
  const stagedRows = await query("select normalized_name from public.investor_candidates");
  const alreadyStagedNames = new Set(stagedRows.map((r) => r.normalized_name));

  console.log(
    `corpus loaded: ${existing.length} investors (${byNormalized.size} normalized keys); ` +
      `${alreadyStagedNames.size} candidate names already staged`
  );

  const windows = weeksBetween(startArg, endArg);
  const rawParts = [];
  let fetched = checkpoint.fetched || 0;
  let pooled = 0;
  let nameOnly = 0;
  let duplicates = 0;
  let alreadyStaged = 0;
  let inserted = 0;
  const stateCounts = {};
  const candidates = [];
  const seen = new Set();

  for (const win of windows) {
    if (checkpoint.doneWindows.includes(`${win.start}:${win.end}`)) continue;
    if (fetched >= maxFilings) break;

    let from = 0;
    let total = Infinity;
    const rawFile = path.join(rawDir, `part-${win.start}_${win.end}.jsonl`);
    const lines = [];

    while (from < total && fetched < maxFilings) {
      const data = await efts({
        q: "",
        forms: "D",
        dateRange: "custom",
        startdt: win.start,
        enddt: win.end,
        from: String(from),
      });
      const hits = data?.hits?.hits || [];
      total = data?.hits?.total?.value ?? 0;
      if (hits.length === 0) break;

      for (const hit of hits) {
        const src = hit._source || {};
        lines.push(JSON.stringify({ window: win, source: src }));
        fetched += 1;

        const name = stripCik((src.display_names || [])[0]);
        if (!name) continue;

        const cls = classify(src.items, name);
        if (cls.kind !== "fund_vehicle") continue;
        if (cls.confidence >= 0.9) pooled += 1;
        else nameOnly += 1;

        const cik = (src.ciks || [])[0] || null;
        const adsh = src.adsh || null;
        const key = normalizeName(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (alreadyStagedNames.has(key)) {
          alreadyStaged += 1;
          continue;
        }

        const loc = parseLocation(src.biz_locations);
        const { score, breakdown } = prelimScore({ country: "United States" }, src.file_date);
        const isDuplicate = byNormalized.has(key);

        candidates.push({
          full_name: name,
          normalized_name: key,
          entity_kind: "fund_vehicle",
          investor_type: null,
          country: "United States",
          region: loc.region,
          city: loc.city,
          website: null,
          linkedin_url: null,
          source_provider: "sec_edgar_formd",
          source_id: adsh || `${cik}-${src.file_date}-${key}`,
          source_url: filingUrl(cik, adsh),
          source_published_at: src.file_date || null,
          classification_reason: cls.reason,
          confidence: cls.confidence * 100,
          qualification_score: isDuplicate ? null : score,
          qualification_tier: isDuplicate ? null : "D (unverified)",
          status: isDuplicate ? "duplicate" : "new",
          duplicate_of: isDuplicate ? byNormalized.get(key) : null,
          raw: { source: src, score_breakdown: breakdown },
        });

        if (isDuplicate) duplicates += 1;
        if (src.biz_states?.[0]) {
          stateCounts[src.biz_states[0]] = (stateCounts[src.biz_states[0]] || 0) + 1;
        }
      }
      from += PAGE;
      await sleep(REQUEST_GAP_MS);
    }

    if (!dryRun) {
      fs.writeFileSync(rawFile, lines.join("\n"));
      rawParts.push(rawFile);
    }
    checkpoint.doneWindows.push(`${win.start}:${win.end}`);
    checkpoint.fetched = fetched;
    saveCheckpoint();
    console.log(`  ${win.start}..${win.end}: ${lines.length} filings (running total ${fetched})`);
  }

  // Write processed candidates.
  const processedFile = path.join(processedDir, "candidates.jsonl");
  fs.writeFileSync(processedFile, candidates.map((c) => JSON.stringify(c)).join("\n"));

  // Insert new candidates in chunks; duplicates stay recorded but linked.
  if (!dryRun && candidates.length > 0) {
    const chunks = [];
    for (let i = 0; i < candidates.length; i += 200) chunks.push(candidates.slice(i, i + 200));
    for (const chunk of chunks) {
      const cols = [
        "full_name", "normalized_name", "entity_kind", "investor_type", "country", "region",
        "city", "website", "linkedin_url", "source_provider", "source_id", "source_url",
        "source_published_at", "classification_reason", "confidence", "qualification_score",
        "qualification_tier", "status", "duplicate_of", "raw",
      ];
      const values = [];
      const params = [];
      chunk.forEach((c, idx) => {
        const base = idx * cols.length;
        values.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(",")})`);
        params.push(
          c.full_name, c.normalized_name, c.entity_kind, c.investor_type, c.country, c.region,
          c.city, c.website, c.linkedin_url, c.source_provider, c.source_id, c.source_url,
          c.source_published_at, c.classification_reason, c.confidence, c.qualification_score,
          c.qualification_tier, c.status, c.duplicate_of, JSON.stringify(c.raw)
        );
      });
      const sql = `
        insert into public.investor_candidates (${cols.join(",")})
        values ${values.join(",")}
        on conflict (source_provider, source_id) do nothing
        returning status`;
      const rows = await query(sql, params);
      inserted += rows.filter((r) => r.status === "new").length;
    }
  }

  const byState = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const report = {
    runId,
    source: "SEC EDGAR full-text search (EFTS), Form D",
    window: { start: startArg, end: endArg },
    filingsScanned: fetched,
    fundCandidates: candidates.length,
    pooledFundFilings: pooled,
    nameOnlyCandidates: nameOnly,
    duplicatesInCorpus: duplicates,
    alreadyStagedFromEarlierRuns: alreadyStaged,
    newCandidates: candidates.length - duplicates,
    inserted,
    dryRun,
    topStates: Object.fromEntries(byState),
    candidateFile: processedFile,
    rawParts,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(reportDir, `${runId}.json`), JSON.stringify(report, null, 2));

  console.log("\n── batch report ──");
  console.log(JSON.stringify(report, null, 2));
  await close();
}

main().catch(async (err) => {
  console.error("acquisition failed:", err.message);
  try {
    await close();
  } catch {}
  process.exit(1);
});
