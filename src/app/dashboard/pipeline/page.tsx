"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { ChequeEditor, RoundSummary, RoundTargetsForm } from "@/components/Dashboard/PipelineRound";
import type { RoundMetrics } from "@/lib/services/pipeline/metrics";
import { toast } from "sonner";

// ── Types ──
interface PipelineStage {
  id: string;
  label: string;
  color: string;
  description: string;
  count: number;
}
interface DatasetStatus {
  source: string;
  label: string;
  byStage: Record<string, number>;
  total: number;
}

interface PipelineInvestor {
  id: string;
  full_name: string;
  firm_name: string | null;
  investor_type: string;
  fit_score: number;
  /** Task 2.5: shared batch-qualification status (renamed from
   *  outreach_readiness so it reads as dataset state, not the user's stage). */
  dataset_status: string | null;
  pipeline_stage: string;
  country: string | null;
  email: string | null;
  created_at: string;
  /** Expected cheque for this investor; null means "not set", not zero. */
  expected_amount: number | null;
  /** Explicit 0-100, or null to use the stage default. */
  probability: number | null;
  /** Why the relationship ended; only set on a lost stage. */
  lost_reason: string | null;
  /** When this investor entered their current stage. */
  stage_entered_at?: string | null;
}

interface StageEvent {
  id: string;
  fromStage: string | null;
  toStage: string;
  notes: string | null;
  createdAt: string;
}

const LOST_STAGES = ["closed_lost", "not_a_fit"];

interface StageData {
  investors: PipelineInvestor[];
  total: number;
  loading: boolean;
  loaded: boolean;
  page: number;
}

// ── Constants ──
const STAGE_BG: Record<string, string> = {
  discovered: "bg-gray-50 dark:bg-gray-800/30",
  qualified: "bg-blue-50/40 dark:bg-blue-900/10",
  researching: "bg-indigo-50/40 dark:bg-indigo-900/10",
  outreach: "bg-lime-50/40 dark:bg-lime-900/10",
  contacted: "bg-purple-50/40 dark:bg-purple-900/10",
  meeting: "bg-amber-50/40 dark:bg-amber-900/10",
  follow_up: "bg-orange-50/40 dark:bg-orange-900/10",
  due_diligence: "bg-cyan-50/40 dark:bg-cyan-900/10",
  term_sheet: "bg-green-50/40 dark:bg-green-900/10",
  closed: "bg-emerald-50/40 dark:bg-emerald-900/10",
  passed: "bg-red-50/40 dark:bg-red-900/10",
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
  onSaved,
  onDragStart,
  onDragEnd,
}: {
  investor: PipelineInvestor;
  stages: PipelineStage[];
  onMove: (investorId: string, stage: string, fromStage?: string, lostReason?: string) => void;
  moving: boolean;
  onSaved: () => void;
  onDragStart: (investor: PipelineInvestor) => void;
  onDragEnd: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StageEvent[] | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = investor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  // Load on first open; a second open reuses what was already fetched.
  const toggleHistory = async () => {
    setShowHistory((v) => !v);
    if (history !== null) return;
    try {
      const res = await fetch(`/api/investors/pipeline?history=${investor.id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setHistory(data.events || []);
    } catch {
      setHistory([]);
    }
  };

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
    <div
      draggable
      onDragStart={(e) => {
        // The page owns the drag payload; dataTransfer is set as well so the
        // drop still works if state is lost between frames.
        e.dataTransfer.setData("text/plain", investor.id);
        e.dataTransfer.setData("application/x-pipeline-stage", investor.pipeline_stage);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(investor);
      }}
      onDragEnd={onDragEnd}
      title="Drag onto a stage tile to move"
      className="bg-white dark:bg-[#1a1f2e] rounded-[12px] p-[14px] border border-gray-100 dark:border-gray-800 hover:border-lime-300 dark:hover:border-lime-700 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
    >
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
        {investor.dataset_status && (
          <span
            className="text-[10px] text-gray-400"
            title="Dataset qualification status (shared batch data). Your pipeline stage on the left column is yours alone."
          >
            Base: {investor.dataset_status.replace(/_/g, " ")}
          </span>
        )}
        {investor.country && <span className="text-[10px] text-gray-400">{investor.country}</span>}
      </div>

      {/* Expected cheque - the input that turns stage counts into money */}
      <div className="mb-[8px]">
        <ChequeEditor
          investorId={investor.id}
          expectedAmount={investor.expected_amount ?? null}
          probability={investor.probability ?? null}
          onSaved={onSaved}
        />
      </div>

      {/* Lost reason — the only place the board says why a raise ended */}
      {investor.lost_reason && (
        <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-[6px] px-[7px] py-[4px] mb-[8px]">
          <i className="ri-flag-line mr-[3px]"></i>
          {investor.lost_reason}
        </p>
      )}

      {/* Stage history */}
      {showHistory && (
        <div className="mb-[8px] rounded-[8px] bg-gray-50 dark:bg-white/5 px-[8px] py-[6px]">
          {history === null ? (
            <p className="text-[10px] text-gray-400 !mb-0">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-[10px] text-gray-400 !mb-0">No stage changes recorded yet.</p>
          ) : (
            <ul className="space-y-[4px]">
              {history.map((h) => (
                <li key={h.id} className="text-[10px] text-gray-500 dark:text-gray-400">
                  {h.fromStage ? `${h.fromStage.replace(/_/g, " ")} → ` : "Added → "}
                  {h.toStage.replace(/_/g, " ")}
                  <span className="text-gray-300 dark:text-gray-600">
                    {" · "}
                    {new Date(h.createdAt).toLocaleDateString()}
                  </span>
                  {h.notes && (
                    <span className="block text-gray-400 italic truncate">{h.notes}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]">
          <span className="text-[10px] text-gray-300 dark:text-gray-600">
            {timeAgo(investor.created_at)}
          </span>
          <button
            onClick={toggleHistory}
            className="text-gray-300 hover:text-lime-600 dark:text-gray-600 p-[2px]"
            title="Stage history"
            aria-label="Stage history"
          >
            <i className="ri-history-line text-[12px]"></i>
          </button>
        </div>

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
  // Mirror of stageData for effects and guards. Keeping it in a ref lets the
  // "load the expanded stage" effect depend only on expandedStage; depending on
  // stageData made every setStageData re-run the effect, which re-fetched the
  // stage and produced a state-update loop.
  const stageDataRef = useRef<Record<string, StageData>>({});
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [countsExplanation, setCountsExplanation] = useState<string | null>(null);
  const [dataset, setDataset] = useState<DatasetStatus | null>(null);
  const [round, setRound] = useState<RoundMetrics | null>(null);

  // Drag and drop. `dragging` holds what is being moved, `dragOver` which tile
  // the pointer is over (so the target can highlight), and `lostDialog` the
  // move that is waiting on a reason before it can be committed.
  const [dragging, setDragging] = useState<{ id: string; stage: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [lostDialog, setLostDialog] = useState<{
    id: string;
    fromStage: string;
    stage: string;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");

  // Load the stage summary (counts only — fast). Background mode skips the
  // skeleton flash when reconciling after a move.
  const loadSummary = useCallback(async (background = false) => {
    if (!background) setSummaryLoading(true);
    try {
      const res = await fetch("/api/investors/pipeline");
      if (!res.ok) throw new Error("Failed to load pipeline");
      const data = await res.json();
      setStages(data.stages || []);
      setCountsExplanation(data.countsExplanation || null);
      setDataset(data.dataset || null);
      setRound(data.round || null);
    } catch (err) {
      console.error("Pipeline summary error:", err);
    } finally {
      if (!background) setSummaryLoading(false);
    }
  }, []);

  // Load investors for a specific stage (on demand)
  const loadStage = useCallback(async (stageId: string, page = 1) => {
    if (stageDataRef.current[stageId]?.loading) return;
    setStageData((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], loading: true },
    }));
    try {
      const res = await fetch(`/api/investors/pipeline?stage=${stageId}&page=${page}&limit=20`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStageData((prev) => ({
        ...prev,
        [stageId]: {
          investors:
            page === 1 ? data.investors : [...(prev[stageId]?.investors || []), ...data.investors],
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
    stageDataRef.current = stageData;
  }, [stageData]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // When a stage is expanded, load its investors once.
  useEffect(() => {
    if (!expandedStage) return;
    const current = stageDataRef.current[expandedStage];
    if (!current?.loaded && !current?.loading) loadStage(expandedStage);
  }, [expandedStage, loadStage]);

  const handleMove = async (
    investorId: string,
    toStage: string,
    fromStage?: string,
    lostReasonText?: string
  ) => {
    setMovingId(investorId);
    try {
      const res = await fetch("/api/investors/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId, stage: toStage, lostReason: lostReasonText }),
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

  // A drop onto a lost stage must capture why before it commits; every other
  // stage moves immediately, which is what a board should feel like.
  const handleDrop = (stageId: string, event?: React.DragEvent) => {
    setDragOver(null);
    // React state is the primary source, but dragend can fire before drop in
    // synthetic/automated drags. dataTransfer is the same payload the card
    // wrote on dragstart, so the move still works when state is already gone.
    const transferId = event?.dataTransfer.getData("text/plain") || "";
    const transferStage = event?.dataTransfer.getData("application/x-pipeline-stage") || "";
    const payload = dragging ?? (transferId ? { id: transferId, stage: transferStage } : null);
    setDragging(null);
    if (!payload || payload.stage === stageId) return;
    if (LOST_STAGES.includes(stageId)) {
      setLostReason("");
      setLostDialog({ id: payload.id, fromStage: payload.stage, stage: stageId });
      return;
    }
    handleMove(payload.id, stageId, payload.stage);
  };

  const totalInvestors = stages.reduce((sum, s) => sum + s.count, 0);
  const activeStages = stages.filter((s) => s.count > 0);

  return (
    <div>
      <PageHeader
        title="Fundraising Pipeline"
        description={`${totalInvestors.toLocaleString()} investor${totalInvestors !== 1 ? "s" : ""} in your pipeline across ${activeStages.length} active stage${activeStages.length !== 1 ? "s" : ""}.`}
        actions={
          <Link href="/dashboard/investors/discover">
            <Button size="sm">
              <i className="ri-add-line text-[16px]"></i>
              Add Investors
            </Button>
          </Link>
        }
      />

      <RoundTargetsForm onSaved={() => loadSummary(true)} />
      {round && <RoundSummary round={round} />}

      {summaryLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-[12px] mb-[24px]">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"
            ></div>
          ))}
        </div>
      ) : (
        <>
          {countsExplanation && (
            <p className="text-[12px] text-gray-400 !mb-[12px]">{countsExplanation}</p>
          )}
          {/* Stage summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-[12px] mb-[24px]">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                onDragOver={(e) => {
                  // preventDefault is what tells the browser this is a legal
                  // drop target; without it the drop event never fires.
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(stage.id);
                }}
                onDragLeave={() => setDragOver((cur) => (cur === stage.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(stage.id, e);
                }}
                className={`text-left p-[14px] rounded-[12px] border transition-all ${
                  dragOver === stage.id
                    ? "border-lime-500 ring-2 ring-lime-300 bg-lime-50 dark:bg-lime-900/20"
                    : expandedStage === stage.id
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

          {/* The corpus's batch qualification is a different fact about a
              different population, so it is shown separately and labelled with
              its source instead of being counted as this founder's pipeline. */}
          {dataset && dataset.total > 0 && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-[12px] px-[14px] py-[10px] mb-[24px] bg-gray-50 dark:bg-white/5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 !mb-[6px]">
                {dataset.label}
              </p>
              <div className="flex flex-wrap gap-x-[16px] gap-y-[4px]">
                {stages
                  .filter((s) => (dataset.byStage?.[s.id] || 0) > 0)
                  .map((s) => (
                    <span key={s.id} className="text-[12px] text-gray-500 dark:text-gray-400">
                      {s.label}:{" "}
                      <span className="font-semibold">
                        {(dataset.byStage[s.id] || 0).toLocaleString()}
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          )}

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
                          <div
                            className={`w-[10px] h-[10px] rounded-full ${stage?.color || "bg-gray-400"}`}
                          ></div>
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
                            <div
                              key={i}
                              className="animate-pulse h-[120px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"
                            ></div>
                          ))}
                        </div>
                      ) : !sd?.investors?.length ? (
                        <div className="text-center py-[40px]">
                          <i className="ri-inbox-line text-[32px] text-gray-200 dark:text-gray-700 block mb-[12px]"></i>
                          <p className="text-[14px] text-gray-400 !mb-[12px]">
                            No investors in this stage yet.
                          </p>
                          <Link href="/dashboard/investors">
                            <Button variant="outline" size="sm">
                              Browse Investors
                            </Button>
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
                                onSaved={() => loadSummary(true)}
                                onDragStart={(card) =>
                                  setDragging({ id: card.id, stage: card.pipeline_stage })
                                }
                                onDragEnd={() => {
                                  setDragging(null);
                                  setDragOver(null);
                                }}
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
                <p className="text-[14px] text-gray-400 !mb-[4px]">
                  Click a stage above to view its investors
                </p>
                <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                  Drag a card onto a stage tile to move it, or use the "Move" button on the card.
                  Dropping onto Closed Lost or Not a Fit asks for a reason first.
                </p>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {/* Lost-reason capture. Dropping onto a lost stage opens this instead of
          committing, so the reason is recorded with the move it explains. */}
      {lostDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-[16px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setLostDialog(null)}
        >
          <div
            className="w-full max-w-[440px] rounded-[14px] bg-white dark:bg-[#1a1f2e] p-[20px] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="!text-[16px] !font-semibold !mb-[4px]">Why did this one end?</h3>
            <p className="text-[12px] text-gray-400 !mb-[12px]">
              Moving to {stages.find((s) => s.id === lostDialog.stage)?.label || "a lost stage"}.
              The reason is saved with the move and shown on the card and its history.
            </p>
            <textarea
              autoFocus
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Ticket size too small, or thesis is consumer, not B2B"
              className="w-full rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white mb-[12px]"
            />
            <div className="flex items-center justify-end gap-[8px]">
              <Button variant="outline" size="sm" onClick={() => setLostDialog(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!lostReason.trim()}
                onClick={() => {
                  const dialog = lostDialog;
                  setLostDialog(null);
                  handleMove(dialog.id, dialog.stage, dialog.fromStage, lostReason.trim());
                }}
              >
                Record reason
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
