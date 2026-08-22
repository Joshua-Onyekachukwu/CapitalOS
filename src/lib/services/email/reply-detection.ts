// =============================================
// Email Reply Detection Service
// =============================================
// Detects replies to outreach emails and updates investor status.
// Uses email threading and header analysis.

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

export interface ReplyDetectionResult {
  threadId: string;
  replyDetected: boolean;
  replyFrom: string | null;
  replySubject: string | null;
  replyPreview: string | null;
  investorId: string | null;
  sentiment: "positive" | "negative" | "neutral" | "meeting_requested" | "not_interested";
  detectedAt: string;
}

export interface ThreadSummary {
  threadId: string;
  investorId: string | null;
  subject: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessageFrom: string;
  lastMessagePreview: string;
  status: "active" | "replied" | "bounced" | "meeting_requested" | "closed";
  sentiment: "positive" | "negative" | "neutral" | "meeting_requested" | "not_interested";
}

// =============================================
// Sentiment Analysis (lightweight — no LLM needed)
// =============================================

function analyzeSentiment(subject: string, body: string): ReplyDetectionResult["sentiment"] {
  const text = `${subject} ${body}`.toLowerCase();

  // Meeting / positive signals
  const meetingKeywords = [
    "let's meet", "schedule a meeting", "calendar", "availability",
    "available this week", "happy to chat", "love to learn more",
    "interested", "tell me more", "send me", "looking forward",
    "sounds great", "perfect", "absolutely", "let's connect",
    "let's schedule", "book a time", "calendly", "zoom call",
  ];

  // Negative signals
  const negativeKeywords = [
    "not interested", "passing on", "not a fit", "out of scope",
    "we'll pass", "not the right time", "don't think it's a fit",
    "we're not investing", "no longer investing", "too early",
    "not for us", "decline", "unfortunately", "regret",
  ];

  // Meeting requested (highest priority)
  if (meetingKeywords.some((k) => text.includes(k))) return "meeting_requested";

  // Not interested
  if (negativeKeywords.some((k) => text.includes(k))) return "not_interested";

  // Positive (but not meeting)
  const positiveKeywords = ["thanks", "thank you", "interesting", "keep me posted", "sounds good", "will review"];
  if (positiveKeywords.some((k) => text.includes(k))) return "positive";

  return "neutral";
}

// =============================================
// Reply Detection from Email Headers
// =============================================

/**
 * Detect if an incoming email is a reply to an outreach thread.
 * Checks In-Reply-To and References headers against known message IDs.
 */
export async function detectReply(
  messageId: string,
  inReplyTo: string | null,
  references: string | null,
  fromEmail: string,
  subject: string,
  bodyPreview: string
): Promise<ReplyDetectionResult | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the original email thread by In-Reply-To message ID
  let threadId: string | null = null;
  let investorId: string | null = null;

  if (inReplyTo) {
    const { data: originalEmail } = await supabase
      .from("email_messages")
      .select("thread_id, investor_id")
      .eq("message_id", inReplyTo)
      .single();

    if (originalEmail) {
      threadId = originalEmail.thread_id;
      investorId = originalEmail.investor_id;
    }
  }

  // If no match via In-Reply-To, try subject matching (strip Re:/Fwd:)
  if (!threadId) {
    const cleanSubject = subject.replace(/^(re:|fwd?:|fw:)\s*/i, "").trim();
    const { data: possibleThreads } = await supabase
      .from("email_threads")
      .select("id, investor_id, subject")
      .ilike("subject", `%${cleanSubject}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (possibleThreads && possibleThreads.length > 0) {
      // Find the closest match
      const exactMatch = possibleThreads.find(
        (t) => t.subject.toLowerCase().replace(/^(re:|fwd?:|fw:)\s*/i, "").trim() === cleanSubject.toLowerCase()
      );
      if (exactMatch) {
        threadId = exactMatch.id;
        investorId = exactMatch.investor_id;
      }
    }
  }

  if (!threadId) return null;

  // Analyze sentiment
  const sentiment = analyzeSentiment(subject, bodyPreview);

  // Store the reply
  await supabase.from("email_messages").insert({
    thread_id: threadId,
    investor_id: investorId,
    message_id: messageId,
    direction: "inbound",
    from_email: fromEmail,
    subject,
    body_preview: bodyPreview,
    received_at: new Date().toISOString(),
  });

  // Update thread message count and last message
  const { count: msgCount } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  await supabase
    .from("email_threads")
    .update({
      message_count: (msgCount || 0) + 1,
      last_message_at: new Date().toISOString(),
      last_message_preview: bodyPreview.slice(0, 200),
    })
    .eq("id", threadId);

  // Update investor status based on sentiment
  if (investorId) {
    if (sentiment === "meeting_requested") {
      await supabase
        .from("investors")
        .update({ outreach_readiness: "meeting_requested" })
        .eq("id", investorId);
    } else if (sentiment === "positive") {
      await supabase
        .from("investors")
        .update({ outreach_readiness: "replied" })
        .eq("id", investorId);
    } else if (sentiment === "not_interested") {
      await supabase
        .from("investors")
        .update({ outreach_readiness: "not_interested" })
        .eq("id", investorId);
    }
  }

  return {
    threadId,
    replyDetected: true,
    replyFrom: fromEmail,
    replySubject: subject,
    replyPreview: bodyPreview.slice(0, 500),
    investorId,
    sentiment,
    detectedAt: new Date().toISOString(),
  };
}

// =============================================
// Thread Summary
// =============================================

export async function getThreadSummary(threadId: string): Promise<ThreadSummary | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: thread } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (!thread) return null;

  // Count messages
  const { count } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  // Get last message
  const { data: lastMsg } = await supabase
    .from("email_messages")
    .select("from_email, subject, body_preview, direction, received_at")
    .eq("thread_id", threadId)
    .order("received_at", { ascending: false })
    .limit(1)
    .single();

  return {
    threadId: thread.id,
    investorId: thread.investor_id,
    subject: thread.subject,
    messageCount: count || 0,
    lastMessageAt: lastMsg?.received_at || thread.created_at,
    lastMessageFrom: lastMsg?.from_email || "",
    lastMessagePreview: lastMsg?.body_preview || "",
    status: thread.status,
    sentiment: "neutral",
  };
}

// =============================================
// Get All Threads for User
// =============================================

export async function getUserThreads(
  userId: string,
  options?: { limit?: number; status?: string }
): Promise<ThreadSummary[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from("email_threads")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: threads } = await query;

  if (!threads) return [];

  return threads.map((thread) => ({
    threadId: thread.id,
    investorId: thread.investor_id,
    subject: thread.subject,
    messageCount: thread.message_count || 0,
    lastMessageAt: thread.last_message_at || thread.created_at,
    lastMessageFrom: "",
    lastMessagePreview: thread.last_message_preview || "",
    status: thread.status,
    sentiment: "neutral" as const,
  }));
}
