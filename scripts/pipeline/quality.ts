/**
 * Investor record quality score (0..100).
 *
 * Defined components — nothing arbitrary:
 *   identity completeness (0-30): name, website, linkedin, email
 *   evidence quality    (0-25): tier of key claims + evidence coverage
 *   classification      (0-15): investor_type known, stages non-empty, sectors non-empty
 *   activity            (0-10): recent evidence of life
 *   freshness           (0-10): recency of last_verified_at
 *   duplicate risk      (0-10 penalty): subtracted when the record looks like a dup
 *
 * A beautiful profile with no evidence does NOT score high: evidence quality
 * is weighted equally with identity completeness. Unknown ≠ certainty.
 */

import type { ClaimTier, EvidenceRef, InvestorRecord } from "./types";

const TIER_POINTS: Record<ClaimTier, number> = {
  verified: 1.0,
  supported: 0.75,
  inferred: 0.4,
  unknown: 0,
};

const EVIDENCE_KEYS = [
  "identity",
  "type",
  "stages",
  "sectors",
  "geography",
  "check_size",
  "thesis",
  "portfolio",
  "activity",
  "contact",
] as const;

export interface QualityBreakdown {
  identity: number;
  evidence: number;
  classification: number;
  activity: number;
  freshness: number;
  duplicate_penalty: number;
  total: number;
}

export function qualityScore(
  rec: InvestorRecord,
  duplicateRisk = 0
): QualityBreakdown {
  // ── Identity completeness (0-30) ──
  let identity = 0;
  if (rec.canonical_name) identity += 10;
  if (rec.website) identity += 10;
  if (rec.linkedin_url) identity += 6;
  if (rec.email) identity += 4;

  // ── Evidence quality (0-25) ──
  const present = EVIDENCE_KEYS.filter((k) => rec.evidence?.[k]) as Array<keyof typeof rec.evidence>;
  const coverage = present.length / EVIDENCE_KEYS.length; // 0..1
  const tierSum = present.reduce((acc, k) => {
    const ref = rec.evidence[k] as EvidenceRef | undefined;
    const tier: ClaimTier =
      ref && ref.confidence >= 0.9
        ? "verified"
        : ref && ref.confidence >= 0.7
        ? "supported"
        : ref && ref.confidence >= 0.4
        ? "inferred"
        : "unknown";
    return acc + TIER_POINTS[tier];
  }, 0);
  const tierAvg = present.length ? tierSum / present.length : 0;
  const evidence = Math.round(15 * tierAvg + 10 * coverage);

  // ── Classification clarity (0-15) ──
  let classification = 0;
  if (rec.investor_type) classification += 6;
  if (rec.stages.length > 0) classification += 5;
  if (rec.sectors.length > 0) classification += 4;

  // ── Activity (0-10) ──
  const activity = rec.is_active ? 10 : 0;

  // ── Freshness (0-10) ──
  const ageDays = rec.last_verified_at
    ? Math.floor((Date.now() - new Date(rec.last_verified_at).getTime()) / 86_400_000)
    : 9999;
  let freshness = 0;
  if (ageDays <= 7) freshness = 10;
  else if (ageDays <= 30) freshness = 8;
  else if (ageDays <= 90) freshness = 5;
  else if (ageDays <= 180) freshness = 3;

  // ── Duplicate penalty (0-10) ──
  const duplicate_penalty = Math.max(0, Math.min(10, Math.round(duplicateRisk * 10)));

  const total = Math.max(
    0,
    Math.min(100, identity + evidence + classification + activity + freshness - duplicate_penalty)
  );

  return { identity, evidence, classification, activity, freshness, duplicate_penalty, total };
}
