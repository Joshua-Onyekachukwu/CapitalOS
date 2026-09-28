/**
 * Investor qualification pipeline — evidence tiers with freshness.
 *
 * Every investor row carries one of four qualification tiers in
 * `verification_status`, reflecting the strength of its evidence:
 *
 *   verified      — direct primary-source hit: an SEC EDGAR filing matched
 *                   by CIK, or an Apollo organization match. Provenance in
 *                   source_provider/source_id, freshness in last_verified_at.
 *   derived       — fields derived from user interaction, not primary
 *                   sources: reply intelligence (readiness/contacted) or a
 *                   fit-score run has produced evidence for this row.
 *   ai_classified — no primary source, but AI-derived classification (bio,
 *                   role, thesis) with `fit_score_breakdown` present.
 *   unknown       — no qualifying evidence.
 *
 * Freshness contract: any staleness downgrade (90-day window, from verified
 * → derived) sets qualification_notes = '[stale NNNd]' — never silent, and
 * never demoted below derived: evidence existed and is merely old.
 */

import { createClient } from "@supabase/supabase-js";

export const STALE_DAYS = 90;

export type QualificationTier = "verified" | "derived" | "ai_classified" | "unknown";

export interface QualificationTiering {
  tier: QualificationTier;
  basis: string;
  staleDays: number | null;
}

/**
 * Pure classifier — no I/O, fully testable. Prefers the strongest evidence.
 */
export function classifyTier(
  row: {
    verification_status: string | null;
    source_provider: string | null;
    source_id: string | null;
    last_verified_at: string | null;
    fit_score_breakdown: unknown;
    outreach_readiness: string | null;
    fit_score: number | null;
  },
  now: Date = new Date()
): QualificationTiering {
  const staleDays = row.last_verified_at
    ? Math.floor((now.getTime() - new Date(row.last_verified_at).getTime()) / 86_400_000)
    : null;
  const stale = staleDays !== null && staleDays > STALE_DAYS;

  // Primary-source verification (EDGAR by CIK, or Apollo org match).
  // Provider literals in the wild include 'sec_edgar', 'apollo' and batch
  // identifiers like 'edgar_restore_2026_09' — accept the EDGAR family.
  // NOTE: keyed on evidence only (provider + source_id), never on the stored
  // status — the pass itself rewrites statuses, so reading it back would make
  // demotions cascade (verified → derived → unknown) across runs.
  const provider = (row.source_provider || "").toLowerCase();
  const isPrimaryProvider = provider === "apollo" || provider.startsWith("edgar") || provider.startsWith("sec");
  if (isPrimaryProvider && row.source_id) {
    return stale
      ? { tier: "derived", basis: "primary_source_stale", staleDays }
      : { tier: "verified", basis: "primary_source", staleDays };
  }

  // Reply/fit evidence from product interaction
  if (
    row.outreach_readiness === "contacted" ||
    row.outreach_readiness === "ready" ||
    (row.fit_score ?? 0) > 0 ||
    row.outreach_readiness === "do_not_contact"
  ) {
    return { tier: "derived", basis: "interaction_evidence", staleDays };
  }

  // AI-derived classification
  if (
    row.fit_score_breakdown &&
    typeof row.fit_score_breakdown === "object" &&
    Object.keys(row.fit_score_breakdown as object).length > 0
  ) {
    return { tier: "ai_classified", basis: "ai_classification", staleDays };
  }

  return { tier: "unknown", basis: "no_evidence", staleDays };
}

export interface QualificationPassSummary {
  status: "completed" | "failed";
  scanned: number;
  tierCounts: Record<QualificationTier, number>;
  upgrades: number;
  downgrades: number;
  staleNotes: number;
  error?: string;
}

function sp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function recordJob(outcome: QualificationPassSummary): Promise<void> {
  try {
    const now = new Date().toISOString();
    await sp().from("background_jobs").insert({
      job_type: "qualification_pass",
      status: outcome.status === "failed" ? "failed" : "completed",
      priority: 5,
      input: { scheduled: true },
      output: outcome as unknown as Record<string, unknown>,
      error_message: outcome.error || null,
      started_at: now,
      completed_at: now,
    });
  } catch {
    // observability is best-effort
  }
}

/** Stale stamp — never silent demotion. */
function staleNote(existing: string | null, staleDays: number): string {
  const stamp = `[stale ${staleDays}d]`;
  if (existing && existing.includes(stamp)) return existing;
  const cleaned = (existing || "").replace(/\[stale \d+d\]/g, "").trim();
  return (cleaned ? `${cleaned} ` : "") + stamp;
}

export async function runQualificationPass(opts?: { limit?: number; userId?: string }): Promise<QualificationPassSummary> {
  const summary: QualificationPassSummary = {
    status: "completed", scanned: 0,
    tierCounts: { verified: 0, derived: 0, ai_classified: 0, unknown: 0 },
    upgrades: 0, downgrades: 0, staleNotes: 0,
  };

  try {
    const db = sp();
    const limit = Math.min(20_000, Math.max(100, opts?.limit ?? 12_500));

    const rank: Record<QualificationTier, number> = { verified: 3, derived: 2, ai_classified: 1, unknown: 0 };

    const { data: rows, error } = await db
      .from("investors")
      .select("id, verification_status, source_provider, source_id, last_verified_at, fit_score_breakdown, outreach_readiness, fit_score, qualification_notes")
      .eq("is_active", true)
      .limit(limit);
    if (error) throw error;

    const now = new Date();
    const verifiedIds: string[] = [];
    const derivedIds: string[] = [];
    const aiIds: string[] = [];
    const unknownIds: string[] = [];
    const staleRows: Array<{ id: string; notes: string }> = [];

    for (const row of rows || []) {
      summary.scanned++;
      const t = classifyTier(row, now);
      summary.tierCounts[t.tier]++;

      (t.tier === "verified" ? verifiedIds : t.tier === "derived" ? derivedIds : t.tier === "ai_classified" ? aiIds : unknownIds).push(row.id);

      const currentRank = rank[(row.verification_status as QualificationTier) || "unknown"] ?? 0;
      const newRank = rank[t.tier];
      if (newRank > currentRank) summary.upgrades++;
      if (newRank < currentRank) summary.downgrades++;

      if (t.tier === "derived" && t.basis === "primary_source_stale" && t.staleDays !== null) {
        staleRows.push({ id: row.id, notes: staleNote(row.qualification_notes, t.staleDays) });
        summary.staleNotes++;
      }
    }

    const stamp = new Date().toISOString();
    const bulk = async (ids: string[], status: string) => {
      while (ids.length > 0) {
        const chunk = ids.splice(0, 1000);
        const { error: upErr } = await db.from("investors").update({ verification_status: status, updated_at: stamp }).in("id", chunk);
        if (upErr) throw upErr;
      }
    };
    await bulk(verifiedIds, "verified");
    await bulk(derivedIds, "derived");
    await bulk(aiIds, "ai_classified");
    await bulk(unknownIds, "unknown");

    // Stale stamps for demoted rows (separate update per batched chunk)
    for (const s of staleRows) {
      await db.from("investors").update({ qualification_notes: s.notes }).eq("id", s.id);
    }

    await recordJob(summary);
    if (opts?.userId) {
      const { logAdminAction } = await import("@/lib/services/admin/audit");
      logAdminAction({ userId: opts.userId, action: "qualification_pass_run", entityType: "investor", details: summary as unknown as Record<string, unknown> });
    }
    return summary;
  } catch (err) {
    summary.status = "failed";
    summary.error = String((err as Error).message || err).slice(0, 300);
    await recordJob(summary);
    return summary;
  }
}
