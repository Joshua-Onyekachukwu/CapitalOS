// =============================================
// Reply Understanding Service
// =============================================
// Turns an inbound investor reply from "detected" into "understood":
//   1. Classifies interest level (rules, then optional AI refinement)
//   2. Drafts a suggested response for founder review
//   3. Auto-pauses active sequence enrollments per stop_on_reply
//   4. Persists everything to reply_insights for the dashboard
//
// Data layer: src/lib/db.ts (Supabase-backed query translator).
// Never throws into the poll loop: every step degrades gracefully.

import { query } from "@/lib/db";
import { chatCompletion, isAiConfigured } from "@/lib/ai";

// =============================================
// Types
// =============================================

export type InterestLevel =
  | "meeting_ready"   // explicit meeting/time ask — act same day
  | "interested"      // clearly positive, wants to continue
  | "curious"         // mild engagement, questions or acknowledgements
  | "soft_no"         // polite pass / not now — worth a door-open
  | "hard_no"         // firm refusal or hostile — suppress
  | "out_of_office"   // auto-reply — never counts as engagement
  | "neutral";        // anything the classifier can't place

export interface ReplyUnderstanding {
  interestLevel: InterestLevel;
  confidence: number;
  rationale: string;
  suggestedReply: string | null;
  suggestedReplySubject: string | null;
  engine: "rules" | "ai";
  pausedEnrollments: number;
}

interface ClassifyInput {
  subject: string;
  body: string;
  investorName?: string | null;
  firmName?: string | null;
}

interface UnderstandOptions {
  /** Skip AI refinement even when configured (used in tests). */
  rulesOnly?: boolean;
  /** Seed drafts with the founder's company context. */
  companyContext?: {
    companyName?: string;
    founderName?: string;
    oneLiner?: string;
  };
}

// =============================================
// Signal tables (ordered — first hit wins)
// =============================================

const OOO_PATTERNS: Array<[RegExp, string]> = [
  [/i am (out|away) (of|from) (the )?office/i, "out of office notice"],
  [/i'?m (out|away) (of|from) (the )?office/i, "out of office notice"],
  [/out of (the )?office/i, "out of office notice"],
  [/automatic (reply|response|acknowledg)/i, "auto-responder"],
  [/auto-?reply/i, "auto-responder"],
  [/on (annual |parental |sabbatical )?leave/i, "leave notice"],
  [/vacation|holiday until|pto until/i, "leave notice"],
];

const HARD_NO_PATTERNS: Array<[RegExp, string]> = [
  [/never (contact|email|reach out)/i, "explicit do-not-contact"],
  [/stop (emailing|contacting) me/i, "explicit do-not-contact"],
  [/remove me from/i, "unsubscribe demand"],
  [/unsubscribe/i, "unsubscribe demand"],
  [/do not contact/i, "explicit do-not-contact"],
  [/report(ed)? (you|this) as spam/i, "spam threat"],
  [/frankly,? no\b/i, "firm refusal"],
  [/hard (no|pass)\b/i, "firm refusal"],
];

const MEETING_PATTERNS: Array<[RegExp, string]> = [
  [/\b(happy|love|would|great|sure)\b[^.!?]{0,30}\bto (meet|chat|talk|connect|hop on)/i, "meeting ask"],
  [/\b(lets|let's|we can|we could) (meet|chat|talk|connect|schedule|set up|do)\b/i, "meeting ask"],
  [/\b(schedule|book|arrange) (a |an )?(call|meeting|chat|intro|introduction)\b/i, "meeting ask"],
  [/\b(send|share) (me )?(your )?(calendly|calendar|availability|times)\b/i, "availability ask"],
  [/\b(what|how) about (tuesday|wednesday|thursday|friday|monday|next week|this week)\b/i, "time proposal"],
  [/\bi('| a)m free (on |this |next )?(tuesday|wednesday|thursday|friday|monday|afternoon|morning)\b/i, "time proposal"],
  [/\b(would|does) (tuesday|wednesday|thursday|friday|monday|next week) work\b/i, "time proposal"],
  [/\b(calendly|cal\.com|booked a time|zoom link|google meet)\b/i, "scheduling link"],
  [/\b(happy to|keen to|open to) (take|jump on|get on) a call\b/i, "call acceptance"],
];

const SOFT_NO_PATTERNS: Array<[RegExp, string]> = [
  [/\bnot (a |the right )?fit\b/i, "not a fit"],
  [/\bnot (the )?right time\b/i, "timing"],
  [/\btoo early (for|at) (this |the )?(stage|point)\b/i, "too early"],
  [/\bpass(ing)? (on this|for now)\b/i, "passing"],
  [/\bwe'?re (full|at capacity) (on|for)\b/i, "allocation full"],
  [/\boutside (of )?(our|my) (thesis|mandate|focus)\b/i, "thesis mismatch"],
  [/\bnot (currently|actively) investing\b/i, "not investing now"],
  [/\bwe don'?t (invest|back)\b/i, "does not invest"],
  [/\bclosed (our |the )?fund\b/i, "fund closed"],
  [/\bstepping back\b/i, "stepping back"],
];

const INTERESTED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(send|share) (me |over )?(the )?(deck|deck,|memo|one-pager|teaser)\b/i, "materials request"],
  [/\b(interested|intrigued) in (learning|hearing) more\b/i, "wants more"],
  [/\btell me more\b/i, "wants more"],
  [/\bkeen to (learn|hear|see)\b/i, "wants more"],
  [/\blooks? interesting\b/i, "positive acknowledgment"],
  [/\bwould love to\b/i, "positive"],
  [/\blet'?s (continue|keep) (the )?conversation\b/i, "continue"],
  [/\bimpressed by\b/i, "positive"],
  [/\bkeep me (posted|in (the )?loop|informed)\b/i, "keep informed"],
  [/\bwhat (stage|round) (are|is) you\b/i, "round questions"],
  [/\bwho else is (in|investing)\b/i, "syndicate questions"],
];

const CURIOUS_PATTERNS: Array<[RegExp, string]> = [
  [/\bhow (is|was) (the )?(fundraising|raise) going\b/i, "polite small talk"],
  [/\bthanks for (the )?(reaching out|sharing|this)\b/i, "acknowledgment"],
  [/\bthanks,? \w+\b/i, "acknowledgment"],
  [/\bnoted with thanks\b/i, "acknowledgment"],
  [/\bcirculating (internally|with the team)\b/i, "internal review"],
  [/\bwill (review|take a look|circle back)\b/i, "deferred review"],
  [/\bgood luck with (the|your) (raise|fundraise)\b/i, "polite close"],
];

// =============================================
// Rule-based classifier
// =============================================

export function classifyReplyRules(input: ClassifyInput): {
  interestLevel: InterestLevel;
  confidence: number;
  rationale: string;
} {
  const text = `${input.subject}\n${input.body}`;

  // Unsubscribe demands are hard-no (and get suppressed upstream too)
  for (const [re, why] of HARD_NO_PATTERNS) {
    if (re.test(text)) return { interestLevel: "hard_no", confidence: 0.9, rationale: `Rule hit: ${why}` };
  }

  for (const [re, why] of OOO_PATTERNS) {
    if (re.test(text)) return { interestLevel: "out_of_office", confidence: 0.85, rationale: `Rule hit: ${why}` };
  }

  for (const [re, why] of MEETING_PATTERNS) {
    if (re.test(text)) return { interestLevel: "meeting_ready", confidence: 0.85, rationale: `Rule hit: ${why}` };
  }

  for (const [re, why] of SOFT_NO_PATTERNS) {
    if (re.test(text)) return { interestLevel: "soft_no", confidence: 0.8, rationale: `Rule hit: ${why}` };
  }

  for (const [re, why] of INTERESTED_PATTERNS) {
    if (re.test(text)) return { interestLevel: "interested", confidence: 0.75, rationale: `Rule hit: ${why}` };
  }

  for (const [re, why] of CURIOUS_PATTERNS) {
    if (re.test(text)) return { interestLevel: "curious", confidence: 0.6, rationale: `Rule hit: ${why}` };
  }

  // Question mark heuristic: a substantive question is at least curiosity
  if (/\?/.test(input.body) && input.body.trim().length > 40) {
    return { interestLevel: "curious", confidence: 0.5, rationale: "Heuristic: substantive question in body" };
  }

  return { interestLevel: "neutral", confidence: 0.3, rationale: "No strong signals matched" };
}

// =============================================
// AI refinement (optional — degrades to rules)
// =============================================

const LEVELS: InterestLevel[] = [
  "meeting_ready", "interested", "curious", "soft_no", "hard_no", "out_of_office", "neutral",
];

async function classifyReplyAi(input: ClassifyInput, fallback: {
  interestLevel: InterestLevel;
  confidence: number;
  rationale: string;
}): Promise<{ interestLevel: InterestLevel; confidence: number; rationale: string } | null> {
  if (!isAiConfigured()) return null;
  if (!input.body || input.body.trim().length < 20) return null;

  try {
    const resp = await chatCompletion({
      task: "query_parsing", // small/fast model is plenty for classification
      systemPrompt:
        "You classify investor replies to fundraising outreach. Reply with ONLY minified JSON, no markdown fences.",
      messages: [{
        role: "user",
        content:
          `Classify this investor reply.\n` +
          `Levels: meeting_ready (explicit meeting/time ask), interested (clearly positive), ` +
          `curious (mild engagement), soft_no (polite pass), hard_no (firm/hostile refusal), ` +
          `out_of_office (auto-reply), neutral.\n\n` +
          `Subject: ${input.subject.slice(0, 200)}\n` +
          `Body: ${input.body.slice(0, 2000)}\n\n` +
          `Return {"level":"<level>","confidence":<0-1>,"rationale":"<one short sentence>"}`,
      }],
      maxRetries: 2,
      timeoutMs: 25_000,
    });

    const match = resp.content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { level?: string; confidence?: number; rationale?: string };
    const level = String(parsed.level || "").toLowerCase() as InterestLevel;
    if (!LEVELS.includes(level)) return null;
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || fallback.confidence));
    return { interestLevel: level, confidence, rationale: `AI: ${String(parsed.rationale || "").slice(0, 200) || fallback.rationale}` };
  } catch {
    return null; // AI unavailable — rules result stands
  }
}

// =============================================
// Draft generation (AI when available, rules template otherwise)
// =============================================

function ruleBasedDraft(
  level: InterestLevel,
  input: ClassifyInput,
  company: UnderstandOptions["companyContext"]
): { subject: string; body: string } {
  const companyName = company?.companyName || "our company";
  const founderName = company?.founderName || input.investorName?.split(" ")[0] || "";
  const sign = founderName ? `\n\nBest,\n${founderName}` : "\n\nBest,";

  switch (level) {
    case "meeting_ready":
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Thank you for the quick reply! I'd love to find time this week or next.\n\n` +
          `Here's my calendar: [PASTE BOOKING LINK] — or send a couple of windows that work for you and I'll make it work.${sign}`,
      };
    case "interested":
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Great to hear — sending our deck over now so you have the full picture.\n\n` +
          `Happy to walk through it live whenever suits; I'm flexible over the next two weeks.${sign}`,
      };
    case "curious":
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Thanks for getting back to me. In one line: ${companyName} ${company?.oneLiner || "[ONE-LINE DESCRIPTION]"}.\n\n` +
          `If it's helpful I can share the deck — no pressure at all.${sign}`,
      };
    case "soft_no":
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Totally understood — thanks for being direct.\n\n` +
          `If timing changes or a portfolio company becomes relevant, I'll reach back out much later with something concrete. Wishing you a great quarter.${sign}`,
      };
    case "hard_no":
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Understood — you won't hear from me again. Thanks for the reply.${sign}`,
      };
    case "out_of_office":
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Thanks for the note — I'll follow up after you're back.${sign}`,
      };
    default:
      return {
        subject: `Re: ${input.subject.replace(/^re:\s*/i, "")}`,
        body:
          `Thanks for the reply. Happy to share more detail whenever useful — just say the word.${sign}`,
      };
  }
}

async function aiDraft(
  level: InterestLevel,
  input: ClassifyInput,
  company: UnderstandOptions["companyContext"]
): Promise<{ subject: string; body: string } | null> {
  if (!isAiConfigured()) return null;

  try {
    const resp = await chatCompletion({
      task: "email_drafting",
      systemPrompt:
        "You draft short founder-to-investor email replies. Warm, concise, zero fluff. " +
        "Never invent facts. Output ONLY minified JSON: {\"subject\":\"...\",\"body\":\"...\"}. " +
        "Body uses \\n\\n between paragraphs, no markdown.",
      messages: [{
        role: "user",
        content:
          `Investor reply to classify-and-answer. Interest level: ${level}.\n` +
          `Investor: ${input.investorName || "Unknown"}${input.firmName ? ` (${input.firmName})` : ""}.\n` +
          `Company: ${company?.companyName || "unknown"} — ${company?.oneLiner || "no description available"}.\n` +
          `Founder: ${company?.founderName || "unknown"}.\n\n` +
          `Subject: ${input.subject}\nBody: ${input.body.slice(0, 1800)}\n\n` +
          `Draft a reply a busy founder would actually send.`,
      }],
      maxRetries: 2,
      timeoutMs: 30_000,
    });

    const match = resp.content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
    if (!parsed.subject || !parsed.body) return null;
    return { subject: String(parsed.subject).slice(0, 200), body: String(parsed.body).slice(0, 4000) };
  } catch {
    return null;
  }
}

// =============================================
// Sequence auto-pause (stop_on_reply enforcement)
// =============================================

export async function pauseEnrollmentsForInvestor(
  userId: string,
  investorId: string
): Promise<number> {
  // Two simple statements instead of UPDATE..FROM: the db-layer SQL
  // translator silently drops dotted/complex WHERE conditions, so joined
  // updates are not safe through it.
  const sequences = await query<{ id: string }>(
    `SELECT id FROM campaign_sequences WHERE stop_on_reply = true`,
    []
  );
  const seqIds = sequences.map((s) => s.id);
  if (seqIds.length === 0) return 0;

  const result = await query<{ id: string }>(
    `UPDATE campaign_sequence_enrollments
     SET status = 'paused', paused_reason = $3, paused_at = NOW(), updated_at = NOW()
     WHERE investor_id = $1 AND user_id = $2 AND status = 'scheduled' AND sequence_id IN ($4)`,
    [investorId, userId, "reply_detected", seqIds]
  );
  return result.length;
}

// =============================================
// Persistence
// =============================================

async function persistInsight(params: {
  userId: string;
  investorId: string | null;
  threadId: string | null;
  messageId: string;
  understanding: ReplyUnderstanding;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO reply_insights
         (user_id, investor_id, thread_id, message_id, interest_level, confidence, rationale, suggested_reply, suggested_reply_subject, engine)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (message_id) DO UPDATE SET
         interest_level = EXCLUDED.interest_level,
         confidence = EXCLUDED.confidence,
         rationale = EXCLUDED.rationale,
         suggested_reply = EXCLUDED.suggested_reply,
         suggested_reply_subject = EXCLUDED.suggested_reply_subject,
         engine = EXCLUDED.engine`,
      [
        params.userId,
        params.investorId,
        params.threadId,
        params.messageId,
        params.understanding.interestLevel,
        params.understanding.confidence,
        params.understanding.rationale,
        params.understanding.suggestedReply,
        params.understanding.suggestedReplySubject,
        params.understanding.engine,
      ]
    );
  } catch {
    // Insight persistence must never break the poll loop
  }
}

// =============================================
// Main entry — called from reply-poller after detection
// =============================================

export async function understandReply(params: {
  userId: string;
  investorId: string | null;
  threadId: string | null;
  messageId: string;
  subject: string;
  body: string;
  options?: UnderstandOptions;
}): Promise<ReplyUnderstanding> {
  const { userId, investorId, threadId, messageId, subject, body, options } = params;

  const input: ClassifyInput = { subject, body };

  // 1. Classify — rules first, AI refinement only if it can beat the rules
  const rulesResult = classifyReplyRules(input);
  let classification = rulesResult;
  let engine: "rules" | "ai" = "rules";
  if (!options?.rulesOnly) {
    const aiResult = await classifyReplyAi(input, rulesResult);
    if (aiResult) {
      classification = aiResult;
      engine = "ai";
    }
  }

  // 2. Draft a suggested reply for every level except hard_no and OOO
  //    (those get templates on demand; drafting a reply to an auto-responder is noise)
  let suggestedReply: string | null = null;
  let suggestedReplySubject: string | null = null;
  if (classification.interestLevel !== "hard_no" && classification.interestLevel !== "out_of_office") {
    const draft = (await aiDraft(classification.interestLevel, input, options?.companyContext))
      || ruleBasedDraft(classification.interestLevel, input, options?.companyContext);
    suggestedReply = draft.body;
    suggestedReplySubject = draft.subject;
    if (engine === "rules") engine = "ai"; // draft engine counts even when rules classified
  }

  // 3. Auto-pause active enrollments when stop_on_reply is set
  let pausedEnrollments = 0;
  if (investorId) {
    try {
      pausedEnrollments = await pauseEnrollmentsForInvestor(userId, investorId);
    } catch {
      pausedEnrollments = 0;
    }
  }

  const understanding: ReplyUnderstanding = {
    interestLevel: classification.interestLevel,
    confidence: classification.confidence,
    rationale: classification.rationale,
    suggestedReply,
    suggestedReplySubject,
    engine,
    pausedEnrollments,
  };

  // 4. Persist (best-effort)
  await persistInsight({ userId, investorId, threadId, messageId, understanding });

  return understanding;
}
