// =============================================
// Fundraising Pipeline — Round Metrics
// =============================================
// Pure functions. No Supabase client, no React. The pipeline API computes these
// once per request and both the pipeline page and the dashboard read the same
// numbers, so "committed" cannot mean two different things in two places.
//
// Ground rules that shape the implementation:
//
// 1. **Never invent an amount.** If the founder has not set an expected cheque,
//    the weighted total is 0 and the coverage fields say so (`basis: "none"`).
//    A target split evenly across N investors would look authoritative and be
//    fiction, so it is not offered.
// 2. **Never invent a probability.** A stage default is honest only when it is
//    labelled, so every defaulted entry is counted in `probabilityBasis.defaulted`.
// 3. **Committed money is not weighted.** A verbal commitment at 85% is not the
//    same as a closed cheque; committed stages count at face value and
//    everything else is discounted by its probability.
// 4. Lost stages contribute nothing to either total, but their reasons are
//    surfaced because that is the most useful thing a lost deal produces.

import { PIPELINE_STAGES, type PipelineStageId } from "./stages";

/** Money that is treated as already committed, at face value. */
export const COMMITTED_STAGES: PipelineStageId[] = [
  "verbal_commitment",
  "term_sheet",
  "negotiation",
  "committed",
  "closed_won",
];

/** Stages where the opportunity is over and contributes nothing. */
export const LOST_STAGES: PipelineStageId[] = ["closed_lost", "not_a_fit"];

/**
 * Conservative stage-level probabilities, used ONLY when the founder has not
 * set one. They are conventional fundraising priors, not measurements, and the
 * UI labels them "stage default" wherever they are used.
 */
export const DEFAULT_STAGE_PROBABILITY: Record<PipelineStageId, number> = {
  discovered: 2,
  researching: 5,
  shortlisted: 10,
  introduction_requested: 12,
  introduction_received: 18,
  outreach_drafted: 15,
  contacted: 15,
  responded: 30,
  meeting_scheduled: 40,
  first_meeting_completed: 45,
  follow_up: 40,
  due_diligence: 60,
  partner_meeting: 70,
  verbal_commitment: 85,
  term_sheet: 90,
  negotiation: 92,
  committed: 97,
  closed_won: 100,
  closed_lost: 0,
  not_a_fit: 0,
  on_hold: 10,
};

export interface RoundTargets {
  targetAmount: number | null;
  targetValuation: number | null;
  instrument: string | null;
  chequeMin: number | null;
  chequeMax: number | null;
}

export interface PipelineEntry {
  id: string;
  investorId: string;
  stage: PipelineStageId;
  /** Expected cheque for this investor; null means "not set", not zero. */
  expectedAmount: number | null;
  /** Explicit percentage 0–100; null falls back to the stage default. */
  probability: number | null;
  lostReason?: string | null;
  stageEnteredAt?: string | null;
  createdAt?: string | null;
}

export interface PipelineMoveEvent {
  investorId: string;
  toStage: string | null;
  createdAt?: string | null;
}

export interface StageRoundMetric {
  stage: PipelineStageId;
  label: string;
  count: number;
  /** Entries in this stage that carry an explicit expected cheque. */
  withAmount: number;
  committedAmount: number;
  weightedAmount: number;
  medianDaysInStage: number | null;
}

export interface ConversionStep {
  from: PipelineStageId;
  to: PipelineStageId;
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toCount: number;
  /** toCount / fromCount, or null when no entry ever reached `from`. */
  rate: number | null;
}

export type AmountBasis = "none" | "partial" | "complete";

export interface RoundMetrics {
  targets: RoundTargets;
  entryCount: number;
  activeCount: number;
  committedCount: number;
  lostCount: number;
  /** Entries carrying an explicit expected cheque. */
  withAmount: number;
  amountBasis: AmountBasis;
  /** Face value of entries in committed stages. */
  committed: number;
  /** Probability-weighted value of active, not-yet-committed entries. */
  weightedPipeline: number;
  /** Undiscounted value of active, not-yet-committed entries. */
  activeUnweighted: number;
  /** committed + weightedPipeline. */
  projected: number;
  /** projected / targetAmount, or null when no target is set. */
  coverageRatio: number | null;
  /** committed / targetAmount, or null when no target is set. */
  percentOfTarget: number | null;
  /** targetAmount - committed, floored at 0. Null when no target is set. */
  remaining: number | null;
  probabilityBasis: { explicit: number; defaulted: number };
  stages: StageRoundMetric[];
  conversion: ConversionStep[];
  lostReasons: { reason: string; count: number }[];
  asOf: string;
}

const STAGE_INDEX = new Map<string, number>(
  PIPELINE_STAGES.map((s, i) => [s.id as string, i])
);

const STAGE_LABEL = new Map<string, string>(
  PIPELINE_STAGES.map((s) => [s.id as string, s.label])
);

function isCommitted(stage: PipelineStageId): boolean {
  return COMMITTED_STAGES.includes(stage);
}

function isLost(stage: PipelineStageId): boolean {
  return LOST_STAGES.includes(stage);
}

/** A stored value is only usable if it is a finite, non-negative number. */
function normaliseAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normaliseProbability(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(m * 10) / 10;
}

function daysBetween(from: string | null | undefined, now: Date): number | null {
  if (!from) return null;
  const t = new Date(from).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

export function computeRoundMetrics(input: {
  targets: RoundTargets;
  entries: PipelineEntry[];
  events?: PipelineMoveEvent[];
  now?: Date;
}): RoundMetrics {
  const now = input.now ?? new Date();
  const entries = input.entries ?? [];
  const events = input.events ?? [];
  const targets = input.targets;

  let committed = 0;
  let weightedPipeline = 0;
  let activeUnweighted = 0;
  let committedCount = 0;
  let lostCount = 0;
  let activeCount = 0;
  let withAmount = 0;
  let explicitProbability = 0;
  let defaultedProbability = 0;

  const perStage = new Map<
    PipelineStageId,
    {
      count: number;
      withAmount: number;
      committedAmount: number;
      weightedAmount: number;
      days: number[];
    }
  >();
  for (const s of PIPELINE_STAGES) {
    perStage.set(s.id, {
      count: 0,
      withAmount: 0,
      committedAmount: 0,
      weightedAmount: 0,
      days: [],
    });
  }

  const lostReasons = new Map<string, number>();

  for (const entry of entries) {
    const bucket = perStage.get(entry.stage);
    if (!bucket) continue; // unknown stage never contributes to a total

    const amount = normaliseAmount(entry.expectedAmount);
    const explicitProb = normaliseProbability(entry.probability);
    const probability =
      explicitProb !== null ? explicitProb : DEFAULT_STAGE_PROBABILITY[entry.stage] ?? 0;

    if (explicitProb !== null) explicitProbability += 1;
    else defaultedProbability += 1;

    bucket.count += 1;

    if (amount !== null) {
      withAmount += 1;
      bucket.withAmount += 1;
    }

    const days = daysBetween(entry.stageEnteredAt ?? entry.createdAt, now);
    if (days !== null) bucket.days.push(days);

    if (isLost(entry.stage)) {
      lostCount += 1;
      const reason = (entry.lostReason || "No reason recorded").trim();
      lostReasons.set(reason, (lostReasons.get(reason) || 0) + 1);
      continue;
    }

    activeCount += 1;

    if (amount === null) continue;

    if (isCommitted(entry.stage)) {
      committedCount += 1;
      committed += amount;
      bucket.committedAmount += amount;
    } else {
      const weighted = amount * (probability / 100);
      weightedPipeline += weighted;
      activeUnweighted += amount;
      bucket.weightedAmount += weighted;
    }
  }

  const projected = committed + weightedPipeline;
  const targetAmount = normaliseAmount(targets.targetAmount);

  // "Reached" is the furthest stage an entry has been seen in: its current
  // stage plus every stage recorded in pipeline_events. An entry moved back to
  // an earlier stage still counts as having reached the later one, which is
  // what a funnel means. The UI states this basis.
  const reachedIndex = new Map<string, number>();
  for (const entry of entries) {
    reachedIndex.set(entry.investorId, STAGE_INDEX.get(entry.stage) ?? 0);
  }
  for (const ev of events) {
    if (!ev.toStage) continue;
    const idx = STAGE_INDEX.get(ev.toStage);
    if (idx === undefined) continue;
    const prev = reachedIndex.get(ev.investorId);
    if (prev === undefined || idx > prev) reachedIndex.set(ev.investorId, idx);
  }

  const reachedCounts = PIPELINE_STAGES.map(() => 0);
  for (const idx of reachedIndex.values()) {
    for (let i = 0; i <= idx; i++) reachedCounts[i] += 1;
  }

  const conversion: ConversionStep[] = [];
  for (let i = 0; i < PIPELINE_STAGES.length - 1; i++) {
    const from = PIPELINE_STAGES[i];
    const to = PIPELINE_STAGES[i + 1];
    const fromCount = reachedCounts[i];
    const toCount = reachedCounts[i + 1];
    if (fromCount === 0) continue; // no denominator, no claim
    conversion.push({
      from: from.id,
      to: to.id,
      fromLabel: from.label,
      toLabel: to.label,
      fromCount,
      toCount,
      rate: toCount / fromCount,
    });
  }

  const stages: StageRoundMetric[] = PIPELINE_STAGES.map((s) => {
    const b = perStage.get(s.id)!;
    return {
      stage: s.id,
      label: s.label,
      count: b.count,
      withAmount: b.withAmount,
      committedAmount: Math.round(b.committedAmount * 100) / 100,
      weightedAmount: Math.round(b.weightedAmount * 100) / 100,
      medianDaysInStage: median(b.days),
    };
  });

  return {
    targets: {
      targetAmount,
      targetValuation: normaliseAmount(targets.targetValuation),
      instrument: targets.instrument ?? null,
      chequeMin: normaliseAmount(targets.chequeMin),
      chequeMax: normaliseAmount(targets.chequeMax),
    },
    entryCount: entries.length,
    activeCount,
    committedCount,
    lostCount,
    withAmount,
    amountBasis:
      withAmount === 0 ? "none" : withAmount === entries.length ? "complete" : "partial",
    committed: Math.round(committed * 100) / 100,
    weightedPipeline: Math.round(weightedPipeline * 100) / 100,
    activeUnweighted: Math.round(activeUnweighted * 100) / 100,
    projected: Math.round(projected * 100) / 100,
    coverageRatio: targetAmount && targetAmount > 0 ? projected / targetAmount : null,
    percentOfTarget: targetAmount && targetAmount > 0 ? committed / targetAmount : null,
    remaining:
      targetAmount === null ? null : Math.max(0, Math.round((targetAmount - committed) * 100) / 100),
    probabilityBasis: { explicit: explicitProbability, defaulted: defaultedProbability },
    stages,
    conversion,
    lostReasons: [...lostReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    asOf: now.toISOString(),
  };
}
