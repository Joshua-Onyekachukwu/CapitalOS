/**
 * Investor qualification + contact enrichment (dry run first, then --push).
 *
 * Sources (local, real data — no LLM invention):
 *  - data-backups/verified-emails-2026-08-27…json  → SEC EDGAR 13F-HR / Form D / N-CEN published
 *    firm contact emails (excludes "generated" pattern guesses) + fishtank directory emails.
 *  - data-backups/fishtank/fishtank-investors-v2.json → scraped investor directory (linkedin, sectors).
 *
 * Verification: every email candidate must pass an MX (or A-fallback) domain check before it is
 * attached — no unverifiable addresses are written.
 *
 * Scoring: exact reimplementation of src/lib/services/investor/qualification.ts (computeFitScore),
 * the same model covered by src/__tests__/fit-scoring.test.ts. Startup context:
 * { sector: "ai", stage: "seed", geography: "United States" } (matches all active company profiles).
 *
 * Usage:
 *   node scripts/qualify-investors-2026-10.cjs            # dry run, writes local copies only
 *   node scripts/qualify-investors-2026-10.cjs --push     # writes updates to Supabase via REST
 *   node scripts/qualify-investors-2026-10.cjs --push --batch 500 --limit 2000
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const dns = require("dns").promises;
const { createClient } = require("@supabase/supabase-js");

const PUSH = process.argv.includes("--push");
const bAt = process.argv.indexOf("--batch");
const lAt = process.argv.indexOf("--limit");
const BATCH = bAt >= 0 ? parseInt(process.argv[bAt + 1], 10) : 500;
const LIMIT = lAt >= 0 ? parseInt(process.argv[lAt + 1], 10) : 0;
if (!Number.isFinite(BATCH) || BATCH <= 0 || !Number.isFinite(LIMIT)) { console.error("bad --batch/--limit"); process.exit(2); }
const TAG = "2026-10-25";

// ── Region scope: US / UK / Europe (user decision; Nigeria and other regions out of scope) ──
const EU = new Set([
  "france", "luxembourg", "switzerland", "germany", "sweden", "netherlands", "ireland", "spain",
  "denmark", "norway", "italy", "belgium", "finland", "malta", "portugal", "austria", "poland",
  "greece", "estonia", "latvia", "lithuania", "czech republic", "czechia", "romania", "hungary",
  "slovakia", "croatia", "bulgaria", "cyprus", "slovenia",
]);
const REGION = (country) => {
  const n = String(country || "").toLowerCase();
  return n.includes("united states") || n.includes("united kingdom") || EU.has(n) || n.includes("european union");
};

const STARTUP = { sector: "ai", stage: "seed", geography: "United States" };

// ── Scoring model (verbatim port of qualification.ts) ──
function scoreSectorMatch(investorSectors, startupSector) {
  if (!investorSectors.length || !startupSector) return { score: 50, explanation: "Insufficient sector data for matching" };
  const ns = startupSector.toLowerCase().replace(/[^a-z0-9]/g, "");
  const inv = investorSectors.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (inv.includes(ns)) return { score: 100, explanation: `Direct sector match: ${startupSector}` };
  const groups = {
    ai: ["ai", "machinelearning", "deeplearning", "ml", "datascience", "nlp", "computervision"],
    fintech: ["fintech", "financialtechnology", "payments", "banking", "insurtech", "wealthtech"],
    saas: ["saas", "enterprise", "b2b", "software", "cloud", "devtools"],
    healthtech: ["healthtech", "healthcare", "biotech", "medtech", "digitalhealth"],
    climatetech: ["climatetech", "cleantech", "energy", "sustainability", "renewables"],
    consumer: ["consumer", "b2c", "marketplace", "ecommerce", "retail"],
    web3: ["web3", "blockchain", "crypto", "defi", "nft"],
    deepTech: ["deeptech", "robotics", "hardware", "spacetech", "quantum"],
  };
  for (const [group, keywords] of Object.entries(groups)) {
    if (keywords.includes(ns)) {
      const m = inv.filter((s) => keywords.includes(s)).length;
      if (m > 0) return { score: 85, explanation: `Related sector group: ${group} (${m} investor interests overlap)` };
    }
  }
  for (const s of inv) if (s.includes(ns) || ns.includes(s)) return { score: 70, explanation: `Partial sector overlap with ${s}` };
  return { score: 20, explanation: `No sector overlap detected. Investor focuses on: ${investorSectors.slice(0, 3).join(", ")}` };
}
function scoreStageMatch(invStages, startupStage) {
  if (!invStages.length || !startupStage) return { score: 50, explanation: "Insufficient stage data" };
  const ns = startupStage.toLowerCase().replace(/\s+/g, "_");
  const inv = invStages.map((s) => s.toLowerCase().replace(/\s+/g, "_"));
  if (inv.includes(ns)) return { score: 100, explanation: `Direct stage match: ${startupStage}` };
  const order = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];
  const si = order.indexOf(ns);
  for (const s of inv) {
    const ii = order.indexOf(s);
    if (si >= 0 && ii >= 0) {
      const d = Math.abs(si - ii);
      if (d === 1) return { score: 75, explanation: `Adjacent stage: investor does ${s}, startup is ${startupStage}` };
      if (d === 2) return { score: 40, explanation: `Two stages apart: investor does ${s}, startup is ${startupStage}` };
    }
  }
  return { score: 15, explanation: `Stage mismatch. Investor focuses on: ${invStages.join(", ")}` };
}
function scoreGeographyMatch(invGeos, invCountry, startupGeo) {
  if (!startupGeo) return { score: 50, explanation: "No geography specified for startup" };
  const n = startupGeo.toLowerCase().trim();
  if (invCountry && invCountry.toLowerCase() === n) return { score: 100, explanation: `Same country: ${startupGeo}` };
  if (invGeos.length > 0) {
    const m = invGeos.find((g) => g.toLowerCase().includes(n) || n.includes(g.toLowerCase()));
    if (m) return { score: 100, explanation: `Geography match: ${m}` };
    if (invGeos.some((g) => g.toLowerCase().includes("global") || g.toLowerCase().includes("worldwide")))
      return { score: 90, explanation: "Global investor — accepts any geography" };
  }
  if (invCountry && ["united states", "usa", "us"].includes(invCountry.toLowerCase()) && ["united states", "usa", "us"].includes(n))
    return { score: 95, explanation: "US investor, US startup" };
  return { score: 30, explanation: `Geography may not align. Investor: ${invCountry || "Unknown"}, Startup: ${startupGeo}` };
}
function scoreCheckSizeMatch(invMin, invMax, stMin, stMax) {
  if (!invMin && !invMax) return { score: 60, explanation: "Investor check size not specified" };
  if (!stMin && !stMax) return { score: 60, explanation: "Startup funding target not specified" };
  const iMin = invMin || 0, iMax = invMax || Infinity, sMin = stMin || 0, sMax = stMax || Infinity;
  const oMin = Math.max(iMin, sMin), oMax = Math.min(iMax, sMax);
  if (oMin <= oMax) {
    const r = oMax - oMin, t = Math.max(iMax, sMax) - Math.min(iMin, sMin);
    return { score: Math.round(60 + (t > 0 ? r / t : 1) * 40), explanation: "Check size overlap" };
  }
  return { score: 15, explanation: "No check size overlap" };
}
function scoreDataCompleteness(inv) {
  const fields = ["email", "linkedin_url", "job_title", "phone", "investment_stages", "investment_sectors", "investment_geographies", "min_check_size", "max_check_size", "bio"];
  let filled = 0; const missing = [];
  for (const f of fields) {
    const v = inv[f];
    if (v && (Array.isArray(v) ? v.length > 0 : true)) filled++;
    else missing.push(f.replace(/_/g, " "));
  }
  const score = Math.round((filled / fields.length) * 100);
  return { score, explanation: missing.length ? `${filled}/${fields.length} fields populated. Missing: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` +${missing.length - 3} more` : ""}` : "All key fields populated" };
}
function scoreOutreachReadiness(inv) {
  let score = 0; const s = [];
  if (inv.email) { score += 30; s.push("has email"); }
  if (inv.linkedin_url) { score += 20; s.push("has LinkedIn"); }
  if (inv.is_verified) { score += 15; s.push("verified"); }
  if ((inv.data_quality_score || 0) >= 70) { score += 15; s.push("high data quality"); }
  if (inv.investment_sectors && inv.investment_sectors.length > 0) { score += 10; s.push("sectors defined"); }
  if (inv.do_not_contact) { score = 0; s.push("do-not-contact flag"); }
  return { score: Math.min(score, 100), explanation: s.length ? `Outreach signals: ${s.join(", ")}` : "No outreach signals available" };
}
function computeFitScore(investor, startup) {
  const factors = [];
  const fx = (...t) => factors.push(...t);
  const sector = scoreSectorMatch(investor.investment_sectors || [], startup.sector);
  fx({ factor: "Sector Match", score: sector.score, weight: 0.25, explanation: sector.explanation });
  const stage = scoreStageMatch(investor.investment_stages || [], startup.stage);
  fx({ factor: "Stage Match", score: stage.score, weight: 0.20, explanation: stage.explanation });
  const geo = scoreGeographyMatch(investor.investment_geographies || [], investor.country || null, startup.geography);
  fx({ factor: "Geography Match", score: geo.score, weight: 0.15, explanation: geo.explanation });
  const check = scoreCheckSizeMatch(investor.min_check_size || null, investor.max_check_size || null, startup.minCheckSize, startup.maxCheckSize);
  fx({ factor: "Check Size Fit", score: check.score, weight: 0.15, explanation: check.explanation });
  const complete = scoreDataCompleteness(investor);
  fx({ factor: "Data Completeness", score: complete.score, weight: 0.10, explanation: complete.explanation });
  const outreach = scoreOutreachReadiness(investor);
  fx({ factor: "Contactability", score: outreach.score, weight: 0.10, explanation: outreach.explanation });
  let act = 50, actE = "No investment date data";
  if (investor.last_investment_date) {
    const d = Math.floor((Date.now() - new Date(investor.last_investment_date).getTime()) / 86400000);
    if (d < 90) { act = 100; actE = `Last investment ${d} days ago — very active`; }
    else if (d < 365) { act = 75; actE = `Last investment ${Math.floor(d / 30)} months ago`; }
    else { act = 30; actE = `Last investment ${Math.floor(d / 365)} years ago`; }
  }
  fx({ factor: "Recent Activity", score: act, weight: 0.05, explanation: actE });
  const overall = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  const confidence = complete.score;
  let readiness = "not_ready";
  if (investor.do_not_contact) readiness = "do_not_contact";
  else if (overall >= 70 && confidence >= 60) readiness = "ready";
  else if (overall >= 50 || confidence >= 40) readiness = "needs_verification";
  return { overall, factors, confidence, dataQuality: complete.score, readiness };
}

// ── Data sources ──
const normalize = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP_TOKENS = new Set(["lp", "l p", "ltd", "inc", "co", "llc", "plc", "ltd", "limited", "corp", "corporation", "company", "nv", "sa", "gmbh", "ag", "bv", "oy", "ab", "as"]);
function normKey(name) {
  let k = normalize(name);
  if (!k) return "";
  const parts = k.split(" ");
  while (parts.length > 1 && STOP_TOKENS.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ").trim();
}

const ve = require("../data-backups/verified-emails-2026-08-27T00-29-35-757Z.json");
const PRIORITY = { apollo_csv: 0, edgar_form_d: 1, edgar_13f_hr: 2, edgar_ncen: 3, fishtank: 4 };
const emailExact = new Map(); const emailKey = new Map();
for (const e of ve) {
  if (e.source === "generated") continue;
  const email = String(e.email).toLowerCase().trim();
  const k = normalize(e.name); const kk = normKey(e.name);
  if (!k) continue;
  const entry = { email, source: e.source };
  if (!emailExact.has(k)) emailExact.set(k, []);
  emailExact.get(k).push(entry);
  if (kk && !emailKey.has(kk)) emailKey.set(kk, []);
  if (kk) emailKey.get(kk).push(entry);
}
for (const m of [emailExact, emailKey])
  for (const list of m.values()) list.sort((a, b) => (PRIORITY[a.source] ?? 9) - (PRIORITY[b.source] ?? 9));

const ft = require("../data-backups/fishtank/fishtank-investors-v2.json");
const ftIdx = new Map();
for (const r of ft) {
  const k = normKey(r.full_name);
  if (!k || k.length < 4) continue;
  const linked = r.linkedin_url || r.company_linkedin_url || null;
  if (!linked && !(r.investment_sectors || []).length && !(r.investment_stages || []).length) continue;
  if (!ftIdx.has(k)) ftIdx.set(k, []);
  ftIdx.get(k).push(r);
}

// Aug-27 backup: harvested ONLY for company-level LinkedIn links of exact same-named rows.
// (Its emails are name-rule guesses — email_source=inferred/rule_enrichment — deliberately excluded.)
function parseCSVLines(text) {
  const rows = []; let cur = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n") { cur.push(field); field = ""; rows.push(cur); cur = []; }
    else if (c === "\r") {}
    else field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}
const backupRows = parseCSVLines(fs.readFileSync("data-backups/investors-full-backup-2026-08-27T00-29-35-757Z.csv", "utf8"));
const bh = backupRows[0].map((h) => h.toLowerCase().trim());
const bi = Object.fromEntries(bh.map((h, i) => [h, i]));
const backupCompanyLink = new Map();
for (let i = 1; i < backupRows.length; i++) {
  const r = backupRows[i];
  const link = (r[bi.company_linkedin_url] || "").trim();
  if (!link || !/linkedin\.com\/(company|school)\//i.test(link)) continue;
  const k = normKey(r[bi.full_name]);
  if (k && !backupCompanyLink.has(k)) backupCompanyLink.set(k, link);
}
console.log("backup company-LinkedIn index:", backupCompanyLink.size);

// ── MX / domain verification with cache ──
const mxCache = new Map();
async function emailIsReachable(email) {
  const domain = email.split("@")[1];
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain);
  let ok = false;
  try {
    const mx = await dns.resolveMx(domain);
    ok = Array.isArray(mx) && mx.length > 0;
  } catch {
    try { const a = await dns.resolve4(domain); ok = a.length > 0; } catch { ok = false; }
  }
  mxCache.set(domain, ok);
  return ok;
}
async function pool(tasks, size = 24) {
  const results = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const mine = i++;
      results[mine] = await tasks[mine]();
    }
  }
  await Promise.all(Array.from({ length: size }, () => worker().catch((e) => { console.error("worker err", e.message); })));
  return results;
}

// ── Pull current rows from DB (fresh, authoritative) ──
(async () => {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const cols = "id,full_name,investor_type,email,linkedin_url,job_title,phone,investment_stages,investment_sectors,investment_geographies,min_check_size,max_check_size,country,is_verified,is_active,do_not_contact,data_quality_score,fit_score,outreach_readiness,last_investment_date,qualification_notes,source,created_at";
  let all = [], from = 0;
  for (;;) {
    const { data, error } = await svc.from("investors").select(cols).order("id").range(from, from + 999);
    if (error) { console.error("PULL ERROR", error.message); process.exit(1); }
    all = all.concat(data); from += 1000;
    if (data.length < 1000) break;
  }
  console.log(`pulled ${all.length} rows`);
  const active = all.filter((r) => r.is_active);
  const target = LIMIT ? active.slice(0, LIMIT) : active;
  console.log(`active: ${active.length} | processing: ${target.length}`);

  // 1. MX-verify all candidate domains in parallel
  const candidates = new Map(); // invId -> {email, source}
  for (const inv of target) {
    if (inv.email) continue;
    const k = normalize(inv.full_name), kk = normKey(inv.full_name);
    const e = emailExact.get(k) || emailKey.get(kk) || null;
    if (e && e.length) candidates.set(inv.id, e[0]);
  }
  console.log(`email candidates before MX check: ${candidates.size}`);
  const candList = [...candidates.entries()];
  const reach = await pool(candList.map(([, c]) => () => emailIsReachable(c.email)));
  let unreachable = 0;
  candList.forEach(([id, c], i) => { if (!reach[i]) unreachable++; candidates.get(id).reachable = reach[i]; });
  console.log(`unreachable domains: ${unreachable} (email not attached for these)`);

  // 2. Build updates
  const updates = [];
  const summary = { emailAttached: 0, linkedinAttached: 0, regionRows: 0, fitBefore: { ">=80": 0, "70-79": 0, "50-69": 0, "<50": 0 }, fitAfter: { ">=80": 0, "70-79": 0, "50-69": 0, "<50": 0 }, readyBefore: 0, readyAfter: 0 };
  for (const inv of target) {
    const isRegion = REGION(inv.country);
    if (isRegion) summary.regionRows++;
    const patch = {}; let notes = null;
    const e = candidates.get(inv.id);
    if (e && e.reachable) {
      patch.email = e.email;
      notes = { email_source: e.source, email_note: "published contact from SEC filing / directory; domain MX-verified", verified_at: TAG };
      summary.emailAttached++;
    }
    if (!inv.linkedin_url) {
      const k = normKey(inv.full_name);
      let link = null, linkSource = null;
      const f = (ftIdx.get(k) || [])[0];
      if (f && (f.linkedin_url || f.company_linkedin_url)) { link = f.linkedin_url || f.company_linkedin_url; linkSource = "fishtank.vc directory"; }
      if (!link && backupCompanyLink.has(k)) { link = backupCompanyLink.get(k); linkSource = "restored backup (company page)"; }
      if (link) {
        patch.linkedin_url = link;
        notes = Object.assign(notes || {}, { linkedin_source: linkSource });
        summary.linkedinAttached++;
      }
    }
    // score with the *post-patch* view of the row
    const view = Object.assign({}, inv, patch);
    const res = computeFitScore(view, STARTUP);
    patch.fit_score = res.overall;
    patch.fit_score_breakdown = { factors: res.factors, confidence: res.confidence, dataQuality: res.dataQuality };
    patch.data_quality_score = res.dataQuality;
    patch.outreach_readiness = res.readiness;
    patch.qualification_notes = notes ? Object.assign({}, inv.qualification_notes || {}, notes) : inv.qualification_notes || null;

    const b = (s) => (s >= 80 ? ">=80" : s >= 70 ? "70-79" : s >= 50 ? "50-69" : "<50");
    if (isRegion) {
      summary.fitBefore[b(inv.fit_score || 0)] += 1;
      summary.fitAfter[b(res.overall)] += 1;
      if (inv.outreach_readiness === "ready") summary.readyBefore++;
      if (res.readiness === "ready") summary.readyAfter++;
    }
    updates.push(Object.assign({ id: inv.id }, patch));
  }
  console.log("\nChanges for region US/UK/EU focus (computed on all active rows):");
  console.log("  emails attached:", summary.emailAttached, "| linkedins attached:", summary.linkedinAttached, "| region rows:", summary.regionRows);
  console.log("  fit bins before:", JSON.stringify(summary.fitBefore));
  console.log("  fit bins after :", JSON.stringify(summary.fitAfter));
  console.log("  ready before/after:", summary.readyBefore, "/", summary.readyAfter);

  // 3. Local copies (JSON + CSV) — full qualified dataset
  fs.mkdirSync("data-backups/qualified", { recursive: true });
  fs.writeFileSync(`data-backups/qualified/investors-qualified-${TAG}.json`, JSON.stringify(updates, null, 0));
  const csvCols = ["id", "full_name", "email", "linkedin_url", "fit_score", "outreach_readiness", "data_quality_score", "country", "investor_type"];
  const esc = (v) => {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("|") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // join updates with names for CSV
  const byId = new Map(all.map((r) => [r.id, r]));
  let csv = csvCols.join(",") + "\n";
  for (const u of updates) {
    const r = byId.get(u.id) || {};
    csv += csvCols.map((c) => esc(c === "full_name" ? r.full_name : c === "investor_type" ? r.investor_type : u[c])).join(",") + "\n";
  }
  fs.writeFileSync(`data-backups/qualified/investors-qualified-${TAG}.csv`, csv);
  console.log(`local copies written: investors-qualified-${TAG}.json / .csv (${updates.length} rows)`);

  if (!PUSH) { console.log("\nDRY RUN ONLY — rerun with --push to write to Supabase."); process.exit(0); }

  // 4. Push via upsert (merges only provided columns; rows exist so it's an UPDATE)
  let pushed = 0; const failed = [];
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH).map((u) => {
      const { id, ...rest } = u;
      // NOT NULL columns must be present in the proposed row even for conflict-update upserts
      const r = byId.get(id) || {};
      return Object.assign({ id, full_name: r.full_name, investor_type: r.investor_type, source: r.source, created_at: r.created_at }, rest);
    });
    const doUpsert = async () => {
      const { error } = await svc.from("investors").upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
    };
    let ok = false;
    for (let att = 0; att < 4 && !ok; att++) {
      try { await doUpsert(); ok = true; } catch (e) {
        console.log(`    batch ${i} attempt ${att + 1} failed: ${e.message}. retrying…`);
        await new Promise((r) => setTimeout(r, 1500 * (att + 1)));
      }
    }
    if (!ok) { failed.push(i); continue; }
    pushed += chunk.length;
    console.log(`  pushed ${pushed} / ${updates.length}`);
  }
  console.log(`\n✅ Pushed ${pushed} rows to Supabase.`);
  if (failed.length) console.error(`❌ ${failed.length} batches failed at offsets: ${failed.join(",")}`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
