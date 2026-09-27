// =============================================
// Fundraising Pipeline — Stage Definitions
// =============================================
// Single source of truth for pipeline stages.
// Shared by the pipeline API route and (Phase 2) the per-user
// pipeline tables. Do not export from route files — Next.js
// route modules may only export handlers and route config.

export const PIPELINE_STAGES = [
  { id: "discovered",    label: "Discovered",     color: "bg-gray-400",   description: "Found in database" },
  { id: "qualified",     label: "Qualified",      color: "bg-blue-500",   description: "Reviewed and looks relevant" },
  { id: "researching",   label: "Researching",    color: "bg-indigo-500", description: "Deep research in progress" },
  { id: "outreach",      label: "Outreach Ready", color: "bg-lime-500",   description: "Ready to contact" },
  { id: "contacted",     label: "Contacted",      color: "bg-purple-500", description: "First email sent" },
  { id: "meeting",       label: "Meeting",        color: "bg-amber-500",  description: "Meeting scheduled or held" },
  { id: "follow_up",     label: "Follow-up",      color: "bg-orange-500", description: "Post-meeting follow-up" },
  { id: "due_diligence", label: "Due Diligence",  color: "bg-cyan-500",   description: "Investor is diligencing" },
  { id: "term_sheet",    label: "Term Sheet",     color: "bg-green-600",  description: "Term sheet received" },
  { id: "closed",        label: "Closed",         color: "bg-green-700",  description: "Investment closed" },
  { id: "passed",        label: "Passed",         color: "bg-red-400",    description: "Investor passed or not a fit" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

export const PIPELINE_STAGE_IDS: PipelineStageId[] = PIPELINE_STAGES.map((s) => s.id);

export function isPipelineStageId(value: unknown): value is PipelineStageId {
  return typeof value === "string" && PIPELINE_STAGE_IDS.includes(value as PipelineStageId);
}

/** Maps legacy outreach_readiness values → pipeline stages (migration/fallback). */
export const READINESS_TO_STAGE: Record<string, PipelineStageId> = {
  not_ready:          "discovered",
  needs_verification: "qualified",
  ready:              "outreach",
  contacted:          "contacted",
  do_not_contact:     "passed",
  low_priority:       "discovered",
  interested:         "meeting",
};

/** Maps pipeline stage → legacy outreach_readiness (kept in sync during migration). */
export const STAGE_TO_READINESS: Record<PipelineStageId, string> = {
  discovered:    "not_ready",
  qualified:     "needs_verification",
  researching:   "needs_verification",
  outreach:      "ready",
  contacted:     "contacted",
  meeting:       "interested",
  follow_up:     "contacted",
  due_diligence: "interested",
  term_sheet:    "interested",
  closed:        "contacted",
  passed:        "do_not_contact",
};
