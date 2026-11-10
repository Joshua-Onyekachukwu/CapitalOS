// =============================================
// Shared investor list filtering
// =============================================
// The investor list endpoint, the Discover endpoint and the saved-search alert
// matcher must agree on what a filter means. This module is that agreement:
// one function turns a normalised filter object into the same PostgREST
// predicates everywhere. Previously the list route owned this logic inline and
// the alert matcher would have been a second, drifting copy.

import {
  applyAdvancedFilters,
  type AdvancedInvestorFilters,
} from "@/lib/services/investors/filters";

export interface InvestorQueryFilters {
  search: string;
  type: string;
  country: string;
  city: string;
  readiness: string;
  verified: string;
  minScore: string;
  hasEmail: string;
  hasLinkedin: string;
  minQuality: string;
  firmId: string;
  stage: string;
  sector: string;
  evidence: string;
  sectors: string[];
  stages: string[];
  advanced: AdvancedInvestorFilters;
}

/**
 * The filter keys the UI stores in a saved filter, normalised into the shape
 * this module expects. Unknown/absent values become empty strings, which apply
 * nothing — a stale saved filter must never turn into a broken query.
 */
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export function filtersFromRecord(input: Record<string, unknown>): InvestorQueryFilters {
  const str = (key: string) => {
    const value = input[key];
    return typeof value === "string" ? value : "";
  };
  const arr = (key: string) =>
    str(key)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    search: str("search") || str("query"),
    type: str("type"),
    country: str("country"),
    city: str("city"),
    readiness: str("readiness"),
    verified: str("verified"),
    minScore: str("minScore") || str("minFitScore"),
    hasEmail: str("hasEmail"),
    hasLinkedin: str("hasLinkedin"),
    minQuality: str("minQuality"),
    firmId: str("firmId"),
    stage: str("stage"),
    sector: str("sector"),
    evidence: str("evidence"),
    sectors: arr("sectors"),
    stages: arr("stages"),
    advanced: {
      minCheque: num(input.minCheque),
      maxCheque: num(input.maxCheque),
      hasThesis:
        input.hasThesis === true || input.hasThesis === "true"
          ? true
          : input.hasThesis === "false"
            ? false
            : null,
      leadPreference: ["lead", "co_lead", "follower"].includes(String(input.leadPreference))
        ? (String(input.leadPreference) as AdvancedInvestorFilters["leadPreference"])
        : null,
      firm: typeof input.firm === "string" ? input.firm.replace(/[,()%]/g, " ").trim() : "",
    },
  };
}

export function applyInvestorFilters<T>(query: T, raw: InvestorQueryFilters): T {
  let q: any = query;

  // Merged/deactivated records (duplicate merges set is_active=false) must
  // never surface to users — they exist only as merge-history evidence.
  q = q.eq("is_active", true);

  // NOTE: only columns that actually exist on `investors` — referencing a
  // phantom column (e.g. firm_name) makes PostgREST reject the whole .or()
  // with 42703, which surfaced as "0 results for every search". Firm search
  // uses full_name (this corpus is a list of firms; current_firm_id is null).
  if (raw.search) {
    const safe = raw.search.replace(/[,()]/g, " ").trim();
    if (safe) {
      q = q.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,job_title.ilike.%${safe}%,bio.ilike.%${safe}%`
      );
    }
  }
  if (raw.type) q = q.eq("investor_type", raw.type);
  if (raw.country) q = q.ilike("country", `%${raw.country}%`);
  if (raw.city) q = q.ilike("city", `%${raw.city}%`);
  if (raw.readiness) q = q.eq("outreach_readiness", raw.readiness);
  if (raw.verified === "true") q = q.eq("is_verified", true);
  if (raw.minScore) q = q.gte("fit_score", parseInt(raw.minScore));
  if (raw.minQuality) q = q.gte("data_quality_score", parseInt(raw.minQuality));
  if (raw.hasEmail === "true") q = q.not("email", "is", null).neq("email", "");
  if (raw.hasLinkedin === "true") q = q.not("linkedin_url", "is", null).neq("linkedin_url", "");
  if (raw.firmId) q = q.eq("current_firm_id", raw.firmId);
  if (raw.stage) q = q.contains("investment_stages", [raw.stage]);
  if (raw.sector) q = q.contains("investment_sectors", [raw.sector]);
  if (["verified", "derived", "ai_classified", "unknown"].includes(raw.evidence)) {
    q = q.eq("verification_status", raw.evidence);
  }
  if (raw.stages.length > 0) q = q.overlaps("investment_stages", raw.stages);
  if (raw.sectors.length > 0) q = q.overlaps("investment_sectors", raw.sectors);
  return applyAdvancedFilters(q, raw.advanced) as T;
}
