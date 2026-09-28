/**
 * Qualification stage — deterministic rules first, AI for ambiguity.
 *
 * Builds the canonical InvestorRecord from a processed SourceRecord:
 *   1. deterministic extraction (names, URLs, geo, stages/sectors from text)
 *   2. AI tier1 (is this an investor entity?) — gates everything else
 *   3. AI tier2 (deep qualification) — only when there is rich text
 *   4. hard rules → qualified | rejected | failed
 *   5. evidence attribution + quality score + claim tier
 *
 * Unknowns stay unknown: attributes without evidence are null, and the
 * claim tier reflects the weakest evidenced attribute.
 */

import { weakestTier, tierOf, type EvidenceRef, type InvestorRecord, type SourceRecord, type Stage, type Sector, type Geography } from "./types";
import {
  canonicalizeName,
  classifyTypeFromText,
  dedupe,
  extractSectors,
  extractStages,
  normalizeEmail,
  normalizeGeography,
  normalizeWebsite,
  parseCheckSize,
  slugId,
  titleCase,
} from "./normalize";
import { qualityScore } from "./quality";
import type { Tier1Verdict, Tier2Qualification } from "./openrouter";

export type QualifyOutcome = "qualified" | "rejected" | "failed";

export interface QualifyResult {
  outcome: QualifyOutcome;
  reason?: string;
  record?: InvestorRecord;
}

/** Pull first-name-ish display strings out of IAPD blobs. */
function displayName(payload: Record<string, unknown>): string | null {
  const candidates = ["firm_name", "legal_name", "name", "entity_name"];
  for (const k of candidates) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function blobText(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `${k}: ${v}`)
    .join(". ");
}

export interface QualifyInputs {
  source: SourceRecord;
  tier1: Tier1Verdict | null;
  tier2: Tier2Qualification | null;
  /** existing canonical names for the duplicate-risk penalty heuristic */
  fuzzyDupSignal?: number; // 0..1, 0 = unique
}

export function qualify(inputs: QualifyInputs): QualifyResult {
  const { source, tier1, tier2, fuzzyDupSignal = 0 } = inputs;
  const payload = source.payload;
  const name = displayName(payload);

  // ── Hard identity rules ──
  if (!name || name.trim().length < 3) {
    return { outcome: "rejected", reason: "no_usable_name" };
  }
  const canonical = canonicalizeName(name);
  if (!canonical) {
    return { outcome: "rejected", reason: "empty_canonical_name" };
  }

  const blob = blobText(payload);
  const website = normalizeWebsite(payload.website as string);
  const email = normalizeEmail(payload.email as string);
  const geo = normalizeGeography(payload.location as string, payload.country as string);

  // AI gate: tier1 must affirm investor status when it ran. If AI was
  // unavailable (no key / provider outage) we proceed on deterministic
  // signals only but cap the record tier at "inferred".
  const aiGateFailed = !!tier1 && tier1.is_investor_entity === false;
  if (aiGateFailed) {
    return { outcome: "rejected", reason: `ai_not_investor: ${tier1?.reason}` };
  }

  // Deterministic type classification, refined by AI verdict when present.
  const kindType = source.kind === "iapd_ecr" ? { type: "angel" as const, confidence: 0.9 } : null;
  const textType = classifyTypeFromText(blob, name);
  const aiType = tier1?.investor_type
    ? ({ type: tier1.investor_type, confidence: 0.8 } as { type: any; confidence: number })
    : null;
  const chosenType = kindType?.confidence && kindType.confidence >= (aiType?.confidence ?? 0)
    ? kindType
    : aiType && aiType.confidence > textType.confidence
      ? aiType
      : textType;

  // Startup-relevance gate: institutional 'other' advisers with no startup
  // signal and no rich text are not worth DB space at scale.
  const startupSignal =
    chosenType.type === "venture_capital" ||
    chosenType.type === "angel" ||
    chosenType.type === "micro_vc" ||
    chosenType.type === "accelerator" ||
    chosenType.type === "angel_syndicate" ||
    chosenType.type === "corporate_vc" ||
    chosenType.type === "family_office" ||
    /\bventure\b|\bstartup\b|\bseed\b|\bearly stage\b/i.test(blob);
  if (!startupSignal && chosenType.type === "other" && chosenType.confidence < 0.5 && !website) {
    return { outcome: "rejected", reason: "insufficient_startup_signal" };
  }

  // ── Stages / sectors: deterministic regex ∪ AI extraction ──
  const detStages = extractStages(blob);
  const aiStages = (tier2?.stages || []).filter((s): s is Stage =>
    ["pre_seed", "seed", "series_a", "series_b", "series_c_plus", "growth", "late_stage", "other"].includes(s)
  );
  const stages = dedupe<Stage>([...detStages, ...aiStages]);

  const detSectors = extractSectors(blob);
  const aiSectors = (tier2?.sectors || []).filter((s): s is Sector =>
    /^[a-z0-9_]+$/.test(s)
  ) as Sector[];
  const sectors = dedupe<Sector>([...detSectors, ...aiSectors].slice(0, 12));

  const thesis = tier2?.thesis || null;

  const check = parseCheckSize(tier2?.check_size_text || null);

  const portfolio = (tier2?.portfolio_companies || [])
    .filter((c) => typeof c === "string" && c.trim().length > 1)
    .slice(0, 30)
    .map((c) => ({ company: c.trim(), source_url: source.source_url }));

  // Latest known activity signal for IAPD records: the filing date itself.
  const filingDate = typeof payload.filing_date === "string" ? payload.filing_date : null;
  const fiveYearsAgo = Date.now() - 5 * 365 * 86_400_000;
  const is_active = filingDate
    ? new Date(filingDate).getTime() > fiveYearsAgo
    : true; // registered & filing → assume active until proven otherwise

  const now = new Date().toISOString();
  const geos: Geography[] = geo.region ? dedupe<Geography>([geo.region, "global" as Geography].slice(0, 1) as Geography[]) : [];

  const record: InvestorRecord = {
    id: slugId(canonical, source.provider),
    canonical_name: canonical,
    legal_name: name,
    investor_type: chosenType.type,
    website,
    linkedin_url: null,
    twitter_url: null,
    crunchbase_url: null,
    email,
    country: geo.country,
    city: geo.city,
    region: geo.region,
    geographies: geos,
    stages,
    sectors,
    min_check_usd: check.min_usd,
    max_check_usd: check.max_usd,
    thesis,
    portfolio,
    is_active,
    evidence: {
      identity: {
        source_url: source.source_url || "unknown",
        evidence: `Legal name "${name}"${website ? `; website ${website}` : ""}`,
        extracted_by: "deterministic",
        confidence: website ? 0.95 : 0.75,
        verified_at: now,
      },
      type: {
        source_url: source.source_url || "unknown",
        evidence: `classified as ${chosenType.type}${aiType ? " (AI-refined)" : ""}`,
        extracted_by: aiType ? "ai" : "deterministic",
        confidence: chosenType.confidence,
        verified_at: now,
      },
      stages: stages.length ? {
        source_url: source.source_url || "unknown",
        evidence: `stage signals: ${stages.join(", ")}`,
        extracted_by: aiStages.length ? "ai" : "deterministic",
        confidence: aiStages.length ? 0.85 : 0.7,
        verified_at: now,
      } : undefined as any,
      sectors: sectors.length ? {
        source_url: source.source_url || "unknown",
        evidence: `sector signals: ${sectors.join(", ")}`,
        extracted_by: aiSectors.length ? "ai" : "deterministic",
        confidence: aiSectors.length ? 0.8 : 0.65,
        verified_at: now,
      } : undefined as any,
      geography: geo.region ? {
        source_url: source.source_url || "unknown",
        evidence: `location: ${[geo.city, geo.country].filter(Boolean).join(", ")}`,
        extracted_by: "deterministic",
        confidence: 0.9,
        verified_at: now,
      } : undefined as any,
      check_size: check.min_usd ? {
        source_url: source.source_url || "unknown",
        evidence: tier2?.check_size_text || "check size parsed from text",
        extracted_by: "ai",
        confidence: check.confidence,
        verified_at: now,
      } : undefined as any,
      thesis: thesis ? {
        source_url: source.source_url || "unknown",
        evidence: tier2?.evidence_quotes?.[0]?.quote || thesis,
        extracted_by: "ai",
        confidence: tier2?.confidence ?? 0.7,
        verified_at: now,
      } : undefined as any,
      activity: {
        source_url: source.source_url || "unknown",
        evidence: filingDate ? `latest filing dated ${filingDate}` : "currently registered",
        extracted_by: "deterministic",
        confidence: 0.95,
        verified_at: now,
      },
    },
    quality_score: 0,
    claim_tier: "unknown",
    source_provider: source.provider,
    source_url: source.source_url,
    first_discovered_at: now,
    last_verified_at: now,
  };

  // Compute quality + record tier
  const q = qualityScore(record, fuzzyDupSignal);
  record.quality_score = q.total;
  const tiers = Object.values(record.evidence)
    .filter(Boolean)
    .map((e) => tierOf(e as EvidenceRef));
  record.claim_tier = tiers.length ? weakestTier(tiers) : "unknown";

  // Final gate: unusable records with near-zero quality are rejected
  if (q.total < 15) {
    return { outcome: "rejected", reason: `quality_too_low: ${q.total}` };
  }

  return { outcome: "qualified", record };
}
