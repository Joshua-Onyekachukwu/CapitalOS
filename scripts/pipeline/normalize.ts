/**
 * Deterministic normalization — no AI.
 *
 * Everything that can be a pure function is a pure function: name
 * canonicalization, URL/domain/email normalization, country/region mapping,
 * stage/sector vocabularies, check-size parsing, and record id slugs.
 * AI is reserved for genuine ambiguity (see qualify.ts).
 */

import type { Geography, InvestorRecord, Sector, Stage, InvestorType } from "./types";

// ── Name canonicalization ────────────────────────────────────

const LEGAL_SUFFIXES = [
  "llc",
  "l.l.c.",
  "lp",
  "l.p.",
  "llp",
  "l.l.p.",
  "inc",
  "inc.",
  "incorporated",
  "corp",
  "corp.",
  "corporation",
  "ltd",
  "ltd.",
  "limited",
  "plc",
  "sa",
  "ag",
  "gmbh",
  "bv",
  "pty",
  "co",
  "co.",
  "company",
  "holdings",
  "group",
  "partners",
  "management",
  "advisors",
  "advisers",
  "advisor",
  " adviser",
];

export function canonicalizeName(raw: string): string {
  let s = (raw || "").toLowerCase().trim();
  s = s.replace(/&/g, " and ");
  s = s.replace(/[.,’'`]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // strip trailing legal suffixes (repeatedly: "X Management LLC")
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of LEGAL_SUFFIXES) {
      const t = suf.trim();
      if (s.endsWith(" " + t)) {
        s = s.slice(0, -(t.length + 1)).trim();
        changed = true;
      }
    }
  }
  return s;
}

export function slugId(canonicalName: string, provider: string): string {
  // Canonicalize first so "Sequoia Capital", "Sequoia  Capital" and
  // "Sequoia Capital LLC" all produce the same slug.
  const c = canonicalizeName(canonicalName);
  const slug = c.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const p = provider.replace(/[^a-z0-9]+/g, "");
  const hash = simpleHash(canonicalName + "|" + provider);
  return `${slug || "unnamed"}-${p}-${hash}`.slice(0, 96);
}

function simpleHash(s: string): string {
  let h = 5381;
  const norm = s.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ── URL / domain / email normalization ───────────────────────

const URL_PREFIXES = ["https://", "http://", "www."];

export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // strip scheme/host prefix, paths, query, tracking
  for (const p of URL_PREFIXES) s = s.replace(p, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  if (!s || !s.includes(".")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  return s;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return null;
  return s;
}

// ── Geography ────────────────────────────────────────────────

const COUNTRY_TO_REGION: Record<string, Geography> = {
  "united states": "north_america",
  usa: "north_america",
  us: "north_america",
  canada: "north_america",
  mexico: "north_america",
  "united kingdom": "europe",
  uk: "europe",
  england: "europe",
  germany: "europe",
  france: "europe",
  netherlands: "europe",
  switzerland: "europe",
  sweden: "europe",
  spain: "europe",
  italy: "europe",
  ireland: "europe",
  nigeria: "africa",
  kenya: "africa",
  "south africa": "africa",
  egypt: "africa",
  ghana: "africa",
  india: "asia",
  singapore: "asia",
  japan: "asia",
  china: "asia",
  "hong kong": "asia",
  indonesia: "asia",
  israel: "middle_east",
  "united arab emirates": "middle_east",
  uae: "middle_east",
  australia: "oceania",
  "new zealand": "oceania",
  brazil: "south_america",
  argentina: "south_america",
  chile: "south_america",
};

/** IAPD "State/Country" strings often look like "CALIFORNIA", "NEW YORK 12345", "GERMANY". */
const US_STATES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware",
  "florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky",
  "louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi","missouri",
  "montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york",
  "north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont","virginia",
  "washington","west virginia","wisconsin","wyoming","district of columbia","puerto rico",
]);

export interface GeoResult {
  country: string | null;
  city: string | null;
  region: Geography | null;
}

export function normalizeGeography(
  rawLocation: string | null | undefined,
  rawCountry: string | null | undefined
): GeoResult {
  const country = (rawCountry || "").trim().toLowerCase() || null;
  let city: string | null = null;
  let effectiveCountry = country;

  if (rawLocation) {
    let s = rawLocation.trim().toLowerCase();
    // strip zip codes
    s = s.replace(/\b\d{5}(-\d{4})?\b/g, "").trim();
    s = s.replace(/\s+/g, " ");
    if (US_STATES.has(s)) {
      effectiveCountry = "united states";
      city = titleCase(rawLocation.trim().replace(/\b\d{5}(-\d{4})?\b/g, "").trim());
    } else if (COUNTRY_TO_REGION[s]) {
      effectiveCountry = s;
    } else if (s) {
      city = titleCase(s);
    }
  }
  if (country && COUNTRY_TO_REGION[country]) {
    effectiveCountry = country;
  }
  const region = effectiveCountry ? COUNTRY_TO_REGION[effectiveCountry] || null : null;
  return {
    country: effectiveCountry ? titleCase(effectiveCountry) : null,
    city,
    region,
  };
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Stages ───────────────────────────────────────────────────

const STAGE_PATTERNS: Array<[RegExp, Stage]> = [
  [/\bpre[- ]?seed\b/, "pre_seed"],
  [/\bangel\b|\bangel round\b/, "pre_seed"],
  [/\bseed\b/, "seed"],
  [/\bseries a\b|\bseries-a\b/, "series_a"],
  [/\bseries b\b|\bseries-b\b/, "series_b"],
  [/\bseries c\b|\bseries-c\b|\bseries d\b|\bseries e\b|\blater stage\b/, "series_c_plus"],
  [/\bgrowth (stage|equity)\b/, "growth"],
  [/\blate[- ]?stage\b/, "late_stage"],
  [/\bearly[- ]?stage\b|\bearly stage venture\b|\bearly-stage investing\b/, "seed"],
];

export function extractStages(text: string | null | undefined): Stage[] {
  if (!text) return [];
  const s = text.toLowerCase();
  const found = new Set<Stage>();
  for (const [re, stage] of STAGE_PATTERNS) {
    if (re.test(s)) found.add(stage);
  }
  return [...found];
}

// ── Sectors ──────────────────────────────────────────────────

const SECTOR_PATTERNS: Array<[RegExp, Sector]> = [
  [/\bartificial intelligence\b|\bmachine learning\b|\bai\b|\bgen ?ai\b|\bllms?\b/, "ai"],
  [/\bsaas\b|\bsoftware as a service\b/, "saas"],
  [/\bfintech\b|\bfinancial technology\b|\bpayments?\b|\bbanking\b/, "fintech"],
  [/\bhealthtech\b|\bdigital health\b|\bbiotech\b|\bmedtech\b|\bhealth ?care\b|\blife sciences?\b/, "healthtech"],
  [/\bclimate ?tech\b|\bclean ?tech\b|\brenewable|\benergy transition\b|\bsustainability\b/, "climate"],
  [/\bdeeptech\b|\bdeep tech\b|\bhard tech\b|\bnanotech|\bquantum\b|\bspace\b/, "deeptech"],
  [/\bdeveloper tools?\b|\bdev ?tools?\b|\bopen source\b|\binfrastructure software\b/, "dev_tools"],
  [/\bcyber ?security\b|\bsecurity software\b/, "cybersecurity"],
  [/\bconsumer\b|\bdtc\b|\bbrand(s)?\b/, "consumer"],
  [/\bmarketplace\b|\btwo[- ]sided\b/, "marketplace"],
  [/\benterprise (software|saas|it)\b|\bb2b (software|saas)\b|\benterprise\b/, "enterprise"],
  [/\bweb3\b|\bcrypto\b|\bblockchain\b|\bdigital assets?\b/, "web3"],
  [/\brobotics\b|\bdrones?\b|\bautonomous\b/, "robotics"],
];

export function extractSectors(text: string | null | undefined): Sector[] {
  if (!text) return [];
  const s = text.toLowerCase();
  const found = new Set<Sector>();
  for (const [re, sector] of SECTOR_PATTERNS) {
    if (re.test(s)) found.add(sector);
  }
  return [...found];
}

// ── Investor type ────────────────────────────────────────────

export interface TypeResult {
  type: InvestorType;
  confidence: number;
}

/** IAPD kind discriminator is authoritative for the adviser dataset. */
export function classifyFromKind(kind: string): TypeResult | null {
  switch (kind) {
    case "iapd_adviser":
      // refined further from form text below
      return null;
    case "iapd_ecr":
      return { type: "angel", confidence: 0.9 };
    default:
      return null;
  }
}

export function classifyTypeFromText(
  formText: string | null | undefined,
  nameText: string | null | undefined
): TypeResult {
  const s = ((formText || "") + " " + (nameText || "")).toLowerCase();
  if (/\bventure capital\b|\bventure fund\b|\bvc firm\b/.test(s)) {
    return { type: "venture_capital", confidence: 0.85 };
  }
  if (/\bprivate equity\b/.test(s)) {
    return { type: "private_equity", confidence: 0.85 };
  }
  if (/\bfamily office\b/.test(s)) {
    return { type: "family_office", confidence: 0.9 };
  }
  if (/\bcorporate (venture|vc)\b|\bcvc\b/.test(s)) {
    return { type: "corporate_vc", confidence: 0.85 };
  }
  if (/\baccelerator\b/.test(s)) {
    return { type: "accelerator", confidence: 0.85 };
  }
  if (/\bincubator\b/.test(s)) {
    return { type: "incubator", confidence: 0.8 };
  }
  if (/\bmicro[- ]?vc\b/.test(s)) {
    return { type: "micro_vc", confidence: 0.85 };
  }
  if (/\bangel\b/.test(s)) {
    return { type: "angel", confidence: 0.7 };
  }
  if (/\breal estate\b/.test(s)) {
    return { type: "other", confidence: 0.6 };
  }
  // Default for a registered adviser: institutional allocator, not startup-facing
  return { type: "other", confidence: 0.4 };
}

// ── Check size parsing ───────────────────────────────────────

export interface CheckSizeResult {
  min_usd: number | null;
  max_usd: number | null;
  confidence: number;
}

/** Parse "$250k - $1M", "€500,000", "$10MM+" etc. Returns USD when currency recognized. */
export function parseCheckSize(text: string | null | undefined): CheckSizeResult {
  if (!text) return { min_usd: null, max_usd: null, confidence: 0 };
  const s = text.toLowerCase().replace(/,/g, "");
  const usd = /\$|usd|dollar/.test(s);
  const eur = /€|eur|euro/.test(s);
  const gbp = /£|gbp|pound/.test(s);
  if (!usd && !eur && !gbp) return { min_usd: null, max_usd: null, confidence: 0 };

  const amounts: number[] = [];
  const re = /([$€£])\s*(\d+(?:\.\d+)?)\s*(million|billion|thousand|mm|bn|k|m|b)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let v = parseFloat(m[2]);
    const unit = m[3];
    if (unit === "k" || unit === "thousand") v *= 1_000;
    else if (unit === "m" || unit === "mm" || unit === "million") v *= 1_000_000;
    else if (unit === "b" || unit === "bn" || unit === "billion") v *= 1_000_000_000;
    amounts.push(v);
  }
  if (amounts.length === 0) return { min_usd: null, max_usd: null, confidence: 0 };
  // FX assumptions documented: EUR≈1.1, GBP≈1.3 (static; refresh quarterly)
  const fx = eur ? 1.1 : gbp ? 1.3 : 1;
  const vals = amounts.map((a) => a * fx);
  return {
    min_usd: Math.min(...vals),
    max_usd: Math.max(...vals),
    confidence: 0.7,
  };
}

// ── Record assembly helpers ──────────────────────────────────

export function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
