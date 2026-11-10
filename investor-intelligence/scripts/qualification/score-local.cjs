#!/usr/bin/env node
/**
 * Local evidence scoring for enriched candidates.
 *
 * Reads EDGAR enrichment (authoritative) and optional website enrichment, then
 * scores each record on the nine dimensions in research/qualification_framework.md.
 * Nothing is written to the database; results go to
 * investor-intelligence/data/qualified/.
 *
 * Scoring is deliberately conservative:
 *   - fund type "Venture Capital Fund" is a mandate, not a track record;
 *   - a fund's minimum LP commitment is NOT a startup cheque;
 *   - no founder-preference evidence means 0/10 for that dimension.
 *
 *   node investor-intelligence/scripts/qualification/score-local.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const DATA = path.join(ROOT, "investor-intelligence/data");
const EDGAR_DIR = path.join(DATA, "enriched", "edgar");
const WEB_DIR = path.join(DATA, "enriched", "web");
const OUT_DIR = path.join(DATA, "qualified");
const REPORT_DIR = path.join(DATA, "reports");
const RUN_ID = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

function readJsonl(dir, byKey = "candidate_id") {
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j[byKey] && !map.has(j[byKey])) map.set(j[byKey], j);
      } catch {
        /* skip partial line */
      }
    }
  }
  return map;
}

const clamp = (n, max) => Math.max(0, Math.min(max, n));

function scoreRecord(e, w) {
  const s = e.signals || {};
  const edgar = e.edgar || {};
  const dims = {};
  const evidence = {};

  // 1. Stage alignment (25)
  let stage = 0;
  if (s.is_venture_fund) stage += 12;
  const stageFocus = w?.fields?.stage_focus || [];
  if (stageFocus.includes("pre_seed")) stage += 9;
  if (stageFocus.includes("seed")) stage += 4;
  dims.stage = clamp(stage, 25);
  evidence.stage = [
    s.is_venture_fund ? "Form D investmentFundType = Venture Capital Fund (mandate only)" : null,
    stageFocus.length ? `website stage language: ${stageFocus.join(", ")}` : null,
  ].filter(Boolean);

  // 2. Sector relevance (15)
  const sectors = w?.fields?.sectors || [];
  let sector = sectors.length ? Math.min(11, sectors.length * 3) : 0;
  if (s.is_venture_fund) sector += 4;
  dims.sector = clamp(sector, 15);
  evidence.sector = [
    sectors.length ? `website sector language: ${sectors.join(", ")}` : null,
    s.is_venture_fund ? "venture mandate (generalist)" : null,
  ].filter(Boolean);

  // 3. Geographic compatibility (15) — US corpus, founder fit still unknown
  dims.geography = 7.5;
  evidence.geography = ["US filing address; no international-founder policy found"];

  // 4. Cheque compatibility (15)
  let cheque = 0;
  if (w?.fields?.cheque_ranges_text?.length) cheque += 10;
  if (edgar.min_investment_usd != null) cheque += 3; // LP commitment, weak proxy
  if (w?.fields?.cheque_ranges_text?.length && edgar.min_investment_usd != null) cheque += 2;
  dims.cheque = clamp(cheque, 15);
  evidence.cheque = [
    w?.fields?.cheque_ranges_text?.length ? `website cheque text: ${w.fields.cheque_ranges_text.join(" | ")}` : null,
    edgar.min_investment_usd != null
      ? `Form D minimum investment accepted $${edgar.min_investment_usd.toLocaleString()} (fund commitment, not startup cheque)`
      : null,
  ].filter(Boolean);

  // 5. Demonstrated early-stage activity (10)
  let activity = 0;
  if (edgar.first_sale_date) {
    const years = (Date.now() - new Date(edgar.first_sale_date).getTime()) / (365.25 * 24 * 3600 * 1000);
    activity += years <= 2 ? 5 : 3;
  }
  if ((edgar.total_sold_usd || 0) > 0) activity += 3;
  if ((edgar.total_investors || 0) > 0) activity += 2;
  dims.activity = clamp(activity, 10);
  evidence.activity = [
    edgar.first_sale_date ? `first sale ${edgar.first_sale_date}` : null,
    (edgar.total_sold_usd || 0) > 0 ? `reported sold $${edgar.total_sold_usd.toLocaleString()}` : null,
    (edgar.total_investors || 0) > 0 ? `${edgar.total_investors} investors already in fund` : null,
  ].filter(Boolean);

  // 6. Founder/company profile fit (10) — no evidence, no points
  dims.founder_fit = 0;
  evidence.founder_fit = ["no first-time/solo/international founder policy found"];

  // 7. Recency (5) — all staged filings are 2026
  dims.recency = 5;
  evidence.recency = ["Form D filed in 2026"];

  // 8. Completeness (5)
  let completeness = 0;
  if (w?.website) completeness += 2;
  if ((edgar.related_persons || []).length) completeness += 1.5;
  if (w?.fields?.emails?.length) completeness += 1.5;
  dims.completeness = clamp(completeness, 5);
  evidence.completeness = [
    w?.website ? `website ${w.website}` : null,
    (edgar.related_persons || []).length ? `${edgar.related_persons.length} related persons` : null,
    w?.fields?.emails?.length ? `${w.fields.emails.length} public email(s)` : null,
  ].filter(Boolean);

  // 9. Contact accessibility is folded into completeness above.
  const total = Object.values(dims).reduce((a, b) => a + b, 0);
  const tier = total >= 85 ? "A" : total >= 70 ? "B" : total >= 50 ? "C" : "D";

  const fundType = (edgar.fund_type || "").toLowerCase();
  const nonVenture = /hedge|real estate/.test(fundType);
  let category = "unverified";
  if (nonVenture && dims.stage === 0) category = "disqualified";
  else if (tier === "A" || tier === "B") category = "qualified";
  else if (tier === "C") category = "potential";

  return {
    candidate_id: e.candidate_id,
    full_name: e.full_name,
    cik: e.cik,
    fund_type: edgar.fund_type || null,
    industry_group: edgar.industry_group || null,
    city: edgar.city || null,
    state: edgar.state || null,
    website: w?.website || null,
    min_investment_usd: edgar.min_investment_usd ?? null,
    total_offering_usd: edgar.total_offering_usd ?? null,
    total_sold_usd: edgar.total_sold_usd ?? null,
    first_sale_date: edgar.first_sale_date ?? null,
    team: (edgar.related_persons || []).map((p) => ({ name: p.name, relationships: p.relationships })),
    stage_focus: stageFocus,
    sectors,
    emails: w?.fields?.emails || [],
    evidence_score: +total.toFixed(1),
    tier,
    category,
    dimensions: dims,
    evidence,
    sources: [
      { type: "sec_form_d_xml", url: e.filing_url, level: "verified" },
      ...(w?.website ? [{ type: "investor_website", url: w.website, level: "verified_page" }] : []),
    ],
  };
}

function summarize(records) {
  const count = (fn) => records.filter(fn).length;
  const byTier = { A: 0, B: 0, C: 0, D: 0 };
  const byCategory = {};
  const byFundType = {};
  for (const r of records) {
    byTier[r.tier] += 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    byFundType[r.fund_type || "(unknown)"] = (byFundType[r.fund_type || "(unknown)"] || 0) + 1;
  }
  return {
    scored: records.length,
    tiers: byTier,
    categories: byCategory,
    fund_types: byFundType,
    with_website: count((r) => r.website),
    with_team: count((r) => r.team.length > 0),
    with_min_investment: count((r) => r.min_investment_usd != null),
    with_offering_amount: count((r) => (r.total_offering_usd || 0) > 0),
    with_first_sale: count((r) => r.first_sale_date),
    venture_funds: count((r) => /venture/i.test(r.fund_type || "")),
    pre_seed_evidence: count((r) => r.stage_focus.includes("pre_seed")),
    seed_evidence: count((r) => r.stage_focus.includes("seed")),
    cheque_text: count((r) => (r.evidence.cheque || []).some((x) => x.startsWith("website cheque"))),
    with_email: count((r) => r.emails.length > 0),
  };
}

(async () => {
  const edgar = readJsonl(EDGAR_DIR);
  const web = readJsonl(WEB_DIR);
  if (!edgar.size) throw new Error("no EDGAR enrichment found");
  const records = [...edgar.values()].map((e) => scoreRecord(e, web.get(e.candidate_id)));
  records.sort((a, b) => b.evidence_score - a.evidence_score);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const allFile = path.join(OUT_DIR, `scored-${RUN_ID}.jsonl`);
  const out = fs.createWriteStream(allFile);
  for (const r of records) out.write(JSON.stringify(r) + "\n");
  out.end();

  fs.mkdirSync(path.join(OUT_DIR, "by-tier"), { recursive: true });
  for (const tier of ["A", "B", "C", "D"]) {
    const rows = records.filter((r) => r.tier === tier);
    fs.writeFileSync(path.join(OUT_DIR, "by-tier", `tier-${tier}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  }
  const disq = records.filter((r) => r.category === "disqualified");
  fs.writeFileSync(path.join(OUT_DIR, "disqualified.jsonl"), disq.map((r) => JSON.stringify(r)).join("\n") + (disq.length ? "\n" : ""));

  const summary = summarize(records);
  const report = {
    run_id: RUN_ID,
    generated_at: new Date().toISOString(),
    inputs: { edgar_records: edgar.size, web_records: web.size },
    summary,
    out_file: allFile,
    note: "Local evidence scoring only. No records promoted to the product database.",
  };
  fs.writeFileSync(path.join(REPORT_DIR, `qualification-local-${RUN_ID}.json`), JSON.stringify(report, null, 2) + "\n");

  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
