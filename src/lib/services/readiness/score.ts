// =============================================
// Fundraising Readiness — assessment engine
// =============================================
// Pure function, no I/O: everything it returns is derived from the inputs it is
// given. That makes the score reproducible and unit-testable, and means the page
// can explain any number it shows.
//
// What this measures — and what it must not claim
// ------------------------------------------------
// This is an *evidence* assessment: is the material an investor will ask for
// present, current and specific? It is not a judgement that a company will raise.
// A 100 means "nothing obvious is missing from your file", not "you are fundable".
// The UI states this; the API returns the same caveat as data.
//
// Two rules that the previous counter got wrong and this one enforces:
//
//   1. `null` and `0` are different answers. A pre-revenue founder who reports
//      MRR 0 has answered the question; penalising them for truthfulness teaches
//      them to lie to the scorer. `mrr ?? arr` presence is what counts.
//   2. A declared "no" is not a missing answer. `currently_raising = false` is a
//      recorded decision, so it is reported as a blocker with its reason rather
//      than silently costing points.
//
// Weights sum to 100 so the score is a percentage of available evidence.

export type CriterionStatus = "met" | "missing";

export interface Criterion {
  id: string;
  label: string;
  /** Points awarded when met. */
  weight: number;
  status: CriterionStatus;
  /** The stored field this criterion reads, so the UI can name the source. */
  field: string;
  /** Why it is missing, or what was found. Never a guess. */
  detail?: string;
}

export interface Category {
  id: string;
  label: string;
  /** What this category is trying to establish, in one line. */
  purpose: string;
  score: number;
  max: number;
  criteria: Criterion[];
}

export interface ReadinessAction {
  /** Criterion id it resolves, so completing it can be verified later. */
  criterionId: string;
  label: string;
  detail: string;
  /** Points gained by completing it. */
  points: number;
  categoryId: string;
  href: string;
}

export type ReadinessBand =
  | "not_started"
  | "early"
  | "developing"
  | "nearly_ready"
  | "raise_ready";

export interface ReadinessAssessment {
  score: number;
  band: ReadinessBand;
  bandLabel: string;
  categories: Category[];
  /** Missing criteria, highest weight first. */
  actions: ReadinessAction[];
  /** Criteria met out of total, for "18 of 24 items in place". */
  met: number;
  total: number;
  /** Things that block a raise regardless of score. */
  blockers: string[];
  /** Stated on every response so no caller can present the score as a promise. */
  disclaimer: string;
}

/** The subset of a company profile this engine reads. */
export interface ReadinessProfile {
  companyName: string | null;
  industry: string | null;
  location: string | null;
  websiteUrl: string | null;
  companyStage: string | null;
  businessModel: string | null;
  oneLiner: string | null;
  description: string | null;
  differentiator: string | null;
  targetCustomer: string | null;
  currentlyRaising: boolean;
  fundingAmount: number | null;
  roundType: string | null;
  targetChequeMin: number | null;
  targetChequeMax: number | null;
  mrr: number | null;
  arr: number | null;
  customerCount: number | null;
  growthRate: string | null;
  milestones: string[];
  employeeCount: number | null;
}

export interface ReadinessDocument {
  documentType: string;
  /** A row with no stored object cannot be handed to an investor. */
  hasFile: boolean;
}

export interface ReadinessTeamMember {
  name: string;
  title?: string | null;
  bio?: string | null;
  isFounder: boolean;
}

export interface ReadinessInput {
  profile: ReadinessProfile;
  documents: ReadinessDocument[];
  teamMembers: ReadinessTeamMember[];
}

const DISCLAIMER =
  "This assesses whether the material investors ask for is present in your profile. " +
  "It does not predict whether you will raise.";

const DESCRIPTION_MIN_CHARS = 120;

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "not set";
  return `$${value.toLocaleString("en-US")}`;
}

export function assessReadiness(input: ReadinessInput): ReadinessAssessment {
  const { profile, documents, teamMembers } = input;

  const hasDeck = documents.some((d) => d.documentType === "pitch_deck" && d.hasFile);
  // A deck row whose object was never stored is worse than no row: it looks
  // present in the list. It is counted here so the action explains why.
  const strandedDeck = documents.some((d) => d.documentType === "pitch_deck" && !d.hasFile);
  const otherDocs = documents.filter((d) => d.documentType !== "pitch_deck" && d.hasFile);
  const founder = teamMembers.find((m) => m.isFounder);
  const detailedMember = teamMembers.find((m) => filled(m.title) || filled(m.bio));

  // Revenue presence, not truthiness: 0 is an answer.
  const revenueReported = profile.arr !== null || profile.mrr !== null;

  const categories: Category[] = [
    {
      id: "foundation",
      label: "Company foundation",
      purpose: "An investor can identify and look up the company.",
      criteria: [
        {
          id: "company_name", label: "Registered or trading name", weight: 3,
          field: "company_profiles.company_name",
          status: filled(profile.companyName) ? "met" : "missing",
        },
        {
          id: "industry", label: "Industry", weight: 3,
          field: "company_profiles.industry",
          status: filled(profile.industry) ? "met" : "missing",
        },
        {
          id: "company_stage", label: "Current stage", weight: 3,
          field: "company_profiles.company_stage",
          status: filled(profile.companyStage) ? "met" : "missing",
        },
        {
          id: "location", label: "Location", weight: 2,
          field: "company_profiles.location",
          status: filled(profile.location) ? "met" : "missing",
        },
        {
          id: "website", label: "Website", weight: 2,
          field: "company_profiles.website_url",
          status: filled(profile.websiteUrl) ? "met" : "missing",
        },
        {
          id: "business_model", label: "Business model", weight: 2,
          field: "company_profiles.business_model",
          status: filled(profile.businessModel) ? "met" : "missing",
        },
      ],
      score: 0, max: 0,
    },
    {
      id: "positioning",
      label: "Positioning",
      purpose: "The problem, the customer and the difference are stated specifically.",
      criteria: [
        {
          id: "one_liner", label: "One-line description", weight: 5,
          field: "company_profiles.one_liner",
          status: filled(profile.oneLiner) ? "met" : "missing",
        },
        {
          id: "description", label: `Description (at least ${DESCRIPTION_MIN_CHARS} characters)`, weight: 5,
          field: "company_profiles.description",
          status: filled(profile.description) && profile.description!.trim().length >= DESCRIPTION_MIN_CHARS
            ? "met"
            : "missing",
          detail: filled(profile.description)
            ? `${profile.description!.trim().length} characters — investors read this before replying`
            : undefined,
        },
        {
          id: "differentiator", label: "Why you win", weight: 5,
          field: "company_profiles.differentiator",
          status: filled(profile.differentiator) ? "met" : "missing",
        },
        {
          id: "target_customer", label: "Target customer", weight: 5,
          field: "company_profiles.target_customer",
          status: filled(profile.targetCustomer) ? "met" : "missing",
        },
      ],
      score: 0, max: 0,
    },
    {
      id: "traction",
      label: "Traction",
      purpose: "There are numbers for the round, not adjectives.",
      criteria: [
        {
          id: "revenue", label: "Revenue reported (ARR or MRR)", weight: 8,
          field: "company_profiles.arr | mrr",
          status: revenueReported ? "met" : "missing",
          detail: revenueReported
            ? (profile.arr !== null ? `ARR ${money(profile.arr)}` : `MRR ${money(profile.mrr)}`) +
              (profile.mrr === 0 && profile.arr === null ? " — reported as zero (pre-revenue)" : "")
            : undefined,
        },
        {
          id: "customers", label: "Customer count reported", weight: 4,
          field: "company_profiles.customer_count",
          status: profile.customerCount !== null ? "met" : "missing",
          detail: profile.customerCount !== null ? `${profile.customerCount} customers` : undefined,
        },
        {
          id: "growth", label: "Growth rate", weight: 4,
          field: "company_profiles.growth_rate",
          status: filled(profile.growthRate) ? "met" : "missing",
        },
        {
          id: "milestones", label: "At least one milestone", weight: 4,
          field: "company_profiles.milestones",
          status: Array.isArray(profile.milestones) && profile.milestones.length > 0 ? "met" : "missing",
          detail: Array.isArray(profile.milestones) && profile.milestones.length > 0
            ? `${profile.milestones.length} recorded`
            : undefined,
        },
      ],
      score: 0, max: 0,
    },
    {
      id: "round",
      label: "Round definition",
      purpose: "What you are raising, on what instrument, at what cheque size.",
      criteria: [
        {
          id: "currently_raising", label: "Marked as currently raising", weight: 6,
          field: "company_profiles.currently_raising",
          status: profile.currentlyRaising ? "met" : "missing",
          detail: profile.currentlyRaising ? undefined : "Your profile says you are not raising",
        },
        {
          id: "funding_amount", label: "Target raise amount", weight: 5,
          field: "company_profiles.funding_amount",
          status: profile.fundingAmount !== null && profile.fundingAmount > 0 ? "met" : "missing",
          detail: profile.fundingAmount !== null && profile.fundingAmount > 0
            ? money(profile.fundingAmount)
            : undefined,
        },
        {
          id: "round_type", label: "Round type / instrument", weight: 3,
          field: "company_profiles.round_type",
          status: filled(profile.roundType) ? "met" : "missing",
        },
        {
          id: "cheque_range", label: "Target cheque range", weight: 6,
          field: "company_profiles.target_cheque_min | target_cheque_max",
          status:
            profile.targetChequeMin !== null && profile.targetChequeMax !== null
              ? "met"
              : "missing",
          detail:
            profile.targetChequeMin !== null && profile.targetChequeMax !== null
              ? `${money(profile.targetChequeMin)} – ${money(profile.targetChequeMax)}`
              : undefined,
        },
      ],
      score: 0, max: 0,
    },
    {
      id: "materials",
      label: "Materials",
      purpose: "The deck and supporting documents exist and are retrievable.",
      criteria: [
        {
          id: "pitch_deck", label: "Pitch deck uploaded and stored", weight: 10,
          field: "company_documents(document_type = 'pitch_deck')",
          status: hasDeck ? "met" : "missing",
          detail: strandedDeck
            ? "A deck record exists but its file was never stored — re-upload it"
            : hasDeck ? undefined : undefined,
        },
        {
          id: "supporting_document", label: "One supporting document", weight: 5,
          field: "company_documents",
          status: otherDocs.length > 0 ? "met" : "missing",
          detail: otherDocs.length > 0 ? `${otherDocs.length} stored` : undefined,
        },
      ],
      score: 0, max: 0,
    },
    {
      id: "team",
      label: "Team",
      purpose: "A named founder and someone with a stated background.",
      criteria: [
        {
          id: "founder_listed", label: "Founder listed on the team", weight: 6,
          field: "company_team_members(is_founder)",
          status: founder ? "met" : "missing",
          detail: founder?.name,
        },
        {
          id: "member_detail", label: "A team member with title or bio", weight: 4,
          field: "company_team_members.title | bio",
          status: detailedMember ? "met" : "missing",
        },
      ],
      score: 0, max: 0,
    },
  ];

  // Roll category totals. Derived, never hand-written, so weights can change
  // without the max going stale.
  for (const category of categories) {
    category.max = category.criteria.reduce((sum, c) => sum + c.weight, 0);
    category.score = category.criteria
      .filter((c) => c.status === "met")
      .reduce((sum, c) => sum + c.weight, 0);
  }

  const allCriteria = categories.flatMap((c) => c.criteria);
  const earned = allCriteria.filter((c) => c.status === "met").reduce((s, c) => s + c.weight, 0);
  const available = allCriteria.reduce((s, c) => s + c.weight, 0);
  const score = available === 0 ? 0 : Math.round((earned / available) * 100);

  const actions: ReadinessAction[] = categories
    .flatMap((category) =>
      category.criteria
        .filter((c) => c.status === "missing")
        .map((c) => ({
          criterionId: c.id,
          label: c.label,
          detail: c.detail || `Add ${c.label.toLowerCase()} to your profile.`,
          points: c.weight,
          categoryId: category.id,
          href: actionHref(c.id),
        }))
    )
    .sort((a, b) => b.points - a.points);

  const blockers: string[] = [];
  if (!profile.currentlyRaising) {
    blockers.push("Your profile says you are not currently raising — matched investors see a company that is not in market.");
  }
  if (strandedDeck && !hasDeck) {
    blockers.push("Your pitch deck record has no stored file, so it cannot be opened or shared.");
  }
  if (profile.fundingAmount === null || profile.fundingAmount <= 0) {
    blockers.push("No target raise amount is set, so pipeline progress cannot be measured against a goal.");
  }

  const band: ReadinessBand =
    score >= 90 ? "raise_ready" :
    score >= 75 ? "nearly_ready" :
    score >= 60 ? "developing" :
    score >= 40 ? "early" : "not_started";

  const bandLabel = {
    not_started: "Not started",
    early: "Early",
    developing: "Developing",
    nearly_ready: "Nearly ready",
    raise_ready: "Raise-ready",
  }[band];

  return {
    score,
    band,
    bandLabel,
    categories,
    actions,
    met: allCriteria.filter((c) => c.status === "met").length,
    total: allCriteria.length,
    blockers,
    disclaimer: DISCLAIMER,
  };
}

/** Where a founder fixes a given gap. */
function actionHref(criterionId: string): string {
  switch (criterionId) {
    case "pitch_deck":
    case "supporting_document":
      return "/dashboard/documents";
    case "founder_listed":
    case "member_detail":
      return "/dashboard/startup/edit#team";
    default:
      return "/dashboard/startup/edit";
  }
}
