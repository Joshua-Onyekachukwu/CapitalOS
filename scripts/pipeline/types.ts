/**
 * Investor Intelligence Pipeline — shared types.
 *
 * The pipeline stages (raw → processed → normalized → qualified →
 * rejected / duplicates / failed → ingested) all speak this record shape.
 * Every important attribute carries an EvidenceRef so downstream consumers
 * can distinguish verified / supported / inferred / unknown claims
 * (see tierOf).
 */

export type ClaimTier = "verified" | "supported" | "inferred" | "unknown";

export interface EvidenceRef {
  source_url: string;
  /** Quote or precise description of what the source said. */
  evidence: string;
  /** Which deterministic stage or model produced this claim. */
  extracted_by: string;
  confidence: number; // 0..1
  verified_at: string; // ISO
}

/** An attribute value plus the evidence behind it. */
export interface AttributedValue<T> {
  value: T;
  source_url: string | null;
  evidence: string | null;
  extracted_by: string;
  confidence: number;
  tier: ClaimTier;
}

export const STAGES = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c_plus",
  "growth",
  "late_stage",
  "other",
] as const;
export type Stage = (typeof STAGES)[number];

export const SECTORS = [
  "ai",
  "saas",
  "fintech",
  "healthtech",
  "climate",
  "deeptech",
  "dev_tools",
  "cybersecurity",
  "consumer",
  "marketplace",
  "enterprise",
  "web3",
  "robotics",
  "other",
] as const;
export type Sector = (typeof SECTORS)[number];

export const INVESTOR_TYPES = [
  "venture_capital",
  "angel",
  "angel_syndicate",
  "family_office",
  "corporate_vc",
  "accelerator",
  "incubator",
  "micro_vc",
  "growth_equity",
  "private_equity",
  "government_fund",
  "university_fund",
  "other",
] as const;
export type InvestorType = (typeof INVESTOR_TYPES)[number];

export const GEOGRAPHIES = [
  "north_america",
  "south_america",
  "europe",
  "africa",
  "asia",
  "middle_east",
  "oceania",
  "global",
] as const;
export type Geography = (typeof GEOGRAPHIES)[number];

/** Canonical investor record — the normalized/qualified shape. */
export interface InvestorRecord {
  /** Deterministic pipeline id (slug of canonical name + source key). */
  id: string;
  canonical_name: string;
  legal_name: string | null;
  investor_type: InvestorType | null;
  website: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  crunchbase_url: string | null;
  email: string | null;
  /** HQ country (normalized) */
  country: string | null;
  city: string | null;
  region: Geography | null;
  /** Investment geography scope (may be multiple) */
  geographies: Geography[];
  stages: Stage[];
  sectors: Sector[];
  /** USD-normalized check sizes when evidenced. */
  min_check_usd: number | null;
  max_check_usd: number | null;
  thesis: string | null;
  portfolio: { company: string; source_url: string | null }[];
  /** Is the firm showing recent activity (filed/fund raised/deal in 5y). */
  is_active: boolean;
  /** Primary evidence refs per attribute family. */
  evidence: Partial<
    Record<
      | "identity"
      | "type"
      | "stages"
      | "sectors"
      | "geography"
      | "check_size"
      | "thesis"
      | "portfolio"
      | "activity"
      | "contact",
      EvidenceRef
    >
  >;
  /** Record-level aggregate (0..100). */
  quality_score: number;
  /** Record-level tier: weakest of the key attribute tiers. */
  claim_tier: ClaimTier;
  /** Provenance of the record itself. */
  source_provider: string;
  source_url: string | null;
  /** IAPD/CRD firm number when the source is IAPD (linking + idempotency key). */
  iapd_firm_id: string | null;
  /** Sub-source discriminator (iapd_adviser = registered, iapd_ecr = exempt). */
  source_kind: string | null;
  first_discovered_at: string;
  last_verified_at: string;
}

/** One raw source row, post-acquisition, pre-normalization. */
export interface SourceRecord {
  /** Stable source-row key (used for idempotent processing + tracing). */
  key: string;
  provider: string;
  /** Discriminates sub-sources (e.g. iapd_adviser vs iapd_ecr). */
  kind: string;
  payload: Record<string, unknown>;
  source_url: string | null;
  collected_at: string;
}

/** Stage outcome + metrics for a processing batch. */
export interface StageMetrics {
  stage: string;
  input: number;
  output: number;
  rejected: number;
  duplicates: number;
  failed: number;
  ai_calls: number;
  ai_prompt_tokens: number;
  ai_completion_tokens: number;
  ai_cost_usd: number;
  duration_ms: number;
}

export function emptyMetrics(stage: string): StageMetrics {
  return {
    stage,
    input: 0,
    output: 0,
    rejected: 0,
    duplicates: 0,
    failed: 0,
    ai_calls: 0,
    ai_prompt_tokens: 0,
    ai_completion_tokens: 0,
    ai_cost_usd: 0,
    duration_ms: 0,
  };
}

/** Which tier a piece of attributed evidence supports. */
export function tierOf(e: EvidenceRef): ClaimTier {
  if (e.confidence >= 0.9 && e.extracted_by !== "ai") return "verified";
  if (e.confidence >= 0.9) return "verified";
  if (e.confidence >= 0.7) return "supported";
  if (e.confidence >= 0.4) return "inferred";
  return "unknown";
}

/** Weakest-of helper for record-level tier. */
export function weakestTier(tiers: ClaimTier[]): ClaimTier {
  const order: ClaimTier[] = ["unknown", "inferred", "supported", "verified"];
  let worst: ClaimTier = "verified";
  for (const t of tiers) {
    if (order.indexOf(t) < order.indexOf(worst)) worst = t;
  }
  return worst;
}
