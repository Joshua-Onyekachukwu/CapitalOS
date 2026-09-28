/**
 * Investor Intelligence Pipeline — unit tests.
 *
 * Covers the deterministic core: normalization, quality scoring, dedup
 * verdicts, and qualification gating (including the no-evidence and
 * no-AI paths). AI layers are integration-tested via controlled batches
 * (run-batch.ts) to keep this suite offline and free.
 */

import { describe, it, expect } from "vitest";
import {
  canonicalizeName,
  normalizeWebsite,
  normalizeEmail,
  normalizeGeography,
  extractStages,
  extractSectors,
  parseCheckSize,
  slugId,
} from "../../scripts/pipeline/normalize";
import { qualityScore } from "../../scripts/pipeline/quality";
import { DedupIndex, tokenSetSimilarity } from "../../scripts/pipeline/dedup";
import { qualify } from "../../scripts/pipeline/qualify";
import { weakestTier, tierOf, type EvidenceRef, type InvestorRecord, type SourceRecord } from "../../scripts/pipeline/types";

const ref = (confidence: number, extracted_by = "deterministic"): EvidenceRef => ({
  source_url: "https://example.gov/firm/1",
  evidence: "test evidence",
  extracted_by,
  confidence,
  verified_at: new Date().toISOString(),
});

describe("normalization", () => {
  it("canonicalizes names by stripping legal suffixes and punctuation", () => {
    expect(canonicalizeName("Sequoia Capital Management, LLC")).toBe("sequoia capital");
    expect(canonicalizeName("Benchmark Capital Ltd.")).toBe("benchmark capital");
    expect(canonicalizeName("A & B Partners")).toBe("a and b");
  });

  it("normalizes websites to bare domains", () => {
    expect(normalizeWebsite("https://www.Example.com/fund?utm=x")).toBe("example.com");
    expect(normalizeWebsite("http://sub.example.org")).toBe("sub.example.org");
    expect(normalizeWebsite("not a url")).toBeNull();
    expect(normalizeWebsite(null)).toBeNull();
  });

  it("normalizes emails", () => {
    expect(normalizeEmail(" FoundEr@Example.COM ")).toBe("founder@example.com");
    expect(normalizeEmail("nope")).toBeNull();
  });

  it("maps US states and countries to regions", () => {
    expect(normalizeGeography("CALIFORNIA 94105", null)).toEqual({ country: "United States", city: "California", region: "north_america" });
    expect(normalizeGeography(null, "germany")).toEqual({ country: "Germany", city: null, region: "europe" });
    expect(normalizeGeography(null, "nigeria")).toEqual({ country: "Nigeria", city: null, region: "africa" });
    expect(normalizeGeography(null, null).region).toBeNull();
  });

  it("extracts stages from text", () => {
    expect(extractStages("We lead pre-seed and seed rounds")).toEqual(["pre_seed", "seed"]);
    expect(extractStages("Growth equity only")).toEqual(["growth"]);
    expect(extractStages("")).toEqual([]);
  });

  it("extracts sectors from text", () => {
    expect(extractSectors("AI, fintech and climate tech")).toEqual(["ai", "fintech", "climate"]);
    expect(extractSectors("no signals here")).toEqual([]);
  });

  it("parses check sizes to USD", () => {
    expect(parseCheckSize("$250k - $1M")).toEqual({ min_usd: 250_000, max_usd: 1_000_000, confidence: 0.7 });
    expect(parseCheckSize("€2 million checks")).toEqual({ min_usd: 2_200_000, max_usd: 2_200_000, confidence: 0.7 });
    expect(parseCheckSize("ten dollars")).toEqual({ min_usd: null, max_usd: null, confidence: 0 });
  });

  it("produces stable slugs", () => {
    expect(slugId("sequoia capital", "iapd")).toBe(slugId("Sequoia  Capital", "iapd"));
  });
});

describe("quality score", () => {
  const base: InvestorRecord = {
    id: "x", canonical_name: "test capital", legal_name: "Test Capital", investor_type: "venture_capital",
    website: "test.com", linkedin_url: null, twitter_url: null, crunchbase_url: null, email: null,
    country: "United States", city: "San Francisco", region: "north_america", geographies: ["north_america"],
    stages: ["seed"], sectors: ["ai"], min_check_usd: null, max_check_usd: null, thesis: null,
    portfolio: [], is_active: true, evidence: {}, quality_score: 0, claim_tier: "unknown",
    source_provider: "test", source_url: null,
    first_discovered_at: new Date().toISOString(), last_verified_at: new Date().toISOString(),
  };

  it("scores evidence-backed records higher than evidence-free ones", () => {
    const rich = { ...base, evidence: { identity: ref(0.95), type: ref(0.9), activity: ref(0.95) } };
    const bare = { ...base, evidence: {} };
    expect(qualityScore(rich).total).toBeGreaterThan(qualityScore(bare).total);
  });

  it("penalizes duplicate risk", () => {
    const rec = { ...base, evidence: { identity: ref(0.95) } };
    expect(qualityScore(rec, 0.8).total).toBeLessThan(qualityScore(rec, 0).total);
  });

  it("caps freshness for stale records", () => {
    const old = { ...base, last_verified_at: new Date(Date.now() - 400 * 86_400_000).toISOString() };
    expect(qualityScore(old).freshness).toBe(0);
  });
});

describe("dedup", () => {
  const rec = (over: Partial<InvestorRecord>): InvestorRecord => ({
    id: "x", canonical_name: "test capital", legal_name: "Test Capital", investor_type: "venture_capital",
    website: null, linkedin_url: null, twitter_url: null, crunchbase_url: null, email: null,
    country: null, city: null, region: null, geographies: [], stages: [], sectors: [],
    min_check_usd: null, max_check_usd: null, thesis: null, portfolio: [], is_active: true,
    evidence: {}, quality_score: 0, claim_tier: "unknown", source_provider: "t", source_url: null,
    first_discovered_at: new Date().toISOString(), last_verified_at: new Date().toISOString(),
    ...over,
  });

  it("matches exact website duplicates", () => {
    const idx = new DedupIndex();
    idx.add(rec({ id: "a", website: "sequoia.com" }));
    expect(idx.check(rec({ website: "sequoia.com" }))?.verdict).toBe("exact_duplicate");
  });

  it("treats Sequoia vs Sequoia India as requiring review, not merge", () => {
    const sim = tokenSetSimilarity("sequoia capital", "sequoia capital india");
    expect(sim).toBeGreaterThan(0.5);
    const idx = new DedupIndex();
    idx.add(rec({ id: "a", canonical_name: "sequoia capital", region: "north_america" }));
    const verdict = idx.check(rec({ canonical_name: "sequoia capital india", region: "asia" }));
    expect(verdict?.verdict === "requires_review" || verdict?.verdict === "distinct").toBe(true);
  });

  it("collapses exact name+region matches", () => {
    const idx = new DedupIndex();
    idx.add(rec({ id: "a", canonical_name: "acme ventures", region: "europe" }));
    expect(idx.hasNameRegion("acme ventures", "europe")).toBe(true);
    expect(idx.hasNameRegion("acme ventures", "asia")).toBe(false);
  });
});

describe("qualification gating", () => {
  const src = (payload: Record<string, unknown>): SourceRecord => ({
    key: "k1", provider: "iapd", kind: "iapd_adviser", payload,
    source_url: "https://adviserinfo.sec.gov/firm/summary/1", collected_at: new Date().toISOString(),
  });

  it("rejects records without a usable name", () => {
    const r = qualify({ source: src({ firm_name: "" }) });
    expect(r.outcome).toBe("rejected");
    expect(r.reason).toBe("no_usable_name");
  });

  it("rejects when the AI gate says not an investor", () => {
    const r = qualify({
      source: src({ firm_name: "Smith Wealth Management", location: "Texas" }),
      tier1: { is_investor_entity: false, investor_type: null, reason: "private client only" },
    });
    expect(r.outcome).toBe("rejected");
    expect(r.reason).toContain("ai_not_investor");
  });

  it("qualifies a venture firm with deterministic evidence", () => {
    const r = qualify({
      source: src({
        firm_name: "Acme Venture Capital LLC",
        website: "https://acmevc.com",
        location: "CALIFORNIA",
        filing_date: "2026-08-01",
        business: "venture capital fund investing in seed stage AI startups",
      }),
    });
    expect(r.outcome).toBe("qualified");
    expect(r.record?.investor_type).toBe("venture_capital");
    expect(r.record?.website).toBe("acmevc.com");
    expect(r.record?.stages).toContain("seed");
    expect(r.record?.sectors).toContain("ai");
    expect(r.record?.quality_score).toBeGreaterThan(15);
    expect(r.record?.evidence.identity).toBeDefined();
  });

  it("keeps unknown attributes null instead of inventing them", () => {
    const r = qualify({
      source: src({ firm_name: "Bare Adviser LLC", location: "NEW YORK" }),
    });
    expect(r.outcome === "qualified" || r.outcome === "rejected").toBe(true);
    if (r.record) {
      expect(r.record.thesis).toBeNull();
      expect(r.record.min_check_usd).toBeNull();
      expect(r.record.claim_tier).not.toBe("verified");
    }
  });
});

describe("claim tiers", () => {
  it("maps confidence to tiers", () => {
    expect(tierOf(ref(0.95))).toBe("verified");
    expect(tierOf(ref(0.75))).toBe("supported");
    expect(tierOf(ref(0.5))).toBe("inferred");
    expect(tierOf(ref(0.2))).toBe("unknown");
  });

  it("takes the weakest tier for records", () => {
    expect(weakestTier(["verified", "supported"])).toBe("supported");
    expect(weakestTier(["verified", "unknown"])).toBe("unknown");
  });
});
