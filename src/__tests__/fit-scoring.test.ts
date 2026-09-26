/**
 * Unit tests — Investor fit scoring (deterministic engine)
 * Runs fully offline. Verifies the scoring contract: weights sum,
 * bounded scores, and that better-aligned investors score higher.
 */
import { describe, it, expect } from "vitest";
import { computeFitScore, type StartupProfile } from "@/lib/services/investor/qualification";

const startup: StartupProfile = {
  name: "TestCo",
  sector: "fintech",
  stage: "seed",
  geography: "United States",
  description: "Payments infrastructure for SMBs",
  minCheckSize: 500_000,
  maxCheckSize: 2_000_000,
};

describe("computeFitScore", () => {
  it("returns the full factor breakdown with valid weights", () => {
    const investor = {
      id: "inv-1",
      investment_sectors: ["fintech"],
      investment_stages: ["seed"],
      investment_geographies: ["United States"],
      country: "United States",
      min_check_size: 250_000,
      max_check_size: 5_000_000,
      email: "partner@vc.com",
      linkedin_url: "https://linkedin.com/in/partner",
      is_verified: true,
      data_quality_score: 85,
    };

    const result = computeFitScore(investor, startup);

    expect(result.investorId).toBe("inv-1");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.factors.length).toBeGreaterThanOrEqual(6);

    const totalWeight = result.factors.reduce((s, f) => s + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);

    // Every factor carries a human-readable explanation
    for (const f of result.factors) {
      expect(typeof f.explanation).toBe("string");
      expect(f.explanation.length).toBeGreaterThan(0);
    }
  });

  it("scores a perfectly aligned investor higher than a misaligned one", () => {
    const perfect = {
      id: "perfect",
      investment_sectors: ["fintech"],
      investment_stages: ["seed"],
      investment_geographies: ["United States"],
      country: "United States",
      min_check_size: 500_000,
      max_check_size: 2_000_000,
      email: "gp@fund.com",
      linkedin_url: "https://linkedin.com/in/gp",
      is_verified: true,
      data_quality_score: 90,
      last_investment_date: new Date(Date.now() - 30 * 86400_000).toISOString(),
    };

    const mismatch = {
      id: "mismatch",
      investment_sectors: ["web3"],
      investment_stages: ["late_stage"],
      investment_geographies: ["Southeast Asia"],
      country: "Singapore",
      min_check_size: 10_000_000,
      max_check_size: 50_000_000,
      email: null,
      is_verified: false,
      last_investment_date: new Date(Date.now() - 4 * 365 * 86400_000).toISOString(),
    };

    const perfectScore = computeFitScore(perfect, startup).overallScore;
    const mismatchScore = computeFitScore(mismatch, startup).overallScore;

    expect(perfectScore).toBeGreaterThan(mismatchScore);
    expect(perfectScore).toBeGreaterThanOrEqual(70); // should be outreach-ready
  });

  it("marks do-not-contact investors as not ready regardless of fit", () => {
    const investor = {
      id: "dnc",
      investment_sectors: ["fintech"],
      investment_stages: ["seed"],
      email: "gp@fund.com",
      do_not_contact: true,
    };

    const result = computeFitScore(investor, startup);
    expect(result.outreachReadiness).toBe("do_not_contact");
  });

  it("explains sector reasoning — direct match beats no-overlap", () => {
    const direct = computeFitScore(
      { id: "a", investment_sectors: ["fintech"] },
      startup
    );
    const none = computeFitScore(
      { id: "b", investment_sectors: ["agriculture"] },
      startup
    );

    const directFactor = direct.factors.find((f) => f.factor === "Sector Match")!;
    const noneFactor = none.factors.find((f) => f.factor === "Sector Match")!;

    expect(directFactor.score).toBe(100);
    expect(noneFactor.score).toBeLessThan(50);
    expect(directFactor.explanation).toContain("fintech");
  });

  it("handles investors with no data without throwing", () => {
    const result = computeFitScore({ id: "empty" }, startup);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.dataQuality).toBeGreaterThanOrEqual(0);
  });
});
