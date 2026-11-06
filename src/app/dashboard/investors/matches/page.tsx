"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { toast } from "sonner";

type Band = "all" | "strong" | "possible" | "poor";

interface Factor {
  factor: string;
  score: number;
  weight: number;
  explanation: string;
}

interface Match {
  id: string;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  investor_type: string;
  fit_score: number;
  confidence: number | null;
  factors: Factor[];
  explanationMissing: boolean;
  missingEvidence: string[];
  outreach_readiness: string;
  investment_stages: string[];
  investment_sectors: string[];
  country: string | null;
  firm_name: string | null;
  verdict: string | null;
}

interface MatchesResponse {
  matches: Match[];
  total: number;
  counts: { strong: number; possible: number; poor: number; all: number };
  profileMissing: string[];
  basis: string;
}

const BANDS: { id: Band; label: string }[] = [
  { id: "all", label: "All scored" },
  { id: "strong", label: "Strong (80+)" },
  { id: "possible", label: "Possible (50–79)" },
  { id: "poor", label: "Poor (<50)" },
];

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

/** Confidence is evidence completeness, so it is stated, not implied. */
function confidenceLabel(c: number | null): { text: string; tone: "success" | "warning" | "danger" | "default" } {
  if (c === null) return { text: "confidence unknown", tone: "default" };
  if (c >= 70) return { text: `${c}% evidence`, tone: "success" };
  if (c >= 40) return { text: `${c}% evidence`, tone: "warning" };
  return { text: `${c}% evidence — thin`, tone: "danger" };
}

function MatchRow({ match, onRated }: { match: Match; onRated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const confidence = confidenceLabel(match.confidence);

  const rate = async (verdict: "good_match" | "not_a_fit") => {
    setSaving(verdict);
    try {
      const res = await fetch("/api/investors/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId: match.id, verdict }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save feedback");
      toast.success(verdict === "good_match" ? "Marked as a good match" : "Marked as not a fit");
      onRated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-[12px] bg-white dark:bg-[#1a1f2e] p-[14px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <div className="flex items-center gap-[8px] flex-wrap">
            <Link
              href={`/dashboard/investors/${match.id}`}
              className="text-[14px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600"
            >
              {match.full_name}
            </Link>
            <Badge variant={scoreTone(match.fit_score)} size="sm">
              {match.fit_score}% fit
            </Badge>
            <Badge variant={confidence.tone} size="sm">
              {confidence.text}
            </Badge>
            {match.verdict && (
              <Badge variant={match.verdict === "good_match" ? "success" : "danger"} size="sm">
                {match.verdict === "good_match" ? "You: good match" : "You: not a fit"}
              </Badge>
            )}
          </div>
          <p className="text-[12px] text-gray-400 !mt-[4px] !mb-0">
            {match.investor_type.replace(/_/g, " ")}
            {match.country ? ` · ${match.country}` : ""}
            {match.email ? ` · ${match.email}` : " · no email on file"}
          </p>
        </div>

        <div className="flex items-center gap-[6px] flex-none">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-gray-500 hover:text-lime-600 px-[8px] py-[4px] rounded-[6px] hover:bg-lime-50 dark:hover:bg-lime-900/20"
          >
            {open ? "Hide why" : "Why?"}
          </button>
          <button
            onClick={() => rate("good_match")}
            disabled={saving !== null}
            className={`text-[11px] px-[8px] py-[4px] rounded-[6px] ${
              match.verdict === "good_match"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "text-gray-500 hover:bg-green-50 dark:hover:bg-green-900/20"
            } disabled:opacity-50`}
            title="Confirm this is a relevant investor"
          >
            <i className="ri-thumb-up-line"></i>
          </button>
          <button
            onClick={() => rate("not_a_fit")}
            disabled={saving !== null}
            className={`text-[11px] px-[8px] py-[4px] rounded-[6px] ${
              match.verdict === "not_a_fit"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            } disabled:opacity-50`}
            title="Reject this match"
          >
            <i className="ri-thumb-down-line"></i>
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-[12px] border-t border-gray-100 dark:border-gray-800 pt-[10px]">
          {match.explanationMissing ? (
            <p className="text-[12px] text-amber-600 !mb-0">
              This score has no stored breakdown, so it cannot be explained. Re-run fit analysis
              to produce one.
            </p>
          ) : (
            <div className="space-y-[6px]">
              {match.factors.map((f) => (
                <div key={f.factor} className="flex items-start gap-[10px]">
                  <div className="w-[110px] flex-none">
                    <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 !mb-0">
                      {f.factor}
                    </p>
                    <p className="text-[10px] text-gray-400 !mb-0">
                      weight {Math.round(f.weight * 100)}%
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-[6px] rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full ${
                          f.score >= 70 ? "bg-green-500" : f.score >= 40 ? "bg-amber-500" : "bg-red-400"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, f.score))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 !mt-[2px] !mb-0">
                      {f.explanation}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500 w-[34px] text-right flex-none">
                    {f.score}
                  </span>
                </div>
              ))}
            </div>
          )}

          {match.missingEvidence.length > 0 && (
            <p className="text-[11px] text-amber-600 !mt-[8px] !mb-0">
              Scored without: {match.missingEvidence.join(", ")}. Confidence reflects that gap.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const [band, setBand] = useState<Band>("all");
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (b: Band) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/investors/matches?band=${b}&limit=40`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load matches");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(band);
  }, [band, load]);

  const counts = data?.counts;

  return (
    <div>
      <PageHeader
        title="Matches"
        description="Investors ranked against your company, each with the factors behind the score."
      />

      {data && data.profileMissing.length > 0 && (
        <div className="border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 rounded-[12px] px-[14px] py-[10px] mb-[16px]">
          <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300 !mb-[2px]">
            Your profile is missing fields the scorer needs
          </p>
          <p className="text-[12px] text-amber-700 dark:text-amber-400 !mb-[6px]">
            {data.profileMissing.join(", ")} — scores below under-weight sector, stage and geography
            fit.
          </p>
          <Link href="/dashboard/startup" className="text-[12px] font-medium text-amber-900 dark:text-amber-200 underline">
            Complete your profile →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px] mb-[16px]">
        {BANDS.map((b) => {
          const count = b.id === "all" ? counts?.all : counts?.[b.id];
          return (
            <button
              key={b.id}
              onClick={() => setBand(b.id)}
              className={`text-left p-[12px] rounded-[12px] border transition-all ${
                band === b.id
                  ? "border-lime-400 bg-lime-50 dark:bg-lime-900/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1f2e] hover:border-lime-300"
              }`}
            >
              <p className="text-[11px] text-gray-500 dark:text-gray-400 !mb-[4px]">{b.label}</p>
              <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                {count === undefined ? "—" : count.toLocaleString()}
              </p>
            </button>
          );
        })}
      </div>

      {data && (
        <p className="text-[11px] text-gray-400 !mb-[12px]">{data.basis}</p>
      )}

      {loading ? (
        <div className="space-y-[8px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse h-[74px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardBody className="text-center py-[32px]">
            <p className="text-[13px] text-red-600 !mb-[8px]">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load(band)}>
              Retry
            </Button>
          </CardBody>
        </Card>
      ) : !data?.matches.length ? (
        <Card>
          <CardBody className="text-center py-[32px]">
            <i className="ri-user-search-line text-[30px] text-gray-200 dark:text-gray-700 block mb-[10px]"></i>
            <p className="text-[13px] text-gray-400 !mb-[8px]">
              No investors are scored in this band yet.
            </p>
            <Link href="/dashboard/investors/discover">
              <Button variant="outline" size="sm">
                Run fit analysis
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[8px]">
          {data.matches.map((m) => (
            <MatchRow key={m.id} match={m} onRated={() => load(band)} />
          ))}
          <p className="text-[11px] text-gray-400 text-center !mt-[10px]">
            Showing {data.matches.length} of {data.total.toLocaleString()} — refine with filters on
            Discover.
          </p>
        </div>
      )}
    </div>
  );
}
