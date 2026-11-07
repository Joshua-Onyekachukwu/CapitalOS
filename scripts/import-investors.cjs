#!/usr/bin/env node
/**
 * Import investors into the corpus from a CSV or an EDGAR Form D export.
 *
 * What this script will not do:
 *   • invent a value. A field is written only when the source row contains it.
 *   • overwrite existing data. A matched investor is filled only where the
 *     column is currently empty, and every write records its origin.
 *   • treat a Form D issuer as an investor. A Form D filing is a company
 *     raising money; only pooled investment fund issuers (the fund itself) are
 *     imported, and only when the fund type maps to a known investor type.
 *
 * Usage:
 *   node scripts/import-investors.cjs --csv=path/to/investors.csv --dry-run
 *   node scripts/import-investors.cjs --csv=path/to/investors.csv
 *   node scripts/import-investors.cjs --formd=path/to/form-d.json --dry-run
 *
 * Options:
 *   --dry-run        Print the full plan and write nothing
 *   --limit=N        Process at most N source rows
 *   --batch=N        Insert batch size (default 200)
 *   --source=NAME    Override the source label
 */

require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// ── Args ────────────────────────────────────────────────────────────────────

function flag(name) {
  const hit = process.argv
    .slice(2)
    .find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const [, value] = hit.split("=");
  return value === undefined ? true : value;
}

const DRY_RUN = !!flag("dry-run");
const CSV_PATH = flag("csv");
const FORMD_PATH = flag("formd");
const LIMIT = flag("limit") ? Number(flag("limit")) : Infinity;
const BATCH = flag("batch") ? Number(flag("batch")) : 200;
const SOURCE_OVERRIDE = flag("source");

if (require.main === module && !CSV_PATH && !FORMD_PATH) {
  console.error(
    [
      "usage: node scripts/import-investors.cjs --csv=<file> [--dry-run] [--limit=N]",
      "       node scripts/import-investors.cjs --formd=<file> [--dry-run] [--limit=N]",
    ].join("\n")
  );
  process.exit(2);
}

const MODE = FORMD_PATH ? "form_d" : "csv";
// Null when the module is required by tests rather than run as a script.
const FILE = FORMD_PATH || CSV_PATH ? path.resolve(FORMD_PATH || CSV_PATH) : null;

// The client is created lazily so the pure functions below can be required by
// tests without credentials or a live database.
let _sp = null;
function db() {
  if (!_sp) {
    _sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _sp;
}

// ── Column aliases ──────────────────────────────────────────────────────────
// Every alias is normalised (lowercase, alphanumerics only) before matching, so
// "Min Check Size", "min_check_size" and "MIN CHECK" are the same key.

const ALIASES = {
  full_name: ["firm name", "company name", "entity name", "issuer name", "organization", "organisation", "investor name", "full name", "name"],
  first_name: ["first name", "given name"],
  last_name: ["last name", "family name", "surname"],
  email: ["email address", "email", "e-mail", "contact email"],
  phone: ["business phone", "phone number", "telephone", "phone"],
  website_url: ["company website", "firm website", "website url", "website", "web site"],
  linkedin_url: ["linkedin profile", "linkedin url", "linkedin"],
  twitter_url: ["twitter", "x handle"],
  job_title: ["job title", "position", "title", "role"],
  bio: ["description", "about", "summary", "bio"],
  location: ["street address", "full address", "address", "location"],
  city: ["business city", "mainaddr city", "city"],
  country: ["state or country", "country", "jurisdiction"],
  investor_type: ["investor type", "fund type", "investment fund type", "industry group type", "type"],
  investment_stages: ["investment stages", "investment stage", "stages", "stage"],
  investment_sectors: ["investment sectors", "industries", "industry", "sectors", "sector"],
  investment_geographies: ["investment geographies", "geography", "regions"],
  min_check_size: ["min check size", "minimum check size", "min cheque size", "min check", "min cheque", "min_check_usd"],
  max_check_size: ["max check size", "maximum check size", "max cheque size", "max check", "max cheque", "max_check_usd"],
  investment_thesis: ["investment thesis", "strategy summary", "thesis", "strategy"],
  portfolio_count: ["portfolio count", "number of investments", "portfolio"],
  source_id: ["source id", "accession number", "crd number", "iapd firm id", "adsh", "cik", "filing number"],
  filing_url: ["filing url", "source url", "proof url", "filing"],
};

const NORMALISED_ALIASES = Object.entries(ALIASES).flatMap(([column, aliases]) =>
  aliases.map((alias) => [normaliseKey(alias), column])
);

function normaliseKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/** RFC-4180-ish CSV parser: handles quoted commas, escaped quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

/** Flattens a nested object to normalisedKey → scalar, for EDGAR JSON shapes. */
function flatten(value, out = {}, prefix = "") {
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    const flatKey = normaliseKey(`${prefix}${key}`);
    if (Array.isArray(child)) {
      if (child.length > 0 && typeof child[0] !== "object") {
        out[flatKey] = child.join("; ");
      } else if (child.length > 0 && typeof child[0] === "object") {
        flatten(child[0], out, `${flatKey}.`);
      }
    } else if (child && typeof child === "object") {
      flatten(child, out, `${flatKey}.`);
    } else {
      out[flatKey] = child;
    }
  }
  return out;
}

function pick(flat, column) {
  const wanted = new Set(
    NORMALISED_ALIASES.filter(([, target]) => target === column).map(([alias]) => alias)
  );
  for (const key of Object.keys(flat)) {
    const tail = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
    if (!wanted.has(tail) && !wanted.has(key)) continue;
    const value = flat[key];
    if (value === null || value === undefined) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return null;
}

function readCsvFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const [headerRow, ...dataRows] = parseCsv(text);
  const headers = headerRow.map((h) => h.trim());
  const rows = dataRows.map((values) => {
    const flat = {};
    headers.forEach((header, index) => {
      flat[normaliseKey(header)] = values[index] ?? "";
    });
    return flat;
  });
  return { headers, rows };
}

function readFormDFile(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(raw)
    ? raw
    : raw.filings ?? raw.records ?? raw.data?.rows ?? raw.data?.filings ?? (raw.data ? [raw.data] : [raw]);
  if (!Array.isArray(list)) throw new Error("Form D file is not an array of filings");
  return {
    headers: Object.keys(flatten(list[0] || {})),
    rows: list.map((entry) => flatten(entry)),
  };
}

// ── Normalisation ───────────────────────────────────────────────────────────

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function parseMoney(value) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .toLowerCase()
    .replace(/usd|dollars|\$|£|€/g, "")
    .trim();
  if (!text) return null;
  const match = text.match(/([\d,.]+)\s*([kmb])?/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const multiplier = match[2] === "k" ? 1e3 : match[2] === "m" ? 1e6 : match[2] === "b" ? 1e9 : 1;
  return Math.round(amount * multiplier);
}

/** "$250k - $1M" → [250000, 1000000]; "500000" → [500000, null]. */
function parseChequeRange(value) {
  const text = clean(value);
  if (!text) return [null, null];
  const parts = text.split(/\s*(?:-|–|—|\bto\b)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    const low = parseMoney(parts[0]);
    const high = parseMoney(parts[1]);
    if (low || high) return [low, high];
  }
  return [parseMoney(text), null];
}

function parseList(value) {
  const text = clean(value);
  if (!text) return [];
  return [
    ...new Set(
      text
        .split(/[;|,/]|\band\b/i)
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
}

const TYPE_HINTS = [
  [/fund of funds|\bfof\b/i, "fund_of_funds"],
  [/micro[\s-]?vc/i, "micro_vc"],
  [/corporate ventur|\bcvc\b/i, "corporate_venture"],
  [/family office/i, "family_office"],
  [/venture studio/i, "venture_studio"],
  [/venture capital|venture fund|\bvc\b/i, "venture_capital"],
  [/private equity|buyout|growth equity/i, "private_equity"],
  [/accelerator/i, "accelerator"],
  [/incubator/i, "incubator"],
  [/angel (group|syndicate)|syndicate/i, "angel_syndicate"],
  [/angel/i, "angel_investor"],
  [/impact/i, "impact_investor"],
  [/strategic/i, "strategic_investor"],
  [/government|sovereign/i, "government_fund"],
  [/university|endowment/i, "university_fund"],
  [/debt|mezzanine/i, "debt_investor"],
];

function mapInvestorType(value) {
  // Sources write venture_capital, venture-capital and Venture Capital.
  const text = clean(value)?.replace(/[_-]+/g, " ");
  if (!text) return null;
  for (const [pattern, label] of TYPE_HINTS) if (pattern.test(text)) return label;
  return null;
}

function nameKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The corpus stores a stricter normalisation than the raw name: "NetEase, Inc.
 * (NTES, NETTF)" is stored as "netease". Matching on the raw name alone would
 * re-import every firm whose legal suffix or ticker differs, so the importer
 * also compares a suffix-stripped key.
 */
function looseNameKey(value) {
  const stripped = String(value ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(inc|incorporated|llc|l l c|ltd|limited|corp|corporation|co|company|lp|l p|llp|plc|gmbh|sa|s a|ag|nv|bv|pty|pte|holdings)\b/gi,
      " "
    );
  return nameKey(stripped);
}

function qualityScore(row) {
  let score = 0;
  if (row.full_name) score += 15;
  if (row.email) score += 25;
  if (row.linkedin_url) score += 15;
  if (row.job_title) score += 10;
  if (row.bio && row.bio.length > 50) score += 10;
  if (row.country) score += 5;
  if (row.website_url) score += 5;
  if (row.investment_stages?.length) score += 5;
  if (row.investment_sectors?.length) score += 5;
  if (row.min_check_size || row.max_check_size) score += 5;
  return Math.min(score, 100);
}

/**
 * EDGAR puts the useful classification in investmentFundType and a generic
 * "Pooled Investment Fund" in industryGroupType. Reading whichever alias comes
 * first in the flattened object would classify every venture fund as an
 * untyped pooled fund, so the fund type is preferred explicitly.
 */
function formDFundType(flat) {
  for (const key of Object.keys(flat)) {
    if (!key.includes("investmentfundtype")) continue;
    const value = clean(flat[key]);
    if (value) return value;
  }
  return null;
}

function isPooledFund(flat, fundType = formDFundType(flat)) {
  const industry = String(pick(flat, "investor_type") || "");
  // "Other" is EDGAR's placeholder, not a fund classification.
  const meaningful = String(fundType ?? "")
    .replace(/\bother\b/gi, "")
    .trim();
  return /pooled investment fund/i.test(industry) || meaningful.length > 0;
}

function buildRecord(flat, source, rowNumber, fileName, mode = MODE) {
  let fullName = clean(pick(flat, "full_name"));
  const first = clean(pick(flat, "first_name"));
  const last = clean(pick(flat, "last_name"));
  if (!fullName && first && last) fullName = `${first} ${last}`;
  if (!fullName || fullName.length < 2) return { skip: "invalid" };

  let typeRaw = clean(pick(flat, "investor_type"));
  if (mode === "form_d") {
    const fundType = formDFundType(flat);
    if (!isPooledFund(flat, fundType)) return { skip: "not_pooled_fund" };
    typeRaw = fundType || typeRaw;
  }

  const mappedType = mapInvestorType(typeRaw);
  if (typeRaw && !mappedType) return { skip: `unmapped_type:${typeRaw.slice(0, 40)}` };

  const email = clean(pick(flat, "email"))?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { skip: "invalid_email" };

  const [minCheque, maxCheque] = parseChequeRange(
    pick(flat, "min_check_size") ?? pick(flat, "max_check_size")
  );
  const maxOnly = parseMoney(pick(flat, "max_check_size"));

  const providedId = clean(pick(flat, "source_id"));
  const sourceId = providedId
    ? String(providedId).slice(0, 120)
    : crypto
        .createHash("sha1")
        .update(`${source}|${nameKey(fullName)}|${clean(pick(flat, "city")) || ""}`)
        .digest("hex")
        .slice(0, 24);

  const row = {
    full_name: fullName,
    first_name: first,
    last_name: last,
    email,
    phone: clean(pick(flat, "phone")),
    website_url: clean(pick(flat, "website_url")),
    linkedin_url: clean(pick(flat, "linkedin_url")),
    twitter_url: clean(pick(flat, "twitter_url")),
    job_title: clean(pick(flat, "job_title")),
    bio: clean(pick(flat, "bio")),
    location: clean(pick(flat, "location")),
    city: clean(pick(flat, "city")),
    country: clean(pick(flat, "country")),
    investor_type: mappedType || "angel_investor",
    investment_stages: parseList(pick(flat, "investment_stages")),
    investment_sectors: parseList(pick(flat, "investment_sectors")),
    investment_geographies: parseList(pick(flat, "investment_geographies")),
    min_check_size: minCheque,
    max_check_size: maxOnly ?? maxCheque,
    investment_thesis: clean(pick(flat, "investment_thesis")),
    portfolio_count: Number(parseMoney(pick(flat, "portfolio_count")) || 0),
    source,
    source_id: sourceId,
    source_provider: source,
  };

  // Only columns the source actually carried belong in the provenance trail;
  // defaults (angel_investor, 0, []) are the script's choices, not evidence.
  const providedFields = Object.keys(ALIASES).filter(
    (column) => pick(flat, column) !== null && column !== "source_id"
  );

  const provenance = {
    importer: "scripts/import-investors.cjs",
    imports: [
      {
        kind: mode,
        source,
        file: fileName,
        row: rowNumber,
        at: new Date().toISOString(),
        fields: providedFields,
        investor_type_inferred: !mappedType,
        filing_url: clean(pick(flat, "filing_url")),
      },
    ],
  };

  return { record: row, provenance };
}

// ── Existing corpus index ───────────────────────────────────────────────────

async function loadIndex() {
  const byEmail = new Map();
  const byName = new Map();
  const bySourceKey = new Map();
  let from = 0;

  for (;;) {
    const { data, error } = await db()
      .from("investors")
      .select("id, email, full_name, name_normalized, source, source_id")
      .range(from, from + 999);
    if (error) throw new Error(`could not read the corpus: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.email) byEmail.set(String(row.email).toLowerCase(), row);
      // Index the stored normalisation *and* two local variants. Matching only
      // one form silently duplicates firms whose legal suffix differs.
      if (row.name_normalized) {
        byName.set(`s:${nameKey(row.name_normalized)}`, row);
        const looseStored = looseNameKey(row.name_normalized);
        if (looseStored) byName.set(`l:${looseStored}`, row);
      }
      const own = nameKey(row.full_name || "");
      if (own) byName.set(`s:${own}`, row);
      const loose = looseNameKey(row.full_name || "");
      if (loose) byName.set(`l:${loose}`, row);
      if (row.source && row.source_id) bySourceKey.set(`${row.source}::${row.source_id}`, row);
    }

    from += data.length;
    if (data.length < 1000) break;
  }

  return { byEmail, byName, bySourceKey };
}

// ── Filling an existing record ──────────────────────────────────────────────

const FILLABLE = [
  "email",
  "phone",
  "website_url",
  "linkedin_url",
  "twitter_url",
  "job_title",
  "bio",
  "location",
  "city",
  "country",
  "investment_stages",
  "investment_sectors",
  "investment_geographies",
  "min_check_size",
  "max_check_size",
  "investment_thesis",
];

function isEmpty(value) {
  return (
    value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
  );
}

async function fillExisting(existingId, record, provenanceEntry) {
  const { data: current, error } = await db()
    .from("investors")
    .select(`id, provenance, ${FILLABLE.join(", ")}`)
    .eq("id", existingId)
    .maybeSingle();

  if (error) return { changed: false, error: error.message };
  if (!current) return { changed: false, error: "investor disappeared" };

  const patch = {};
  for (const field of FILLABLE) {
    if (isEmpty(current[field]) && !isEmpty(record[field])) patch[field] = record[field];
  }
  if (Object.keys(patch).length === 0) return { changed: false, fields: [] };

  const imports = Array.isArray(current.provenance?.imports) ? current.provenance.imports : [];
  patch.provenance = {
    ...(current.provenance || {}),
    imports: [...imports, provenanceEntry].slice(-20),
  };

  if (DRY_RUN) return { changed: true, fields: Object.keys(patch).filter((k) => k !== "provenance") };

  const { error: writeError } = await db().from("investors").update(patch).eq("id", existingId);
  return writeError
    ? { changed: false, error: writeError.message }
    : { changed: true, fields: Object.keys(patch).filter((k) => k !== "provenance") };
}

// ── Insert ──────────────────────────────────────────────────────────────────

async function insertRows(rows) {
  let inserted = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await db().from("investors").insert(batch);

    if (!error) {
      inserted += batch.length;
      continue;
    }

    // One bad row must not hide the rest of the batch.
    for (const row of batch) {
      const { error: rowError } = await db().from("investors").insert(row);
      if (rowError) errors.push(`${row.full_name}: ${rowError.message}`);
      else inserted++;
    }
  }

  return { inserted, errors };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`file not found: ${FILE}`);
    process.exit(1);
  }

  const source = SOURCE_OVERRIDE || (MODE === "form_d" ? "form_d" : "csv_import");
  const fileName = path.basename(FILE);

  const { headers, rows } = MODE === "csv" ? readCsvFile(FILE) : readFormDFile(FILE);

  const knownHeaders = new Set(
    NORMALISED_ALIASES.filter(([alias]) => new Set(headers.map(normaliseKey)).has(alias)).map(
      ([, column]) => column
    )
  );

  const report = {
    mode: MODE,
    file: fileName,
    dryRun: DRY_RUN,
    source,
    rowsRead: 0,
    columnsMatched: [...knownHeaders].sort(),
    wouldInsert: 0,
    wouldFill: 0,
    skipped: {},
    samples: [],
    errors: [],
  };

  const skip = (reason) => {
    report.skipped[reason] = (report.skipped[reason] || 0) + 1;
  };

  let index;
  try {
    index = await loadIndex();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const toInsert = [];
  const fillPlan = [];
  let processed = 0;

  for (let i = 0; i < rows.length; i++) {
    if (processed >= LIMIT) break;
    processed++;
    report.rowsRead++;

    const built = buildRecord(rows[i], source, i + 2, fileName);
    if (built.skip) {
      skip(built.skip.startsWith("unmapped_type:") ? "unmapped_type" : built.skip);
      continue;
    }

    const { record, provenance } = built;
    const sourceKey = `${record.source}::${record.source_id}`;

    // 1. Same filing already imported.
    if (index.bySourceKey.has(sourceKey)) {
      skip("duplicate_source_id");
      continue;
    }

    // 2. Same person/firm by email, or same firm name.
    const existing =
      (record.email && index.byEmail.get(record.email)) ||
      index.byName.get(`l:${looseNameKey(record.full_name)}`) ||
      index.byName.get(`s:${nameKey(record.full_name)}`);

    if (existing) {
      // A placeholder reserved earlier in this same file: the first row owns the
      // identity, so a repeat inside one file is a duplicate, not an update.
      if (!existing.id) {
        skip("duplicate_in_file");
        continue;
      }
      fillPlan.push({ existing, record, provenanceEntry: provenance.imports[0] });
      if (DRY_RUN && fillPlan.length <= 200) {
        const result = await fillExisting(existing.id, record, provenance.imports[0]);
        if (result.changed) report.wouldFill++;
        if (result.error) report.errors.push(result.error);
      } else {
        report.wouldFill++;
      }
      continue;
    }

    const insertRow = {
      ...record,
      is_active: true,
      is_verified: false,
      do_not_contact: false,
      outreach_readiness: record.email ? "needs_verification" : "not_ready",
      data_quality_score: qualityScore(record),
      scope: "unknown",
      verification_status: "unknown",
      record_status: "valid",
      iapd_row: false,
      evidence_streams: [],
      provenance,
    };

    // Reserve the identity so two rows in the same file cannot both insert.
    index.bySourceKey.set(sourceKey, { id: null });
    if (record.email) index.byEmail.set(record.email, { id: null });
    index.byName.set(`s:${nameKey(record.full_name)}`, { id: null });
    index.byName.set(`l:${looseNameKey(record.full_name)}`, { id: null });

    toInsert.push(insertRow);
    report.wouldInsert++;

    if (report.samples.length < 3) {
      report.samples.push({
        full_name: insertRow.full_name,
        investor_type: insertRow.investor_type,
        email: insertRow.email,
        city: insertRow.city,
        country: insertRow.country,
        min_check_size: insertRow.min_check_size,
        max_check_size: insertRow.max_check_size,
        provenance: insertRow.provenance,
      });
    }
  }

  if (!DRY_RUN) {
    const insertResult = await insertRows(toInsert);
    report.inserted = insertResult.inserted;
    report.errors.push(...insertResult.errors.slice(0, 20));

    let filled = 0;
    for (const plan of fillPlan) {
      const result = await fillExisting(plan.existing.id, plan.record, plan.provenanceEntry);
      if (result.changed) filled++;
      if (result.error) report.errors.push(result.error);
    }
    report.filled = filled;
  }

  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error("import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

// Exported for the unit tests: the source-row → corpus-record mapping is the
// part worth pinning, and it should be testable without a database.
module.exports = {
  parseCsv,
  flatten,
  readCsvFile,
  readFormDFile,
  buildRecord,
  formDFundType,
  isPooledFund,
  mapInvestorType,
  parseChequeRange,
  parseMoney,
  looseNameKey,
};
