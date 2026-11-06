import { describe, it, expect } from "vitest";
import {
  assessReadiness,
  type ReadinessInput,
  type ReadinessProfile,
} from "@/lib/services/readiness/score";

const emptyProfile: ReadinessProfile = {
  companyName: null,
  industry: null,
  location: null,
  websiteUrl: null,
  companyStage: null,
  businessModel: null,
  oneLiner: null,
  description: null,
  differentiator: null,
  targetCustomer: null,
  currentlyRaising: false,
  fundingAmount: null,
  roundType: null,
  targetChequeMin: null,
  targetChequeMax: null,
  mrr: null,
  arr: null,
  customerCount: null,
  growthRate: null,
  milestones: [],
  employeeCount: null,
};

const completeProfile: ReadinessProfile = {
  companyName: "Acme",
  industry: "SaaS",
  location: "London",
  websiteUrl: "https://acme.test",
  companyStage: "seed",
  businessModel: "subscription",
  oneLiner: "We do the thing",
  description: "x".repeat(160),
  differentiator: "10x faster",
  targetCustomer: "ops teams",
  currentlyRaising: true,
  fundingAmount: 1_500_000,
  roundType: "SAFE",
  targetChequeMin: 25_000,
  targetChequeMax: 250_000,
  mrr: 10_000,
  arr: 120_000,
  customerCount: 12,
  growthRate: "20% m/m",
  milestones: ["launched"],
  employeeCount: 4,
};

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    profile: emptyProfile,
    documents: [],
    teamMembers: [],
    ...overrides,
  };
}

describe("readiness assessment", () => {
  it("scores an empty profile at 0 and lists every gap", () => {
    const result = assessReadiness(input());
    expect(result.score).toBe(0);
    expect(result.met).toBe(0);
    expect(result.actions.length).toBe(result.total);
    expect(result.band).toBe("not_started");
  });

  it("scores a complete profile at 100", () => {
    const result = assessReadiness(
      input({
        profile: completeProfile,
        documents: [
          { documentType: "pitch_deck", hasFile: true },
          { documentType: "financial_model", hasFile: true },
        ],
        teamMembers: [{ name: "Ada", isFounder: true, title: "CEO" }],
      })
    );
    expect(result.score).toBe(100);
    expect(result.band).toBe("raise_ready");
    expect(result.blockers).toEqual([]);
  });

  it("treats a reported zero as an answer, not a missing value", () => {
    const preRevenue = assessReadiness(
      input({ profile: { ...emptyProfile, mrr: 0 } })
    );
    const revenue = preRevenue.categories
      .find((c) => c.id === "traction")!
      .criteria.find((c) => c.id === "revenue")!;

    expect(revenue.status).toBe("met");
    expect(revenue.detail).toContain("pre-revenue");
  });

  it("does not award the revenue point when revenue is unset", () => {
    const result = assessReadiness(input());
    const revenue = result.categories
      .find((c) => c.id === "traction")!
      .criteria.find((c) => c.id === "revenue")!;
    expect(revenue.status).toBe("missing");
  });

  it("reports a declared 'not raising' as a blocker instead of a silent penalty", () => {
    const result = assessReadiness(input({ profile: { ...emptyProfile, currentlyRaising: false } }));
    expect(result.blockers.some((b) => b.includes("not currently raising"))).toBe(true);
  });

  it("flags a deck record whose file was never stored", () => {
    const result = assessReadiness(
      input({ documents: [{ documentType: "pitch_deck", hasFile: false }] })
    );
    const deck = result.categories
      .find((c) => c.id === "materials")!
      .criteria.find((c) => c.id === "pitch_deck")!;

    expect(deck.status).toBe("missing");
    expect(deck.detail).toContain("never stored");
    expect(result.blockers.some((b) => b.includes("no stored file"))).toBe(true);
  });

  it("counts a supporting document separately from the deck", () => {
    const result = assessReadiness(
      input({ documents: [{ documentType: "financial_model", hasFile: true }] })
    );
    const materials = result.categories.find((c) => c.id === "materials")!;
    expect(materials.criteria.find((c) => c.id === "pitch_deck")!.status).toBe("missing");
    expect(materials.criteria.find((c) => c.id === "supporting_document")!.status).toBe("met");
  });

  it("orders actions by points so the highest-impact gap is first", () => {
    const result = assessReadiness(input());
    const points = result.actions.map((a) => a.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("keeps category maxima equal to the sum of their criteria weights", () => {
    const result = assessReadiness(input());
    for (const category of result.categories) {
      const summed = category.criteria.reduce((s, c) => s + c.weight, 0);
      expect(category.max).toBe(summed);
    }
    expect(result.categories.reduce((s, c) => s + c.max, 0)).toBe(100);
  });

  it("never claims the score predicts a raise", () => {
    expect(assessReadiness(input()).disclaimer).toMatch(/does not predict/i);
  });
});
