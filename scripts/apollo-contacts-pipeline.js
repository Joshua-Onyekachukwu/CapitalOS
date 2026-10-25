#!/usr/bin/env node
/**
 * Apollo Contacts -> Capital OS Pipeline
 * ======================================
 * Input : CSV with at least name, company, location. Optional columns improve
 *         results a lot: title, employee_count, domain, website, linkedin_url, email.
 * Stages: parse/clean/dedupe -> title-tier filter (drop Entry/Intern) ->
 *         employee cap (< --max-employees) -> domain inference -> email inference
 *         -> stage into raw_records (source_provider='apollo-contacts').
 * Then:  npx tsx src/scripts/process-raw-records.ts --provider=apollo-contacts
 *
 * Usage:
 *   node scripts/apollo-contacts-pipeline.js --input <file.csv> [--limit N] [--dry-run]
 *        [--keep-entry] [--keep-intern] [--keep-untitled] [--max-employees 10]
 *        [--allow-unknown-size] [--stage-records]
 * Env:
 *   APOLLO_API_KEY / APOLLO_BASE_URL  (optional: org lookups for domains+headcount)
 * Outputs (data-backups/apollo-contacts/): accepted-<date>.csv, rejected-<date>.csv,
 *   checkpoint.json
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const fs = require("fs");
const path = require("path");
const dns = require("dns");
const net = require("net");

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => {
  const i = args.indexOf(n);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : d;
};

const INPUT = val("--input", null);
const LIMIT = parseInt(val("--limit", "0"), 10) || Infinity;
const DRY_RUN = flag("--dry-run");
const MAX_EMPLOYEES = parseInt(val("--max-employees", "10"), 10);
const KEEP_ENTRY = flag("--keep-entry");
const KEEP_INTERN = flag("--keep-intern");
const KEEP_UNTITLED = flag("--keep-untitled");
const ALLOW_UNKNOWN_SIZE = flag("--allow-unknown-size");
const STAGE_RECORDS = flag("--stage-records") && !DRY_RUN;
const VERIFY_API = flag("--verify");
const VERIFY_SMTP = flag("--verify-smtp");
const VERIFY_BUDGET = parseInt(val("--verify-budget", process.env.VERIFY_BUDGET || "0"), 10) || Infinity;
const VERIFY_ONLY = flag("--verify-only");
const ZB_KEY = process.env.ZEROBOUNCE_API_KEY || null;
const ZB_BASE = "https://api.zerobounce.net/v2";

const APOLLO_BASE = (process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1").replace(/\/+$/, "");
const APOLLO_KEY = process.env.APOLLO_API_KEY || null;
const OUT_DIR = path.join(__dirname, "..", "data-backups", "apollo-contacts");
const CHECKPOINT_FILE = path.join(OUT_DIR, "checkpoint.json");  if (!INPUT) {
  console.log("Usage: node scripts/apollo-contacts-pipeline.js --input <file.csv> [--limit N] [--dry-run]");
  console.log("  [--keep-entry] [--keep-intern] [--keep-untitled] [--max-employees 10]");
  console.log("  [--allow-unknown-size] [--stage-records]");
  console.log("Email verification (pay-per-verify unless --verify-smtp):");
  console.log("  [--verify] [--verify-smtp] [--verify-budget N] [--verify-only]");
  console.log("  env: ZEROBOUNCE_API_KEY, VERIFY_BUDGET");
  process.exit(1);
}

// ---------- CSV parsing (RFC-4180-ish) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ---------- Name parsing ----------
const GEN_SUFFIX = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "esq", "dvm", "cpa", "mba"]);
const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "professor", "sir", "dame", "hon", "rev"]);
const PARTICLES = new Set(["de", "del", "della", "di", "da", "dos", "das", "du", "la", "le", "el", "van", "von", "der", "den", "ten", "ter", "zu", "zur", "ibn", "bin", "al", "ben", "abu", "st", "san"]);

function cleanTok(t) {
  return String(t).replace(/\./g, "").toLowerCase();
}

function parseName(raw) {
  if (!raw || !String(raw).trim()) return { first: null, last: null };
  let s = String(raw).replace(/\s+/g, " ").trim();
  if (s.includes(",")) {
    const parts = s.split(",");
    const l = (parts[0] || "").trim();
    const f = (parts[1] || "").trim();
    s = [f, l].filter(Boolean).join(" ");
  }
  s = s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  let toks = s.split(" ").filter(Boolean);
  toks = toks.filter((t) => !HONORIFICS.has(cleanTok(t)) && !GEN_SUFFIX.has(cleanTok(t)));
  if (toks.length === 0) return { first: null, last: null };
  if (toks.length === 1) return { first: toks[0], last: null };
  const first = toks[0];
  const rest = toks.slice(1);
  let i = 0;
  while (i < rest.length - 1 && PARTICLES.has(cleanTok(rest[i]))) i++;
  return { first, last: rest.slice(i).join(" ") };
}

function emailLocalPart(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

// ---------- Company -> domain ----------
const FREE_DOMAINS = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "protonmail.com", "proton.me", "live.com", "msn.com", "yandex.com", "mail.ru", "qq.com", "163.com"]);
const STRIP_WORDS = new Set(["inc", "llc", "llp", "ltd", "limited", "plc", "gmbh", "sarl", "bv", "nv", "oy", "ab", "aps", "pte", "co", "corp", "corporation", "company", "group", "holdings", "holding"]);

function domainFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : "https://" + url);
    return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function slugDomain(company) {
  if (!company) return null;
  const words = String(company)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STRIP_WORDS.has(w));
  if (words.length === 0) return null;
  const base = words.join("");
  if (base.length < 3 || base.length > 30) return null;
  return base + ".com";
}

// ---------- Title tiers ----------
function classifyTitle(title) {
  if (!title || !String(title).trim()) return null;
  const t = String(title);
  if (/founder|co-?founder|cofounder|founding/i.test(t)) return "founder";
  if (/owner|principal|proprietor|sole proprietor/i.test(t)) return "owner";
  if (/\b(ceo|cto|coo|cfo|cmo|cro|cso|cdo|cio|cpo|cxo|chief\s+[a-z]+\s+officer)\b/i.test(t)) return "c_suite";
  if (/\bpartner\b/i.test(t)) return "partner";
  if (/\b(vp|v\.p\.|vice[-\s]?president|evp|svp)\b/i.test(t)) return "vp";
  if (/\bhead\b/i.test(t)) return "head";
  if (/\bdirector\b/i.test(t)) return "director";
  if (/\b(manager|lead)\b/i.test(t)) return "manager";
  if (/\b(senior|snr|sr\.)\b/i.test(t)) return "senior";
  if (/\b(investor|angel|venture capitalist|vc)\b/i.test(t)) return "investor";
  if (/\b(entry|analyst|associate|assistant|coordinator|specialist)\b/i.test(t)) return "entry";
  if (/\bintern\b/i.test(t)) return "intern";
  return "other";
}

const KEEP_TIERS = new Set(["founder", "owner", "c_suite", "partner", "vp", "head", "director", "manager", "senior", "investor"]);

// ---------- Email patterns ----------
const PATTERNS = [
  { name: "first.last", build: (fn, ln) => `${fn}.${ln}`, prior: 55 },
  { name: "firstlast",  build: (fn, ln) => `${fn}${ln}`,  prior: 14 },
  { name: "f.last",     build: (fn, ln) => `${fn[0]}.${ln}`, prior: 10 },
  { name: "first_last", build: (fn, ln) => `${fn}_${ln}`, prior: 7 },
  { name: "first",      build: (fn, ln) => fn,           prior: 6 },
  { name: "first.l",    build: (fn, ln) => `${fn}.${ln[0]}`, prior: 4 },
  { name: "flast",      build: (fn, ln) => `${fn[0]}${ln}`,  prior: 4 },
];

function generateCandidates(fn, ln, domain) {
  if (!domain) return [];
  const a = emailLocalPart(fn);
  const b = emailLocalPart(ln);
  if (!a || !b) return [];
  return PATTERNS.map((p) => ({ email: `${p.build(a, b)}@${domain}`, pattern: p.name, prior: p.prior }))
    .sort((x, y) => y.prior - x.prior);
}

// ---------- Email verification ----------
// Two modes, mutually exclusive (API wins if both flags are passed):
//   --verify      ZeroBounce /v2/validate, pay-per-verify, env ZEROBOUNCE_API_KEY
//   --verify-smtp free best-effort probe: MX lookup + RCPT TO (many providers
//                 block it; a "cannot verify" result is NOT a rejection)

const mxCache = new Map(); // domain -> mx hosts []

function resolveMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      const hosts = err || !addresses ? [] : addresses.map((a) => a.exchange).filter(Boolean);
      mxCache.set(domain, hosts);
      resolve(hosts);
    });
  });
}

async function verifyViaZeroBounce(email) {
  const url = `${ZB_BASE}/validate?api_key=${encodeURIComponent(ZB_KEY)}&email=${encodeURIComponent(email)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return { email, status: "api_error", substatus: null, paid: false };
      const j = await res.json();
      if (j && typeof j.credits === "number" && j.credits <= 0) {
        return { email, status: "out_of_credits", substatus: null, paid: false };
      }
      // ZeroBounce: valid | invalid | catch-all | unknown | spamtrap | abuse |
      // do_not_mail. Treat valid+catch-all as deliverable; everything else is not.
      const st = String(j.status || "unknown").toLowerCase();
      const deliverable = st === "valid" || st === "catch-all";
      return { email, status: st, substatus: j.substatus || null, paid: true, free_email: !!j.free_email, did_you_mean: j.did_you_mean || null };
    } catch (e) {
      lastVerifyError = e.message;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return { email, status: "api_error", substatus: lastVerifyError || null, paid: false };
}

let lastVerifyError = null;

async function verifyViaSmtp(email) {
  const domain = email.split("@")[1];
  if (!domain) return { email, status: "no_domain", paid: false };
  const hosts = await resolveMx(domain);
  if (!hosts.length) return { email, status: "no_mx", paid: false };

  const [local, host] = [email.split("@")[0], hosts[0]];
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 25, timeout: 10000 });
    let step = 0;
    let fromSent = false;
    const finish = (status) => {
      try { socket.destroy(); } catch {}
      resolve({ email, status, paid: false });
    };
    socket.on("timeout", () => finish("timeout"));
    socket.on("error", () => finish("smtp_blocked"));
    socket.on("data", (chunk) => {
      const code = parseInt(String(chunk).slice(0, 3), 10);
      if (code >= 500) return finish(step === 3 ? "does_not_exist" : "smtp_rejected");
      if (step === 0 && code === 220) {
        step = 1;
        socket.write(`HELO verify.local\r\n`);
      } else if (step === 1 && code === 250) {
        step = 2;
        fromSent = true;
        socket.write(`MAIL FROM:<probe@verify.local>\r\n`);
      } else if (step === 2 && code === 250 && fromSent) {
        step = 3;
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 3 && code === 250) {
        finish("exists");
      } else if (code === 250) {
        // 250 to HELO/MAIL — wait for next stage
      }
    });
  });
}

async function verifyEmails(rows) {
  const useApi = VERIFY_API && ZB_KEY;
  if (VERIFY_API && !ZB_KEY) {
    console.log("   [!] --verify needs ZEROBOUNCE_API_KEY in .env.local - skipping verification");
    return { verified: 0, deliverable: 0, spent: 0 };
  }
  if (!useApi && !VERIFY_SMTP) return { verified: 0, deliverable: 0, spent: 0 };

  const mode = useApi ? "ZeroBounce API (pay-per-verify)" : "free SMTP probe";
  console.log(`\nVerifying ${rows.length} email candidates via ${mode}...`);
  let spent = 0;
  let deliverable = 0;
  const results = [];

  for (const row of rows) {
    if (!row.best_email) continue;
    if (spent >= VERIFY_BUDGET) {
      console.log(`   [i] verify budget (${VERIFY_BUDGET}) reached - remaining rows left unverified`);
      break;
    }
    const r = useApi ? await verifyViaZeroBounce(row.best_email) : await verifyViaSmtp(row.best_email);
    if (r.paid) spent++;
    row.verify_status = r.status;
    row.verify_substatus = r.substatus || null;
    row.email_deliverable = ["valid", "catch-all", "exists"].includes(r.status);
    if (row.email_deliverable) deliverable++;
    if (r.status === "out_of_credits") {
      console.log("   [!] ZeroBounce account out of credits - stopping verification");
      break;
    }
    results.push(r);
    if (results.length % 25 === 0) {
      process.stdout.write(`   verified ${results.length}/${rows.length} (deliverable: ${deliverable})\n`);
    }
  }

  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log(`Verification done: ${JSON.stringify(byStatus)} | paid verifies: ${spent}`);
  return { verified: results.length, deliverable, spent };
}

// ---------- Apollo client (org lookup; degrades gracefully) ----------
let apolloUsable = null; // null = untested, true/false after first probe
const orgCache = new Map(); // company (lowercase) -> org object | null

async function apolloLookupOrg(companyName) {
  if (!APOLLO_KEY || apolloUsable === false || !companyName) return null;
  const key = String(companyName).toLowerCase().trim();
  if (orgCache.has(key)) return orgCache.get(key);

  if (apolloUsable === null) {
    try {
      const probe = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
        body: JSON.stringify({ q_organization_name: "acme corp", page: 1, per_page: 1 }),
      });
      if (probe.status === 401 || probe.status === 403) {
        console.log("   [i] Apollo key rejected (401/403) - org lookups disabled; using CSV fields + heuristics only");
        apolloUsable = false;
        orgCache.set(key, null);
        return null;
      }
      apolloUsable = true;
    } catch (e) {
      console.log(`   [i] Apollo unreachable (${e.message}) - org lookups disabled`);
      apolloUsable = false;
      orgCache.set(key, null);
      return null;
    }
  }

  try {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
          body: JSON.stringify({ q_organization_name: companyName, page: 1, per_page: 1 }),
        });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) { orgCache.set(key, null); return null; }
        const json = await res.json();
        const orgs = json && Array.isArray(json.organizations) ? json.organizations : [];
        const org = orgs[0] || null;
        orgCache.set(key, org);
        await new Promise((r) => setTimeout(r, 350)); // be polite to rate limits
        return org;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    orgCache.set(key, null);
    return null;
  } catch {
    orgCache.set(key, null);
    return null;
  }
}

// ---------- Row model + cleaning ----------
function pick(row, names) {
  for (const want of names) {
    for (const k of Object.keys(row)) {
      const norm = k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (norm === want && row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
  }
  return null;
}

function cleanRow(raw, idx) {
  const name = pick(raw, ["name", "full_name", "contact_name", "person_name"]);
  const company = pick(raw, ["company", "company_name", "organization", "organization_name", "employer"]);
  const location = pick(raw, ["location", "city", "city_state", "person_location"]);
  const title = pick(raw, ["title", "job_title", "position", "role"]);
  const employeesRaw = pick(raw, ["employee_count", "employees", "company_employee_count", "headcount"]);
  const domainIn = pick(raw, ["domain", "company_domain", "website_domain", "firm_domain"]);
  const websiteIn = pick(raw, ["website", "company_website", "website_url", "url", "firm_website"]);
  const linkedin = pick(raw, ["linkedin_url", "linkedin", "profile_url"]);
  const emailIn = pick(raw, ["email", "email_address"]);
  const apolloId = pick(raw, ["id", "person_id", "contact_id", "apollo_id"]);

  if (!name) return { idx, drop: "no_name" };
  if (!company) return { idx, drop: "no_company" };

  const parsed = parseName(name);
  if (!parsed.first || !parsed.last) return { idx, drop: "unparseable_name" };

  let employees = null;
  if (employeesRaw) {
    const m = String(employeesRaw).replace(/,/g, "").match(/\d+/);
    if (m) employees = parseInt(m[0], 10);
  }

  let domain = domainIn ? domainFromUrl(domainIn) : null;
  if (!domain && websiteIn) domain = domainFromUrl(websiteIn);
  if (domain && FREE_DOMAINS.has(domain)) domain = null; // a free mailbox is not a company domain

  return {
    idx,
    name,
    first: parsed.first,
    last: parsed.last,
    company,
    location: location || null,
    title: title || null,
    tier: classifyTitle(title),
    employees,
    employees_source: employees != null ? "csv" : null,
    domain,
    domain_source: domain ? (domainIn ? "csv" : "csv_website") : null,
    website: websiteIn || null,
    linkedin: linkedin || null,
    email: emailIn || null,
    apolloId: apolloId || null,
  };
}

// ---------- Main ----------
async function main() {
  console.log("=== Apollo Contacts -> Capital OS ===");
  console.log(`Input: ${INPUT}${LIMIT !== Infinity ? ` (limit ${LIMIT})` : ""}${DRY_RUN ? "  [DRY RUN]" : ""}`);
  console.log(`Employee cap: <${MAX_EMPLOYEES}${ALLOW_UNKNOWN_SIZE ? "  (unknown-size rows allowed)" : ""}`);
  console.log(`Tiers kept: ${[...KEEP_TIERS].join(", ")}`);
  console.log(`Dropping: entry=${!KEEP_ENTRY} intern=${!KEEP_INTERN} untitled/other=${!KEEP_UNTITLED}\n`);

  const text = fs.readFileSync(INPUT, "utf8");
  const table = parseCsv(text);
  if (table.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
  }
  const headers = table[0];
  const rawRows = table.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i]; });
    return obj;
  });
  console.log(`Parsed ${rawRows.length} data rows (columns: ${headers.join(", ")})\n`);

  // ---- Stage 1+2: clean, dedupe, tier filter
  const reasons = {};
  const bump = (r) => { reasons[r] = (reasons[r] || 0) + 1; };
  const seenEmail = new Set();
  const seenLinkedin = new Set();
  const seenNameCompany = new Set();
  const cleaned = [];

  for (let i = 0; i < rawRows.length && cleaned.length < LIMIT; i++) {
    const row = cleanRow(rawRows[i], i);
    if (row.drop) { bump(row.drop); continue; }
    if (row.email && seenEmail.has(row.email.toLowerCase())) { bump("dup_email"); continue; }
    if (row.linkedin && seenLinkedin.has(row.linkedin.toLowerCase().replace(/\/+$/, ""))) { bump("dup_linkedin"); continue; }
    const nameKey = `${(row.first || "").toLowerCase()}|${(row.last || "").toLowerCase()}|${row.company.toLowerCase()}`;
    if (seenNameCompany.has(nameKey)) { bump("dup_name_company"); continue; }

    const tier = row.tier;
    if (tier === null) { if (!KEEP_UNTITLED) { bump("no_title"); continue; } }
    else if (tier === "entry" && !KEEP_ENTRY) { bump("tier_entry"); continue; }
    else if (tier === "intern" && !KEEP_INTERN) { bump("tier_intern"); continue; }
    else if (tier === "other" && !KEEP_UNTITLED) { bump("tier_other"); continue; }
    else if (!KEEP_TIERS.has(tier)) { bump("tier_" + tier); continue; }

    if (row.email) seenEmail.add(row.email.toLowerCase());
    if (row.linkedin) seenLinkedin.add(row.linkedin.toLowerCase().replace(/\/+$/, ""));
    seenNameCompany.add(nameKey);
    cleaned.push(row);
  }
  console.log(`After clean/dedupe/tier filter: ${cleaned.length} rows`);
  console.log(`Dropped so far: ${JSON.stringify(reasons)}\n`);

  // ---- Stage 3+4: Apollo org enrichment, employee filter, domain+email inference
  let accepted = [];
  const rejected = [];
  let apolloLookups = 0;

  for (const row of cleaned) {
    if ((!row.employees || !row.domain) && APOLLO_KEY) {
      const org = await apolloLookupOrg(row.company);
      apolloLookups++;
      if (org) {
        if (!row.employees && org.estimated_num_employees_1 != null) {
          row.employees = org.estimated_num_employees_1; // lower bound of Apollo's band
          row.employees_source = "apollo";
        }
        if (!row.domain && org.primary_domain) {
          row.domain = org.primary_domain;
          row.domain_source = "apollo";
        }
        if (!row.website && org.website_url) row.website = org.website_url;
      }
    }

    if (row.employees == null) {
      if (!ALLOW_UNKNOWN_SIZE) { bump("unknown_employee_count"); rejected.push({ row, reason: "unknown_employee_count" }); continue; }
    } else if (row.employees >= MAX_EMPLOYEES) {
      bump("too_big");
      rejected.push({ row, reason: `employees=${row.employees} >= ${MAX_EMPLOYEES}` });
      continue;
    }

    if (!row.domain) {
      row.domain = slugDomain(row.company);
      row.domain_source = row.domain ? "heuristic" : null;
    }

    const cands = generateCandidates(row.first, row.last, row.domain);
    row.email_candidates = cands.map((c) => c.email);
    row.best_email = cands.length ? cands[0].email : null;
    row.email_pattern = cands.length ? cands[0].pattern : null;
    accepted.push(row);
  }

  // ---- Email verification (optional; runs before outputs so CSVs include results)
  let verifyStats = { verified: 0, deliverable: 0, spent: 0 };
  if (VERIFY_API || VERIFY_SMTP) {
    verifyStats = await verifyEmails(accepted);
    if (VERIFY_ONLY) {
      const before = accepted.length;
      const kept = accepted.filter((r) => r.email_deliverable);
      for (const r of accepted) {
        if (!r.email_deliverable) rejected.push({ row: r, reason: "email_not_deliverable" });
      }
      accepted = kept;
      bump("email_not_deliverable");
      console.log(`--verify-only: kept ${accepted.length}/${before} rows with deliverable emails`);
    }
  }

  console.log(`Apollo org lookups: ${apolloLookups}${apolloUsable === false ? " (disabled - key invalid/absent)" : ""}`);
  console.log(`Accepted: ${accepted.length}  |  Final drop reasons: ${JSON.stringify(reasons)}\n`);

  // ---- Outputs
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outHeaders = ["name", "first_name", "last_name", "company", "title", "tier", "location", "employees", "employees_source", "domain", "domain_source", "website", "linkedin_url", "email_in_csv", "best_email", "email_pattern", "verify_status", "email_deliverable", "email_candidates", "apollo_id"];
  const cell = (r, h) => {
    if (h === "email_candidates") return csvEscape((r.email_candidates || []).join(" "));
    const key = h === "linkedin_url" ? "linkedin" : h === "first_name" ? "first" : h === "last_name" ? "last" : h === "email_in_csv" ? "email" : h;
    return csvEscape(r[key]);
  };

  const acceptedPath = path.join(OUT_DIR, `accepted-${stamp}.csv`);
  const rejectedPath = path.join(OUT_DIR, `rejected-${stamp}.csv`);
  fs.writeFileSync(acceptedPath, [outHeaders.join(","), ...accepted.map((r) => outHeaders.map((h) => cell(r, h)).join(","))].join("\n"));
  fs.writeFileSync(rejectedPath, ["reason," + outHeaders.join(","), ...rejected.map(({ row, reason }) => csvEscape(reason) + "," + outHeaders.map((h) => cell(row, h)).join(","))].join("\n"));

  console.log("=== Summary ===");
  console.log(`Input rows:         ${rawRows.length}`);
  console.log(`After tier filter:  ${cleaned.length}`);
  console.log(`Accepted (final):   ${accepted.length}`);
  console.log(`With email guess:   ${accepted.filter((r) => r.best_email).length}`);
  console.log(`With domain:        ${accepted.filter((r) => r.domain).length}`);
  console.log(`With employee data: ${accepted.filter((r) => r.employees != null).length}`);
  if (VERIFY_API || VERIFY_SMTP) {
    console.log(`Verified emails:    ${verifyStats.verified} (deliverable: ${verifyStats.deliverable}, paid verifies: ${verifyStats.spent})`);
  }
  console.log(`\nWrote: ${acceptedPath}`);
  console.log(`Wrote: ${rejectedPath}`);

  // ---- Stage into raw_records for the ingestion pipeline
  if (STAGE_RECORDS) {
    const { createClient } = require("@supabase/supabase-js");
    const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const BATCH = 500;
    let staged = 0;
    for (let i = 0; i < accepted.length; i += BATCH) {
      const batch = accepted.slice(i, i + BATCH).map((r) => ({
        raw_data: {
          providerId: r.apolloId || `apollo-contacts:${r.idx}`,
          providerName: "apollo-contacts",
          firstName: r.first,
          lastName: r.last,
          fullName: r.name,
          email: r.best_email || r.email || undefined,
          linkedinUrl: r.linkedin || undefined,
          jobTitle: r.title || undefined,
          location: r.location || undefined,
          firmName: r.company,
          firmDomain: r.domain || undefined,
          firmWebsite: r.website || undefined,
          investorType: "angel_investor",
          emailCandidates: r.email_candidates && r.email_candidates.length > 1 ? r.email_candidates : undefined,
          raw: r,
        },
        source_type: "provider",
        source_provider: "apollo-contacts",
        source_url: r.linkedin || r.website || null,
        status: "pending",
      }));
      const { error } = await sp.from("raw_records").insert(batch);
      if (error) {
        console.error(`\nBatch insert error (${batch.length} rows): ${error.message}`);
        process.exitCode = 1;
        break;
      }
      staged += batch.length;
      process.stdout.write(`\rStaged ${staged}/${accepted.length}...`);
    }
    console.log(`\n\nStaged ${staged} records into raw_records.`);
    console.log("Next: npx tsx src/scripts/process-raw-records.ts --provider=apollo-contacts");
  } else if (DRY_RUN) {
    console.log("\n[DRY RUN] Sample accepted rows:");
    for (const r of accepted.slice(0, 10)) {
      console.log(`  ${r.name} | ${r.title || "(no title)"} | ${r.company} | emp=${r.employees ?? "?"} | ${r.best_email || "(no email)"}`);
    }
    console.log("\nRe-run with --stage-records (without --dry-run) to insert into raw_records.");
  }

  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    input: INPUT,
    ran_at: new Date().toISOString(),
    input_rows: rawRows.length,
    after_tier_filter: cleaned.length,
    accepted: accepted.length,
    staged: STAGE_RECORDS ? accepted.length : 0,
    apollo_lookups: apolloLookups,
    drop_reasons: reasons,
  }, null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
