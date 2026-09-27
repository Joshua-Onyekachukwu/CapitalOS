"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { toast } from "sonner";

// ── Types ──
interface PipelineStage {
  id: string;
  label: string;
  color: string;
  description: string;
  count: number;
}

interface PipelineInvestor {
  id: string;
  full_name: string;
  firm_name: string | null;
  investor_type: string;
  fit_score: number;
  outreach_readiness: string;
  pipeline_stage: string;
  country: string | null;
  email: string | null;
  created_at: string;
}

interface StageData {
  investors: PipelineInvestor[];
  total: number;
  loading: boolean;
  loaded: boolean;
  page: number;
}

// ── Constants ──
const STAGE_BG: Record<string, string> = {
  discovered:    "bg-gray-50 dark:bg-gray-800/30",
  qualified:     "bg-blue-50/40 dark:bg-blue-900/10",
  researching:   "bg-indigo-50/40 dark:bg-indigo-900/10",
  outreach:      "bg-lime-50/40 dark:bg-lime-900/10",
  contacted:     "bg-purple-50/40 dark:bg-purple-900/10",
  meeting:       "bg-amber-50/40 dark:bg-amber-900/10",
  follow_up:     "bg-orange-50/40 dark:bg-orange-900/10",
  due_diligence: "bg-cyan-50/40 dark:bg-cyan-900/10",
  term_sheet:    "bg-green-50/40 dark:bg-green-900/10",
  closed:        "bg-emerald-50/40 dark:bg-emerald-900/10",
  passed:        "bg-red-50/40 dark:bg-red-900/10",
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "text-green-600" : s >= 60 ? "text-amber-600" : "text-gray-400";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// ── Investor Card ──
function InvestorCard({
  investor,
  stages,
  onMove,
  moving,
}: {
  investor: PipelineInvestor;
  stages: PipelineStage[];
  onMove: (investorId: string, stage: string, fromStage?: string) => void;
  moving: boolean;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = investor.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    }
    if (showMoveMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMoveMenu]);

  return (
    <div className="bg-white dark:bg-[#1a1f2e] rounded-[12px] p-[14px] border border-gray-100 dark:border-gray-800 hover:border-lime-300 dark:hover:border-lime-700 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-[8px] mb-[10px]">
        <div className="flex items-center gap-[8px] min-w-0">
          <div className="w-[30px] h-[30px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[11px] font-bold text-lime-700 dark:text-lime-400 flex-none">
            {initials}
          </div>
          <div className="min-w-0">
            <Link
              href={`/dashboard/investors/${investor.id}`}
              className="text-[13px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600 truncate block"
            >
              {investor.full_name}
            </Link>
            <p className="text-[11px] text-gray-400 truncate !mb-0">
              {investor.firm_name || "Independent"}
            </p>
          </div>
        </div>
        <span className={`text-[12px] font-bold flex-none ${SCORE_COLOR(investor.fit_score)}`}>
          {investor.fit_score}%
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-[6px] flex-wrap mb-[10px]">
        <Badge variant="default" size="sm">
          {investor.investor_type.replace(/_/g, " ")}
        </Badge>
        {investor.country && (
          <span className="text-[10px] text-gray-400">{investor.country}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-300 dark:text-gray-600">{timeAgo(investor.created_at)}</span>

        {/* Move button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMoveMenu((v) => !v)}
            disabled={moving}
            className="flex items-center gap-[4px] text-[11px] text-gray-400 hover:text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/20 px-[8px] py-[4px] rounded-[6px] transition-all"
          >
            <i className="ri-arrow-right-circle-line text-[13px]"></i>
            Move
          </button>
          {showMoveMenu && (
            <div className="absolute right-0 bottom-full mb-[4px] z-50 bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-lg py-[4px] min-w-[160px]">
              {stages.map((s) => {
                if (s.id === investor.pipeline_stage) return null;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onMove(investor.id, s.id, investor.pipeline_stage);
                      setShowMoveMenu(false);
                    }}
                    className="w-full flex items-center gap-[8px] px-[12px] py-[7px] text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                  >
                    <div className={`w-[6px] h-[6px] rounded-full flex-none ${s.color}`}></div>
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function PipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [stageData, setStageData] = useState<Record<string, StageData>>({});
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [hasPipelineStage, setHasPipelineStage] = useState(false);

  // Load the stage summary (counts only — fast). Background mode skips the
  // skeleton flash when reconciling after a move.
  const loadSummary = useCallback(async (background = false) => {
    if (!background) setSummaryLoading(true);
    try {
      const res = await fetch("/api/investors/pipeline");
      if (!res.ok) throw new Error("Failed to load pipeline");
      const data = await res.json();
      setStages(data.stages || []);
      setHasPipelineStage(data.hasPipelineStage || false);
    } catch (err) {
      console.error("Pipeline summary error:", err);
    } finally {
      if (!background) setSummaryLoading(false);
    }
  }, []);

  // Load investors for a specific stage (on demand)
  const loadStage = useCallback(async (stageId: string, page = 1) => {
    setStageData((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], loading: true },
    }));
    try {
      const res = await fetch(
        `/api/investors/pipeline?stage=${stageId}&page=${page}&limit=20`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStageData((prev) => ({
        ...prev,
        [stageId]: {
          investors: page === 1 ? data.investors : [...(prev[stageId]?.investors || []), ...data.investors],
          total: data.total,
          loading: false,
          loaded: true,
          page,
        },
      }));
    } catch {
      setStageData((prev) => ({
        ...prev,
        [stageId]: { ...prev[stageId], loading: false, loaded: true },
      }));
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // When a stage is expanded, load its investors
  useEffect(() => {
    if (expandedStage && !stageData[expandedStage]?.loaded) {
      loadStage(expandedStage);
    }
  }, [expandedStage, stageData, loadStage]);

  const handleMove = async (
    investorId: string,
    toStage: string,
    fromStage?: string
  ) => {
    setMovingId(investorId);
    try {
      const res = await fetch("/api/investors/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId, stage: toStage }),
      });
      if (!res.ok) throw new Error("Failed to move investor");

      let unchanged = false;
      try {
        unchanged = (await res.json())?.unchanged === true;
      } catch {
        /* response body is optional */
      }

      // The card lives in the drawer of its current stage
      const from = fromStage || expandedStage || undefined;

      // Optimistic update: adjust the stage counters and drop the card from
      // the open drawer immediately, without waiting on the slow summary GET.
      if (!unchanged && from && from !== toStage) {
        setStages((prev) =>
          prev.map((s) => {
            if (s.id === from) return { ...s, count: Math.max(0, s.count - 1) };
            if (s.id === toStage) return { ...s, count: s.count + 1 };
            return s;
          })
        );
        setStageData((prev) => {
          const sd = prev[from];
          if (!sd?.investors) return prev;
          return {
            ...prev,
            [from]: {
              ...sd,
              investors: sd.investors.filter((i) => i.id !== investorId),
            },
          };
        });
      }

      const toStageName = stages.find((s) => s.id === toStage)?.label || toStage;
      toast.success(`Moved to ${toStageName}`);

      // Reconcile counters with the server in the background (no skeleton
      // flash), and reset loaded stage data so the open drawer refetches via
      // the expanded-stage effect (explicit loadStage here would double-fetch).
      loadSummary(true);
      setStageData((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((k) => {
          updated[k] = { ...updated[k], loaded: false };
        });
        return updated;
      });
    } catch {
      toast.error("Failed to move investor. Please try again.");
    } finally {
      setMovingId(null);
    }
  };

  const totalInvestors = stages.reduce((sum, s) => sum + s.count, 0);
  const activeStages = stages.filter((s) => s.count > 0);

  return (
    <div>
      <PageHeader
        title="Fundraising Pipeline"
        description={`${totalInvestors.toLocaleString()} investors across ${activeStages.length} active stage${activeStages.length !== 1 ? "s" : ""}.`}
        actions={
          <Link href="/dashboard/investors/discover">
            <Button size="sm">
              <i className="ri-add-line text-[16px]"></i>
              Add Investors
            </Button>
          </Link>
        }
      />

      {/* Migration hint when pipeline_stage column doesn't exist */}
      {!hasPipelineStage && !summaryLoading && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-[12px] p-[14px] mb-[20px] flex items-start gap-[10px]">
          <i className="ri-information-line text-amber-600 text-[18px] flex-none mt-[1px]"></i>
          <div>
            <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200 !mb-[2px]">
              Pipeline running in compatibility mode
            </p>
            <p className="text-[12px] text-amber-700 dark:text-amber-300 !mb-0">
              Run the pipeline migration to enable full stage tracking. Currently using outreach status as a proxy.
            </p>
          </div>
        </div>
      )}

      {summaryLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-[12px] mb-[24px]">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="animate-pulse h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          ))}
        </div>
      ) : (
        <>
          {/* Stage summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-[12px] mb-[24px]">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                className={`text-left p-[14px] rounded-[12px] border transition-all ${
                  expandedStage === stage.id
                    ? "border-lime-400 bg-lime-50 dark:bg-lime-900/20 shadow-sm"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1f2e] hover:border-lime-300 dark:hover:border-lime-700"
                }`}
              >
                <div className="flex items-center gap-[6px] mb-[8px]">
                  <div className={`w-[8px] h-[8px] rounded-full flex-none ${stage.color}`}></div>
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                    {stage.label}
                  </span>
                </div>
                <p className="text-[22px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {stage.count.toLocaleString()}
                </p>
              </button>
            ))}
          </div>

          {/* Expanded stage view */}
          {expandedStage && (
            <Card>
              <CardBody>
                {(() => {
                  const stage = stages.find((s) => s.id === expandedStage);
                  const sd = stageData[expandedStage];
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-[16px]">
                        <div className="flex items-center gap-[10px]">
                          <div className={`w-[10px] h-[10px] rounded-full ${stage?.color || "bg-gray-400"}`}></div>
                          <h3 className="!text-[16px] !font-semibold !mb-0">{stage?.label}</h3>
                          <span className="text-[13px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-[8px] py-[2px] rounded-full">
                            {stage?.count.toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedStage(null)}
                          className="text-gray-400 hover:text-gray-600 p-[4px]"
                          aria-label="Close"
                        >
                          <i className="ri-close-line text-[18px]"></i>
                        </button>
                      </div>

                      {sd?.loading && !sd.investors?.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px]">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="animate-pulse h-[120px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
                          ))}
                        </div>
                      ) : !sd?.investors?.length ? (
                        <div className="text-center py-[40px]">
                          <i className="ri-inbox-line text-[32px] text-gray-200 dark:text-gray-700 block mb-[12px]"></i>
                          <p className="text-[14px] text-gray-400 !mb-[12px]">No investors in this stage yet.</p>
                          <Link href="/dashboard/investors">
                            <Button variant="outline" size="sm">Browse Investors</Button>
                          </Link>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px] mb-[16px]">
                            {sd.investors.map((inv) => (
                              <InvestorCard
                                key={inv.id}
                                investor={inv}
                                stages={stages}
                                onMove={handleMove}
                                moving={movingId === inv.id}
                              />
                            ))}
                          </div>
                          {/* Load more */}
                          {sd.total > sd.investors.length && (
                            <div className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                loading={sd.loading}
                                onClick={() => loadStage(expandedStage, (sd.page || 1) + 1)}
                              >
                                Load more ({sd.total - sd.investors.length} remaining)
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </CardBody>
            </Card>
          )}

          {/* Empty state when nothing is expanded */}
          {!expandedStage && (
            <Card>
              <CardBody className="text-center py-[40px]">
                <i className="ri-kanban-view text-[32px] text-gray-200 dark:text-gray-700 block mb-[12px]"></i>
                <p className="text-[14px] text-gray-400 !mb-[4px]">Click a stage above to view its investors</p>
                <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                  Move investors between stages using the "Move" button on each card.
                </p>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
