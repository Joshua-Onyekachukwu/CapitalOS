import { describe, it, expect } from "vitest";
import { classifyTier, STALE_DAYS } from "@/lib/services/investor/qualification-tiers";

const FRESH = new Date(Date.now() - 10 * 86_400_000).toISOString();
const STALE = new Date(Date.now() - (STALE_DAYS + 30) * 86_400_000).toISOString();

const base = {
  verification_status: "verified",
  source_provider: "edgar_restore_2026_09",
  source_id: "0001234567",
  last_verified_at: FRESH,
  fit_score_breakdown: {},
  outreach_readiness: "not_ready",
  fit_score: 64,
};

describe("classifyTier", () => {
  it("treats EDGAR batch identifiers as primary-source evidence", () => {
    const t = classifyTier(base);
    expect(t.tier).toBe("verified");
    expect(t.basis).toBe("primary_source");
  });

  it("recognizes sec_edgar and apollo providers", () => {
    expect(classifyTier({ ...base, source_provider: "sec_edgar" }).tier).toBe("verified");
    expect(classifyTier({ ...base, source_provider: "apollo" }).tier).toBe("verified");
  });

  it("downgrades stale primary evidence to derived with a stale basis — never silent", () => {
    const t = classifyTier({ ...base, last_verified_at: STALE });
    expect(t.tier).toBe("derived");
    expect(t.basis).toBe("primary_source_stale");
    expect(t.staleDays).toBeGreaterThan(STALE_DAYS);
  });

  it("is idempotent: does not read the stored status back (no cascading demotions)", () => {
    // The pass rewrites stale rows to 'derived'; reclassifying must still see
    // the primary-source evidence and produce the same verdict.
    const t = classifyTier({ ...base, verification_status: "derived", last_verified_at: STALE });
    expect(t.tier).toBe("derived");
    expect(t.basis).toBe("primary_source_stale");
    expect(classifyTier({ ...base, verification_status: "derived" }).tier).toBe("verified");
  });

  it("requires source_id for primary-source claims", () => {
    const t = classifyTier({ ...base, source_id: null });
    expect(t.tier).toBe("derived"); // falls through to interaction evidence (fit_score > 0)
    expect(t.basis).toBe("interaction_evidence");
  });

  it("classifies reply/fit interaction as derived", () => {
    expect(classifyTier({ ...base, source_provider: null, source_id: null, verification_status: "unknown" }).tier).toBe("derived");
    expect(
      classifyTier({ ...base, source_provider: null, source_id: null, verification_status: "unknown", fit_score: 0, outreach_readiness: "ready" }).tier
    ).toBe("derived");
  });

  it("classifies AI breakdown as ai_classified when nothing stronger exists", () => {
    const t = classifyTier({
      ...base,
      source_provider: null,
      source_id: null,
      verification_status: "unknown",
      fit_score: 0,
      outreach_readiness: "not_ready",
      fit_score_breakdown: { factors: [{ factor: "sector", score: 50, weight: 1 }] },
    });
    expect(t.tier).toBe("ai_classified");
    expect(t.basis).toBe("ai_classification");
  });

  it("ignores empty breakdown objects", () => {
    const t = classifyTier({
      ...base,
      source_provider: null,
      source_id: null,
      verification_status: "unknown",
      fit_score: 0,
      outreach_readiness: "not_ready",
      fit_score_breakdown: {},
    });
    expect(t.tier).toBe("unknown");
    expect(t.basis).toBe("no_evidence");
  });

  it("treats do_not_contact as derived evidence, not unknown", () => {
    const t = classifyTier({
      ...base,
      source_provider: null,
      source_id: null,
      verification_status: "unknown",
      fit_score: 0,
      outreach_readiness: "do_not_contact",
      fit_score_breakdown: {},
    });
    expect(t.tier).toBe("derived");
  });

  it("reports null staleDays when never verified", () => {
    const t = classifyTier({ ...base, last_verified_at: null });
    expect(t.staleDays).toBeNull();
    expect(t.tier).toBe("verified"); // evidence exists; freshness is simply unknown
  });
});
