"use client";

/**
 * QualificationBadge — surfaces evidence tiers and data freshness in the
 * founder-facing UI.
 *
 * Tier is computed from the same classifier the scheduled qualification pass
 * uses (src/lib/services/investor/qualification-tiers.ts), so what the user
 * sees always matches the data pipeline:
 *
 *   Source-verified  — primary-source evidence (SEC EDGAR / Apollo), fresh
 *   Source-verified  — primary-source evidence older than 90 days
 *   (stale)            (re-verification is scheduled in the daily cron)
 *   Derived          — evidence from product interaction (fit scoring,
 *                      replies), no primary source
 *   AI-classified    — AI classification without a primary source
 *   Unqualified      — no qualifying evidence
 */

import React from "react";
import { Badge } from "@/components/ui/Badge";
import { classifyTier, type QualificationTier } from "@/lib/services/investor/qualification-tiers";

const TIER_META: Record<
  QualificationTier,
  { label: string; variant: "success" | "warning" | "info" | "default"; icon: string; hint: string }
> = {
  verified: {
    label: "Source-verified",
    variant: "success",
    icon: "ri-shield-check-fill",
    hint: "Backed by a primary source (SEC filings / Apollo) with fresh evidence.",
  },
  derived: {
    label: "Derived",
    variant: "info",
    icon: "ri-file-list-2-line",
    hint: "Evidence from product interaction (fit scoring, replies) — no primary source.",
  },
  ai_classified: {
    label: "AI-classified",
    variant: "default",
    icon: "ri-sparkling-2-line",
    hint: "Classified by AI models without a primary source — treat as a lead, not a fact.",
  },
  unknown: {
    label: "Unqualified",
    variant: "default",
    icon: "ri-doubt-line",
    hint: "No qualifying evidence recorded yet.",
  },
};

export interface QualificationBadgeProps {
  verification_status: string | null;
  last_verified_at: string | null;
  source_provider?: string | null;
  /** Optional: real source_id when the caller has it. Provider presence alone
   *  is treated as source-backed for display purposes. */
  source_id?: string | null;
  qualification_notes?: string | null;
  fit_score_breakdown?: unknown;
  fit_score?: number | null;
  outreach_readiness?: string | null;
  /** inline: label + freshness text; badge: label only */
  variant?: "badge" | "inline";
  className?: string;
}

export function QualificationBadge({
  verification_status,
  last_verified_at,
  source_provider,
  source_id,
  qualification_notes,
  fit_score_breakdown,
  fit_score,
  outreach_readiness,
  variant = "badge",
  className = "",
}: QualificationBadgeProps) {
  const tiering = classifyTier(
    {
      verification_status,
      source_provider: source_provider ?? null,
      source_id: source_id ?? (source_provider ? "1" : null),
      last_verified_at,
      fit_score_breakdown: fit_score_breakdown ?? {},
      outreach_readiness: outreach_readiness ?? null,
      fit_score: fit_score ?? null,
    },
    new Date()
  );

  const meta = TIER_META[tiering.tier];
  const stale = tiering.basis === "primary_source_stale" && tiering.staleDays !== null;
  const label = stale ? `${meta.label} (stale)` : meta.label;
  const freshness =
    tiering.staleDays !== null ? ` · evidence ${tiering.staleDays}d old` : "";
  const hint = `${meta.hint}${stale ? " Re-verification is scheduled." : ""}${
    qualification_notes?.includes("[stale") ? " Marked stale by the qualification pipeline." : ""
  }`;

  return (
    <span
      className={`inline-flex items-center gap-[6px] ${className}`}
      title={`${label}${freshness} — ${hint}`}
    >
      <Badge variant={stale ? "warning" : meta.variant} size="sm">
        <i className={`${stale ? "ri-shield-check-line" : meta.icon} mr-[2px]`}></i>
        {label}
      </Badge>
      {variant === "inline" && freshness && (
        <span className="text-[11px] text-gray-400">{freshness.replace(" · ", "")}</span>
      )}
    </span>
  );
}
