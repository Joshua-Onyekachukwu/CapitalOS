// =============================================
// Fundraising Pipeline — Stage Definitions
// =============================================
// Single source of truth for pipeline stages.
// Shared by the pipeline API route and the per-user pipeline tables.
// Do not export from route files — Next.js route modules may only export
// handlers and route config.
//
// The 21 stages below are the set fixed by the product brief (§10). The order is
// deliberate: it is the order a real raise moves through, so a board or funnel
// rendered from this array reads top-to-bottom as progress.
//
// The database mirrors this list in the CHECK constraint created by migration
// 024. Those two lists must change together — the constraint is what stops an
// unrenderable stage reaching a row, and this array is what the board renders.

export const PIPELINE_STAGES = [
  { id: "discovered",              label: "Discovered",              color: "bg-gray-400",   description: "Found in the investor database" },
  { id: "researching",             label: "Researching",             color: "bg-indigo-500", description: "Deep research in progress" },
  { id: "shortlisted",             label: "Shortlisted",             color: "bg-blue-500",   description: "Reviewed and worth pursuing" },
  { id: "introduction_requested",  label: "Introduction Requested",  color: "bg-sky-500",    description: "Asked a mutual contact for an intro" },
  { id: "introduction_received",   label: "Introduction Received",   color: "bg-sky-600",    description: "Warm introduction made" },
  { id: "outreach_drafted",        label: "Outreach Drafted",        color: "bg-lime-500",   description: "Message prepared, not yet sent" },
  { id: "contacted",               label: "Contacted",               color: "bg-purple-500", description: "First message sent" },
  { id: "responded",               label: "Responded",              color: "bg-fuchsia-500", description: "Investor replied" },
  { id: "meeting_scheduled",       label: "Meeting Scheduled",       color: "bg-amber-500",  description: "A call or meeting is booked" },
  { id: "first_meeting_completed", label: "First Meeting Completed", color: "bg-amber-600",  description: "First meeting happened" },
  { id: "follow_up",               label: "Follow-up",               color: "bg-orange-500", description: "Post-meeting follow-up owed or sent" },
  { id: "due_diligence",           label: "Due Diligence",           color: "bg-cyan-500",   description: "Investor is diligencing" },
  { id: "partner_meeting",         label: "Partner Meeting",         color: "bg-teal-500",   description: "Presenting to the partnership" },
  { id: "verbal_commitment",       label: "Verbal Commitment",       color: "bg-emerald-500", description: "Soft yes, nothing signed" },
  { id: "term_sheet",              label: "Term Sheet",              color: "bg-green-600",  description: "Term sheet received" },
  { id: "negotiation",             label: "Negotiation",             color: "bg-green-500",  description: "Negotiating terms" },
  { id: "committed",               label: "Committed",               color: "bg-green-700",  description: "Committed, pending close" },
  { id: "closed_won",              label: "Closed Won",              color: "bg-emerald-700", description: "Funds received" },
  { id: "closed_lost",             label: "Closed Lost",             color: "bg-red-500",    description: "Lost after real engagement" },
  { id: "not_a_fit",               label: "Not a Fit",               color: "bg-red-400",    description: "Rule out — never contact again" },
  { id: "on_hold",                 label: "On Hold",                 color: "bg-yellow-500", description: "Paused by either side" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

export const PIPELINE_STAGE_IDS: PipelineStageId[] = PIPELINE_STAGES.map((s) => s.id);

export function isPipelineStageId(value: unknown): value is PipelineStageId {
  return typeof value === "string" && PIPELINE_STAGE_IDS.includes(value as PipelineStageId);
}

/**
 * Stages where the relationship is finished. Kept separate so analytics can
 * exclude them from "active pipeline" without hardcoding ids at each call site.
 */
export const TERMINAL_STAGES: PipelineStageId[] = ["closed_won", "closed_lost", "not_a_fit"];

export function isTerminalStage(stage: PipelineStageId): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/** Maps legacy outreach_readiness values → pipeline stages (batch dataset state). */
export const READINESS_TO_STAGE: Record<string, PipelineStageId> = {
  not_ready:          "discovered",
  needs_verification: "shortlisted",
  ready:              "outreach_drafted",
  contacted:          "contacted",
  do_not_contact:     "not_a_fit",
  low_priority:       "discovered",
  interested:         "meeting_scheduled",
};

/**
 * Maps pipeline stage → legacy outreach_readiness.
 *
 * Typed as a total Record, so adding a stage above without stating its legacy
 * meaning is a compile error rather than a silent undefined.
 */
export const STAGE_TO_READINESS: Record<PipelineStageId, string> = {
  discovered:              "not_ready",
  researching:             "needs_verification",
  shortlisted:             "needs_verification",
  introduction_requested:  "needs_verification",
  introduction_received:   "needs_verification",
  outreach_drafted:        "ready",
  contacted:               "contacted",
  responded:               "contacted",
  meeting_scheduled:       "interested",
  first_meeting_completed: "interested",
  follow_up:               "contacted",
  due_diligence:           "interested",
  partner_meeting:         "interested",
  verbal_commitment:       "interested",
  term_sheet:              "interested",
  negotiation:             "interested",
  committed:               "interested",
  closed_won:              "contacted",
  closed_lost:             "contacted",
  not_a_fit:               "do_not_contact",
  on_hold:                 "low_priority",
};
