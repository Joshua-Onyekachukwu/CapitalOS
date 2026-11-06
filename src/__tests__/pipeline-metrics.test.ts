import { describe, it, expect } from "vitest";
import {
  computeRoundMetrics,
  type PipelineEntry,
  type RoundTargets,
} from "@/lib/services/pipeline/metrics";

const NOW = new Date("2026-11-06T12:00:00.000Z");

const noTargets: RoundTargets = {
  targetAmount: null,
  targetValuation: null,
  instrument: null,
  chequeMin: null,
  chequeMax: null,
};

function entry(over: Partial<PipelineEntry> & { id: string }): PipelineEntry {
  return {
    investorId: over.id,
    stage: "shortlisted",
    expectedAmount: null,
    probability: null,
    ...over,
  } as PipelineEntry;
}

describe("round metrics — amounts", () => {
  it("reports no basis and no projected money when no cheque is set", () => {
    const m = computeRoundMetrics({
      targets: { ...noTargets, targetAmount: 2_000_000 },
      entries: [entry({ id: "a" }), entry({ id: "b" })],
      now: NOW,
    });

    expect(m.amountBasis).toBe("none");
    expect(m.withAmount).toBe(0);
    expect(m.committed).toBe(0);
    expect(m.weightedPipeline).toBe(0);
    expect(m.projected).toBe(0);
    // A target with no amounts must not be silently split into a fake pipeline.
    expect(m.coverageRatio).toBe(0);
  });

  it("counts committed stages at face value and weights the rest", () => {
    const m = computeRoundMetrics({
      targets: { ...noTargets, targetAmount: 1_000_000 },
      entries: [
        entry({ id: "a", stage: "committed", expectedAmount: 250_000 }),
        entry({ id: "b", stage: "meeting_scheduled", expectedAmount: 100_000, probability: 50 }),
      ],
      now: NOW,
    });

    expect(m.committed).toBe(250_000);
    expect(m.committedCount).toBe(1);
    expect(m.weightedPipeline).toBe(50_000);
    expect(m.projected).toBe(300_000);
    expect(m.percentOfTarget).toBeCloseTo(0.25, 5);
    expect(m.remaining).toBe(750_000);
  });

  it("uses the labelled stage default when no probability is stored", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [entry({ id: "a", stage: "due_diligence", expectedAmount: 100_000 })],
      now: NOW,
    });

    // due_diligence default is 60%
    expect(m.weightedPipeline).toBe(60_000);
    expect(m.probabilityBasis).toEqual({ explicit: 0, defaulted: 1 });
  });

  it("excludes lost stages from every total but keeps the reason", () => {
    const m = computeRoundMetrics({
      targets: { ...noTargets, targetAmount: 1_000_000 },
      entries: [
        entry({ id: "a", stage: "closed_lost", expectedAmount: 500_000, lostReason: "Cheque size" }),
        entry({ id: "b", stage: "not_a_fit", expectedAmount: 500_000 }),
        entry({ id: "c", stage: "committed", expectedAmount: 100_000 }),
      ],
      now: NOW,
    });

    expect(m.lostCount).toBe(2);
    expect(m.committed).toBe(100_000);
    expect(m.weightedPipeline).toBe(0);
    expect(m.lostReasons).toEqual([
      { reason: "Cheque size", count: 1 },
      { reason: "No reason recorded", count: 1 },
    ]);
  });

  it("ignores negative or non-finite amounts instead of netting them off", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [
        entry({ id: "a", stage: "committed", expectedAmount: -50_000 }),
        entry({ id: "b", stage: "committed", expectedAmount: Number.NaN }),
        entry({ id: "c", stage: "committed", expectedAmount: 10_000 }),
      ],
      now: NOW,
    });

    expect(m.committed).toBe(10_000);
    expect(m.withAmount).toBe(1);
    expect(m.amountBasis).toBe("partial");
  });

  it("clamps a stored probability above 100", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [entry({ id: "a", stage: "contacted", expectedAmount: 10_000, probability: 400 })],
      now: NOW,
    });
    expect(m.weightedPipeline).toBe(10_000);
  });
});

describe("round metrics — conversion", () => {
  it("counts an entry as having reached every stage up to its furthest move", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [
        entry({ id: "a", stage: "meeting_scheduled" }),
        entry({ id: "b", stage: "discovered" }),
      ],
      events: [
        { investorId: "a", toStage: "contacted" },
        { investorId: "a", toStage: "meeting_scheduled" },
      ],
      now: NOW,
    });

    const discoveredToResearching = m.conversion.find(
      (c) => c.from === "discovered" && c.to === "researching"
    );
    expect(discoveredToResearching?.fromCount).toBe(2);
    expect(discoveredToResearching?.toCount).toBe(1);
    expect(discoveredToResearching?.rate).toBe(0.5);
  });

  it("stops the funnel at the last stage anyone reached rather than reporting 0%", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [entry({ id: "a", stage: "contacted" })],
      now: NOW,
    });

    // The first hop past the furthest stage reached is included, so the funnel
    // reports "0 of 1 responded" instead of stopping at a flattering 100%.
    expect(m.conversion).toHaveLength(7);
    expect(m.conversion.at(-1)).toMatchObject({
      from: "contacted",
      to: "responded",
      fromCount: 1,
      toCount: 0,
      rate: 0,
    });
  });
});

describe("round metrics — stages", () => {
  it("computes a median days-in-stage from stage_entered_at", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [
        entry({ id: "a", stage: "researching", stageEnteredAt: "2026-11-01T12:00:00.000Z" }),
        entry({ id: "b", stage: "researching", stageEnteredAt: "2026-11-04T12:00:00.000Z" }),
        entry({ id: "c", stage: "researching", stageEnteredAt: "2026-11-03T12:00:00.000Z" }),
      ],
      now: NOW,
    });

    const researching = m.stages.find((s) => s.stage === "researching");
    expect(researching?.count).toBe(3);
    expect(researching?.medianDaysInStage).toBe(3); // 5, 2, 3 → median 3
  });

  it("returns null coverage rather than dividing by a missing target", () => {
    const m = computeRoundMetrics({
      targets: noTargets,
      entries: [entry({ id: "a", stage: "committed", expectedAmount: 10_000 })],
      now: NOW,
    });
    expect(m.coverageRatio).toBeNull();
    expect(m.percentOfTarget).toBeNull();
    expect(m.remaining).toBeNull();
  });
});
