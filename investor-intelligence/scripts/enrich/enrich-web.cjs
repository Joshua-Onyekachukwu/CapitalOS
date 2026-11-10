#!/usr/bin/env node
/**
 * Website enrichment for EDGAR-enriched candidates.
 *
 * No search engine is used (they block automated queries from this host).
 * Instead the engine derives a small set of plausible domains from the fund
 * name, fetches them, and accepts one only when the page independently proves
 * it is that investor: the distinctive name token appears on the page AND the
 * page talks about investing. Anything weaker is rejected.
 *
 * Accepted pages yield: website, stage focus, cheque ranges (original
 * currency), sector mentions, public emails, LinkedIn, application URL.
 *
 * Output is local only (investor-intelligence/data/enriched/web/). No DB writes.
 *
 *   node investor-intelligence/scripts/enrich/enrich-web.cjs --limit 40 --venture
 */

const fs = require("fs");
const path = require("path");
const { setTimeout: sleep } = require("timers/promises");

const ROOT = path.resolve(__dirname, "../../..");
const DATA = path.join(ROOT, "investor-intelligence/data");
const EDGAR_DIR = path.join(DATA, "enriched", "edgar");
const OUT_DIR = path.join(DATA, "enriched", "web");
const REPORT_DIR = path.join(DATA, "reports");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CapitalOSResearch/1.0";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const VENTURE_ONLY = args.includes("--venture");
const LIMIT = args.includes("--all") ? Infinity : Number(flag("limit", "40"));
const OFFSET = Number(flag("offset", "0"));
const CONCURRENCY = Math.min(12, Number(flag("concurrency", "8")));
const RUN_ID = flag("run", new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14));

let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 120;
  if (slot > now) await sleep(slot - now);
}

const LEGAL = new Set([
  "llc", "l", "c", "lp", "llp", "ltd", "limited", "inc", "incorporated", "corp", "corporation",
  "plc", "gmbh", "ag", "bv", "nv", "sarl", "sas", "sa", "pte", "pty", "gp", "co", "company",
  "holdings", "holding", "management", "mgmt", "advisors", "advisers", "administration", "admin",
]);
const GENERIC = new Set([
  "fund", "funds", "capital", "ventures", "venture", "partners", "partner", "investment",
  "investments", "equity", "group", "series", "the", "of", "and", "a", "an", "vc", "micro",
  "seed", "preseed", "pre", "early", "stage", "opportunity", "spv", "feeder", "aggregator",
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "1", "2", "3", "4", "5",
]);
const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/;

const STOP = new Set(["the", "of", "and", "for", "with", "by", "at", "in", "on", "to", "a", "an"]);

function tokensOf(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !LEGAL.has(t) && !STOP.has(t))
    .filter((t) => !/^\d{4}$/.test(t));
}

function deriveCandidates(name) {
  const words = tokensOf(name);
  // Anything after "series" is a vehicle suffix, not the manager's name.
  const seriesIdx = words.indexOf("series");
  const core = (seriesIdx > 0 ? words.slice(0, seriesIdx) : words).filter((w) => !ROMAN.test(w));
  const distinctive = core.filter((w) => !GENERIC.has(w) && w.length >= 3);
  const first = distinctive[0];
  const lastGeneric = [...core].reverse().find((w) => GENERIC.has(w) && w !== "series");
  const variants = new Set();
  const full = core.join("");
  const dist = distinctive.join("");
  if (dist.length >= 4) {
    variants.add(`${dist}.com`);
    variants.add(`${dist}.vc`);
    variants.add(`${dist}.capital`);
  }
  if (full.length >= 4) variants.add(`${full}.com`);
  if (first && lastGeneric) variants.add(`${first}${lastGeneric}.com`);
  if (first && first.length >= 6) variants.add(`${first}.com`);
  return { hostnames: [...variants].slice(0, 6), keyTokens: distinctive, core };
}

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

function pageText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return decodeEntities((html.match(re) || html.match(alt) || [])[1] || "");
}

const PARKED = /(domain (is|may be) for sale|buy this domain|this domain is parked|sedo\.com|afternic|godaddy\.com\/domainsearch)/i;

const STAGE_PATTERNS = [
  { key: "pre_seed", re: /\bpre[- ]?seed\b/i },
  { key: "seed", re: /\bseed(?:[- ]stage)?\b/i },
  { key: "series_a", re: /\bseries a\b/i },
  { key: "series_b", re: /\bseries b\b/i },
];

const SECTORS = {
  ai: /\b(artificial intelligence|machine learning|generative ai|\bai\b|\bml\b)\b/i,
  saas: /\b(saas|software as a service|b2b software)\b/i,
  fintech: /\b(fintech|financial technology|payments|banking infrastructure)\b/i,
  healthtech: /\b(healthtech|health tech|digital health|biotech|life sciences)\b/i,
  climate: /\b(climate|cleantech|decarboni[sz]ation|energy transition)\b/i,
  deeptech: /\b(deep tech|deeptech|quantum|semiconductors|robotics|space)\b/i,
  devtools: /\b(developer tools|devtools|infrastructure|api)\b/i,
  consumer: /\b(consumer|marketplace|e-?commerce|dtc)\b/i,
  proptech: /\b(proptech|real estate technology)\b/i,
  logistics: /\b(logistics|supply chain|mobility)\b/i,
  edtech: /\b(edtech|education technology)\b/i,
  web3: /\b(web3|crypto|blockchain|defi)\b/i,
  cybersecurity: /\b(cybersecurity|security)\b/i,
};

function extractCheques(text) {
  const out = [];
  const re =
    /(?:[$€£]\s?\d[\d,.]*\s?(?:k|m|mm|million|thousand)?)\s*(?:-|–|—|to)\s*(?:[$€£]\s?\d[\d,.]*\s?(?:k|m|mm|million|thousand)?)/gi;
  for (const m of text.matchAll(re)) {
    const raw = m[0].replace(/\s+/g, " ");
    if (out.length < 4 && !out.includes(raw)) out.push(raw);
  }
  return out;
}

function extractEmails(html, text) {
  const set = new Set();
  for (const m of html.matchAll(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)) set.add(m[1].toLowerCase());
  for (const m of text.matchAll(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi)) set.add(m[1].toLowerCase());
  return [...set]
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e))
    .filter((e) => !/^(example|test)@/.test(e))
    .slice(0, 6);
}

const robotsCache = new Map();
async function allowedByRobots(origin, pathname) {
  let rules = robotsCache.get(origin);
  if (rules === undefined) {
    rules = [];
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const txt = await res.text();
        let applies = false;
        for (const line of txt.split(/\r?\n/)) {
          const l = line.trim();
          if (/^user-agent:/i.test(l)) applies = /:\s*\*/.test(l) || /capitalos/i.test(l);
          if (applies && /^disallow:/i.test(l)) {
            const p = l.replace(/^disallow:/i, "").trim();
            if (p) rules.push(p);
          }
        }
      }
    } catch {
      /* no robots.txt or unreachable: treat as allowed */
    }
    robotsCache.set(origin, rules);
  }
  return !rules.some((r) => r === "/" || pathname.startsWith(r.replace(/\*$/, "")));
}

async function get(url, attempt = 0) {
  await throttle();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { status: res.status, url: res.url, html: null };
    const ct = res.headers.get("content-type") || "";
    if (!/html|text/i.test(ct)) return { status: res.status, url: res.url, html: null };
    return { status: res.status, url: res.url, html: await res.text() };
  } catch (err) {
    if (attempt < 2) {
      await sleep(800 * (attempt + 1));
      return get(url, attempt + 1);
    }
    return { status: 0, url, html: null, error: err.message };
  }
}

function verify(html, finalUrl, keyTokens, name) {
  const text = pageText(html);
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  const desc = meta(html, "description");
  if (text.length < 250 || PARKED.test(text + " " + title)) return null;

  const host = (() => {
    try {
      return new URL(finalUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const hay = `${host} ${title} ${desc} ${text.slice(0, 12000)}`.toLowerCase();
  const token = keyTokens.sort((a, b) => b.length - a.length)[0];
  if (!token || token.length < 4) return null;
  const nameMatch = host.includes(token) || new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay);
  const investHits = [
    /\binvest(or|ing|ment|ments)?\b/i,
    /\bventure\b/i,
    /\bportfolio\b/i,
    /\bstartups?\b/i,
    /\bfounders?\b/i,
    /\bfund\b/i,
  ].filter((r) => r.test(hay)).length;

  if (!nameMatch || investHits < 2) return null;
  const confidence = host.includes(token) ? 0.85 : 0.65;
  return { text, title, desc, host, nameMatch, investHits, confidence };
}

function extract(html, text, finalUrl) {
  const stage_mentions = STAGE_PATTERNS.filter((s) => s.re.test(text)).map((s) => s.key);
  const stage_focus = [];
  if (/\bpre[- ]?seed\b/i.test(text) && /\bseed\b/i.test(text)) stage_focus.push("pre_seed", "seed");
  else if (/\bpre[- ]?seed\b/i.test(text)) stage_focus.push("pre_seed");
  else if (/\bseed\b/i.test(text)) stage_focus.push("seed");

  const sectors = Object.entries(SECTORS)
    .filter(([, re]) => re.test(text))
    .map(([k]) => k);

  const emails = extractEmails(html, text);
  const linkedin = (html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_%\-/.]+/i) || [])[0] || null;
  const twitter = (html.match(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+/i) || [])[0] || null;
  const application = (() => {
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{0,80})<\/a>/gi;
    for (const m of html.matchAll(re)) {
      const href = m[1];
      const label = (m[2] || "").toLowerCase();
      if (/apply|pitch|submit|contact/i.test(label + " " + href)) {
        try {
          return new URL(href, finalUrl).toString();
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  })();

  return {
    stage_mentions,
    stage_focus: stage_focus.length ? [...new Set(stage_focus)] : [],
    cheque_ranges_text: extractCheques(text),
    sectors,
    emails,
    linkedin_url: linkedin,
    twitter_url: twitter,
    application_url: application,
    page_title: decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim(),
    description: meta(html, "description") || null,
  };
}

function loadEdgar() {
  if (!fs.existsSync(EDGAR_DIR)) throw new Error("run enrich-edgar first");
  const rows = [];
  const seen = new Set();
  for (const f of fs.readdirSync(EDGAR_DIR)) {
    if (!f.endsWith(".jsonl")) continue;
    for (const line of fs.readFileSync(path.join(EDGAR_DIR, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let j;
      try {
        j = JSON.parse(line);
      } catch {
        continue;
      }
      if (!j.candidate_id || seen.has(j.candidate_id)) continue;
      seen.add(j.candidate_id);
      rows.push(j);
    }
  }
  return rows;
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
        if (j.candidate_id) done.add(j.candidate_id);
      } catch {
        /* ignore */
      }
    }
  }
  return done;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  let rows = loadEdgar();
  if (VENTURE_ONLY) rows = rows.filter((r) => r.signals?.is_venture_fund);
  const done = loadDone();
  const queue = rows.filter((r) => !done.has(r.candidate_id)).slice(OFFSET, OFFSET + LIMIT);
  console.log(`web enrichment: ${rows.length} eligible, ${done.size} done, ${queue.length} this run`);

  const outFile = path.join(OUT_DIR, `records-${RUN_ID}.jsonl`);
  const out = fs.createWriteStream(outFile, { flags: "a" });
  const stats = {
    run_id: RUN_ID,
    started_at: new Date().toISOString(),
    eligible: rows.length,
    attempted: 0,
    domains_tried: 0,
    sites_fetched: 0,
    accepted: 0,
    rejected: 0,
    no_domain_response: 0,
    with_stage: 0,
    with_cheque_text: 0,
    with_sectors: 0,
    with_email: 0,
    with_linkedin: 0,
    out_file: outFile,
  };

  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const r = queue[cursor++];
      stats.attempted += 1;
      const { hostnames, keyTokens } = deriveCandidates(r.full_name);
      let accepted = null;
      for (const host of hostnames) {
        stats.domains_tried += 1;
        let origin;
        try {
          origin = new URL(`https://${host}`).origin;
        } catch {
          continue;
        }
        if (!(await allowedByRobots(origin, "/"))) continue;
        const res = await get(`${origin}/`);
        if (!res.html) {
          stats.no_domain_response += 1;
          continue;
        }
        stats.sites_fetched += 1;
        const verdict = verify(res.html, res.url || origin, [...keyTokens], r.full_name);
        if (!verdict) {
          stats.rejected += 1;
          continue;
        }
        accepted = { host, url: res.url || origin, verdict, fields: extract(res.html, verdict.text, res.url || origin) };
        break;
      }

      if (!accepted) {
        out.write(
          JSON.stringify({
            candidate_id: r.candidate_id,
            full_name: r.full_name,
            status: "no_verified_site",
            tried: hostnames,
            at: new Date().toISOString(),
          }) + "\n"
        );
        continue;
      }

      stats.accepted += 1;
      const f = accepted.fields;
      if (f.stage_focus.length) stats.with_stage += 1;
      if (f.cheque_ranges_text.length) stats.with_cheque_text += 1;
      if (f.sectors.length) stats.with_sectors += 1;
      if (f.emails.length) stats.with_email += 1;
      if (f.linkedin_url) stats.with_linkedin += 1;

      out.write(
        JSON.stringify({
          candidate_id: r.candidate_id,
          full_name: r.full_name,
          cik: r.cik,
          fund_type: r.edgar?.fund_type || null,
          status: "verified_site",
          website: `https://${accepted.host}`,
          final_url: accepted.url,
          confidence: accepted.verdict.confidence,
          basis: "derived_domain_verified",
          fields: f,
          evidence: {
            name_match: accepted.verdict.nameMatch,
            investment_signals: accepted.verdict.investHits,
            page_title: f.page_title,
          },
          fetched_at: new Date().toISOString(),
        }) + "\n"
      );
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  out.end();
  await sleep(300);
  stats.finished_at = new Date().toISOString();
  stats.runtime_seconds = Math.round((Date.now() - started) / 1000);
  stats.accept_rate = stats.attempted ? +(stats.accepted / stats.attempted).toFixed(3) : 0;
  const reportFile = path.join(REPORT_DIR, `enrich-web-${RUN_ID}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(stats, null, 2) + "\n");
  console.log(JSON.stringify(stats, null, 2));
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
