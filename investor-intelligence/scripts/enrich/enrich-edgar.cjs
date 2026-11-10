#!/usr/bin/env node
/**
 * EDGAR Form D enrichment.
 *
 * For every staged candidate, fetches the filing's primary_doc.xml and extracts
 * authoritative fields the search index does not carry:
 *   - fund type (Venture Capital Fund / Private Equity Fund / Hedge Fund / Other)
 *   - minimum investment accepted (USD) — a fund commitment, NOT a startup cheque
 *   - total offering amount, amount sold, investor count (fund-size proxies)
 *   - date of first sale, year incorporated, jurisdiction
 *   - related persons: names and relationships (the decision-maker seed)
 *
 * Writes only to the local repository. No database writes.
 *
 *   node investor-intelligence/scripts/enrich/enrich-edgar.cjs --limit 50
 *   node investor-intelligence/scripts/enrich/enrich-edgar.cjs --all
 */

const fs = require("fs");
const path = require("path");
const { setTimeout: sleep } = require("timers/promises");

const ROOT = path.resolve(__dirname, "../../..");
const DATA = path.join(ROOT, "investor-intelligence/data");
const PROCESSED = path.join(DATA, "processed", "sec-formd");
const OUT_DIR = path.join(DATA, "enriched", "edgar");
const REPORT_DIR = path.join(DATA, "reports");
const UA = process.env.SEC_USER_AGENT || "CapitalOS Research contact@capital-os.com";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const LIMIT = args.includes("--all") ? Infinity : Number(flag("limit", "25"));
const OFFSET = Number(flag("offset", "0"));
const CONCURRENCY = Math.min(8, Number(flag("concurrency", "5")));
const MIN_INTERVAL_MS = Number(flag("interval", "130"));
const RUN_ID = flag("run", new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14));

// ---------------------------------------------------------------- rate limit
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

// ---------------------------------------------------------------- parsing
const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  if (!m) return null;
  const inner = m[1].trim();
  if (inner.startsWith("<")) return null; // wrapper element, read its children instead
  return decode(inner) || null;
};

const block = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : null;
};

const blocks = (xml, name) => [
  ...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "g")),
].map((m) => m[1]);

const money = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

const dateValue = (xml, name) => {
  const b = block(xml, name);
  if (!b) return { date: null, yet_to_occur: null };
  return { date: tag(b, "value"), yet_to_occur: tag(b, "yetToOccur") === "true" };
};

function parsePrimaryDoc(xml) {
  const issuer = block(xml, "primaryIssuer") || "";
  const address = block(issuer, "issuerAddress") || "";
  const offering = block(xml, "offeringData") || "";
  const industry = block(offering, "industryGroup") || "";
  const fundInfo = block(offering, "investmentFundInfo") || "";
  const sales = block(offering, "offeringSalesAmounts") || "";
  const investors = block(offering, "investors") || "";
  const yearInc = block(issuer, "yearOfInc") || "";
  const firstSale = dateValue(offering, "dateOfFirstSale");

  const persons = blocks(xml, "relatedPersonInfo").map((p) => {
    const nameBlock = block(p, "relatedPersonName") || "";
    const first = tag(nameBlock, "firstName");
    const last = tag(nameBlock, "lastName");
    const mid = tag(nameBlock, "middleName");
    const addr = block(p, "relatedPersonAddress") || "";
    return {
      name: [first, mid, last].filter(Boolean).join(" ") || null,
      relationships: blocks(p, "relationship").map(decode),
      city: tag(addr, "city"),
      state: tag(addr, "stateOrCountry"),
    };
  }).filter((p) => p.name);

  const fundType = tag(fundInfo, "investmentFundType") || tag(offering, "investmentFundType");
  const industryGroup = tag(industry, "industryGroupType") || tag(offering, "industryGroupType");

  return {
    entity_name: tag(issuer, "entityName") || tag(xml, "entityName"),
    city: tag(address, "city"),
    state: tag(address, "stateOrCountry"),
    zip: tag(address, "zipCode"),
    phone: tag(issuer, "issuerPhoneNumber"),
    jurisdiction: tag(issuer, "jurisdictionOfInc"),
    year_incorporated: tag(yearInc, "value"),
    industry_group: industryGroup,
    fund_type: fundType,
    is_40_act: tag(fundInfo, "is40Act"),
    revenue_range: tag(block(offering, "issuerSize") || "", "revenueRange") || tag(offering, "revenueRange"),
    min_investment_usd: money(tag(offering, "minimumInvestmentAccepted")),
    total_offering_usd: money(tag(sales, "totalOfferingAmount")),
    total_sold_usd: money(tag(sales, "totalAmountSold")),
    total_remaining_usd: money(tag(sales, "totalRemaining")),
    total_investors: money(tag(investors, "totalNumberAlreadyInvested")),
    first_sale_date: firstSale.date,
    first_sale_yet_to_occur: firstSale.yet_to_occur,
    related_persons: persons,
  };
}

const classifySignals = (e) => {
  const ft = (e.fund_type || "").toLowerCase();
  return {
    is_venture_fund: /venture/.test(ft),
    is_private_equity_fund: /private equity/.test(ft),
    is_hedge_fund: /hedge/.test(ft),
    is_real_estate_fund: /real estate/.test(ft),
    is_pooled: /pooled/.test((e.industry_group || "").toLowerCase()),
    team_count: e.related_persons.length,
    // A fund's minimum LP commitment is not a startup cheque. Kept separate.
    commitment_band:
      e.min_investment_usd == null
        ? null
        : e.min_investment_usd <= 25_000
        ? "under_25k"
        : e.min_investment_usd <= 100_000
        ? "25k_100k"
        : e.min_investment_usd <= 250_000
        ? "100k_250k"
        : e.min_investment_usd <= 1_000_000
        ? "250k_1m"
        : "over_1m",
  };
};

// ---------------------------------------------------------------- fetch
async function fetchText(url, attempt = 0) {
  await throttle();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml,text/xml,application/json,*/*" },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { status: 404, text: null };
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 60;
      console.log(`rate limited by SEC; pausing ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      if (attempt < 6) return fetchText(url, attempt + 1);
      return { status: 429, text: null, error: "rate limited" };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: res.status, text: await res.text() };
  } catch (err) {
    if (attempt < 3) {
      await sleep(1500 * (attempt + 1));
      return fetchText(url, attempt + 1);
    }
    return { status: 0, text: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function docUrl(cik, adsh) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh.replace(/-/g, "")}/primary_doc.xml`;
}

async function fetchPrimaryDoc(cik, adsh) {
  const primary = docUrl(cik, adsh);
  let r = await fetchText(primary);
  if (r.text) return { url: primary, xml: r.text, via: "primary_doc.xml" };

  // Fallback: list the filing folder and take its XML document.
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh.replace(/-/g, "")}/index.json`;
  const idx = await fetchText(indexUrl);
  if (idx.text) {
    try {
      const items = JSON.parse(idx.text).directory?.item || [];
      const xml = items.find((i) => /\.xml$/i.test(i.name) && !/^R\d+/i.test(i.name));
      if (xml) {
        const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh.replace(/-/g, "")}/${xml.name}`;
        const r2 = await fetchText(url);
        if (r2.text) return { url, xml: r2.text, via: xml.name };
      }
    } catch {
      /* fall through */
    }
  }
  return { url: primary, xml: null, via: null };
}

// ---------------------------------------------------------------- inputs
function loadCandidates() {
  if (!fs.existsSync(PROCESSED)) throw new Error(`no processed data at ${PROCESSED}`);
  const files = [];
  for (const dir of fs.readdirSync(PROCESSED)) {
    const f = path.join(PROCESSED, dir, "candidates.jsonl");
    if (fs.existsSync(f)) files.push(f);
  }
  const seen = new Set();
  const out = [];
  for (const f of files) {
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let j;
      try {
        j = JSON.parse(line);
      } catch {
        continue;
      }
      const cik = j.raw?.source?.ciks?.[0];
      if (!cik || !j.source_id || seen.has(j.source_id)) continue;
      seen.add(j.source_id);
      out.push({
        source_id: j.source_id,
        full_name: j.full_name,
        normalized_name: j.normalized_name,
        city: j.city,
        region: j.region,
        country: j.country,
        confidence: j.confidence,
        cik,
      });
    }
  }
  return out;
}

function loadDone() {
  const done = new Set();
  if (!fs.existsSync(OUT_DIR)) return done;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith(".jsonl")) continue;
    for (const line of fs.readFileSync(path.join(OUT_DIR, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j?.candidate_id) done.add(j.candidate_id);
      } catch {
        /* ignore truncated line */
      }
    }
  }
  return done;
}

// ---------------------------------------------------------------- run
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const all = loadCandidates();
  const done = loadDone();
  const queue = all.filter((c) => !done.has(c.source_id)).slice(OFFSET, OFFSET + LIMIT);
  console.log(
    `candidates: ${all.length} total, ${done.size} already enriched, ${queue.length} in this run ` +
      `(concurrency ${CONCURRENCY}, ${MIN_INTERVAL_MS}ms interval)`
  );

  const outFile = path.join(OUT_DIR, `records-${RUN_ID}.jsonl`);
  const out = fs.createWriteStream(outFile, { flags: "a" });
  const errorFile = path.join(DATA, "logs", "errors", `edgar-${RUN_ID}.jsonl`);
  fs.mkdirSync(path.dirname(errorFile), { recursive: true });
  const errors = fs.createWriteStream(errorFile, { flags: "a" });

  const startedAt = Date.now();
  const stats = {
    run_id: RUN_ID,
    started_at: new Date().toISOString(),
    attempted: 0,
    fetched: 0,
    failed: 0,
    parsed: 0,
    with_fund_type: 0,
    with_min_investment: 0,
    with_team: 0,
    with_offering_amount: 0,
    venture_funds: 0,
    private_equity_funds: 0,
    other_funds: 0,
    by_fund_type: {},
    out_file: outFile,
    error_file: errorFile,
  };

  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const c = queue[cursor++];
      stats.attempted += 1;
      if (stats.attempted % 100 === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        console.log(
          `progress ${stats.attempted}/${queue.length} parsed=${stats.parsed} failed=${stats.failed} ` +
            `${(stats.attempted / Math.max(1, elapsed)).toFixed(1)}/s`
        );
      }
      const { url, xml, via } = await fetchPrimaryDoc(c.cik, c.source_id);
      if (!xml) {
        stats.failed += 1;
        errors.write(JSON.stringify({ candidate_id: c.source_id, name: c.full_name, url, at: new Date().toISOString() }) + "\n");
        continue;
      }
      stats.fetched += 1;
      let edgar;
      try {
        edgar = parsePrimaryDoc(xml);
      } catch (e) {
        stats.failed += 1;
        errors.write(JSON.stringify({ candidate_id: c.source_id, name: c.full_name, error: e.message }) + "\n");
        continue;
      }
      if (!edgar.entity_name && !edgar.fund_type) {
        stats.failed += 1;
        errors.write(JSON.stringify({ candidate_id: c.source_id, name: c.full_name, error: "unparsed xml", url }) + "\n");
        continue;
      }
      stats.parsed += 1;
      const signals = classifySignals(edgar);
      if (edgar.fund_type) {
        stats.with_fund_type += 1;
        stats.by_fund_type[edgar.fund_type] = (stats.by_fund_type[edgar.fund_type] || 0) + 1;
      }
      if (edgar.min_investment_usd != null) stats.with_min_investment += 1;
      if (edgar.related_persons.length) stats.with_team += 1;
      if (edgar.total_offering_usd != null || edgar.total_sold_usd != null) stats.with_offering_amount += 1;
      if (signals.is_venture_fund) stats.venture_funds += 1;
      else if (signals.is_private_equity_fund) stats.private_equity_funds += 1;
      else stats.other_funds += 1;

      out.write(
        JSON.stringify({
          candidate_id: c.source_id,
          full_name: c.full_name,
          normalized_name: c.normalized_name,
          cik: String(c.cik).padStart(10, "0"),
          filing_url: url,
          document: via,
          fetched_at: new Date().toISOString(),
          edgar,
          signals,
          evidence: {
            source: "sec_edgar_form_d_xml",
            level: "verified",
            url,
            note: "fund type, amounts and related persons are as filed by the issuer",
          },
        }) + "\n"
      );
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  out.end();
  errors.end();
  await sleep(300);

  stats.finished_at = new Date().toISOString();
  stats.runtime_seconds = Math.round((Date.now() - started) / 1000);
  stats.records_per_hour = stats.parsed
    ? Math.round((stats.parsed / Math.max(1, stats.runtime_seconds)) * 3600)
    : 0;
  const reportFile = path.join(REPORT_DIR, `enrich-edgar-${RUN_ID}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(stats, null, 2) + "\n");
  console.log(JSON.stringify(stats, null, 2));
}

module.exports = { parsePrimaryDoc, classifySignals, fetchPrimaryDoc, loadCandidates, loadDone };

if (require.main === module) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}
