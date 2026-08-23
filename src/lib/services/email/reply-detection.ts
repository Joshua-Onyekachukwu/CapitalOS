// =============================================
// Email Reply Detection Service
// =============================================
// Uses CockroachDB for data.

import { query } from "@/lib/db";

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

export function analyzeSentiment(subject: string, body: string): ReplyDetectionResult["sentiment"] {
  const text = `${subject} ${body}`.toLowerCase();

  const meetingKeywords = [
    "let's meet", "schedule a meeting", "calendar", "availability",
    "available this week", "happy to chat", "love to learn more",
    "interested", "tell me more", "send me", "looking forward",
    "sounds great", "perfect", "absolutely", "let's connect",
    "let's schedule", "book a time", "calendly", "zoom call",
  ];

  const negativeKeywords = [
    "not interested", "passing on", "not a fit", "out of scope",
    "we'll pass", "not the right time", "don't think it's a fit",
    "we're not investing", "no longer investing", "too early",
    "not for us", "decline", "unfortunately", "regret",
  ];

  if (meetingKeywords.some((k) => text.includes(k))) return "meeting_requested";
  if (negativeKeywords.some((k) => text.includes(k))) return "not_interested";

  const positiveKeywords = ["thanks", "thank you", "interesting", "keep me posted", "sounds good", "will review"];
  if (positiveKeywords.some((k) => text.includes(k))) return "positive";

  return "neutral";
}

export async function detectReply(
  messageId: string,
  inReplyTo: string | null,
  references: string | null,
  fromEmail: string,
  subject: string,
  bodyPreview: string
): Promise<ReplyDetectionResult | null> {
  let threadId: string | null = null;
  let investorId: string | null = null;

  if (inReplyTo) {
    const original = await query<any>(
      `SELECT thread_id, investor_id FROM email_messages WHERE message_id = $1`,
      [inReplyTo]
    );
    if (original.length) {
      threadId = original[0].thread_id;
      investorId = original[0].investor_id;
    }
  }

  if (!threadId) {
    const cleanSubject = subject.replace(/^(re:|fwd?:|fw:)\s*/i, "").trim();
    const possibleThreads = await query<any>(
      `SELECT id, investor_id, subject FROM email_threads WHERE subject ILIKE $1 ORDER BY created_at DESC LIMIT 5`,
      [`%${cleanSubject}%`]
    );

    if (possibleThreads.length) {
      const exactMatch = possibleThreads.find(
        (t: any) => t.subject.toLowerCase().replace(/^(re:|fwd?:|fw:)\s*/i, "").trim() === cleanSubject.toLowerCase()
      );
      if (exactMatch) {
        threadId = exactMatch.id;
        investorId = exactMatch.investor_id;
      }
    }
  }

  if (!threadId) return null;

  const sentiment = analyzeSentiment(subject, bodyPreview);

  await query(
    `INSERT INTO email_messages (thread_id, investor_id, message_id, direction, from_address, subject, body_text, status, replied_at)
     VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, NOW())`,
    [threadId, investorId, messageId, fromEmail, subject, bodyPreview, sentiment === "meeting_requested" ? "replied" : "replied"]
  );

  const msgCount = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM email_messages WHERE thread_id = $1`,
    [threadId]
  );

  await query(
    `UPDATE email_threads SET message_count = $1, last_message_at = NOW(), last_message_preview = $2 WHERE id = $3`,
    [(parseInt(msgCount[0]?.count || "0") || 0) + 1, bodyPreview.slice(0, 200), threadId]
  );

  if (investorId) {
    if (sentiment === "meeting_requested") {
      await query(`UPDATE investors SET outreach_readiness = 'ready' WHERE id = $1`, [investorId]);
    } else if (sentiment === "positive") {
      await query(`UPDATE investors SET outreach_readiness = 'contacted' WHERE id = $1`, [investorId]);
    } else if (sentiment === "not_interested") {
      await query(`UPDATE investors SET outreach_readiness = 'do_not_contact' WHERE id = $1`, [investorId]);
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

export async function getThreadSummary(threadId: string): Promise<ThreadSummary | null> {
  const threads = await query<any>(`SELECT * FROM email_threads WHERE id = $1`, [threadId]);
  if (!threads.length) return null;
  const thread = threads[0];

  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM email_messages WHERE thread_id = $1`,
    [threadId]
  );

  const lastMsg = await query<any>(
    `SELECT from_address, subject, body_text, direction, created_at FROM email_messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [threadId]
  );

  return {
    threadId: thread.id,
    investorId: thread.investor_id,
    subject: thread.subject,
    messageCount: parseInt(count[0]?.count || "0"),
    lastMessageAt: lastMsg[0]?.created_at || thread.created_at,
    lastMessageFrom: lastMsg[0]?.from_address || "",
    lastMessagePreview: lastMsg[0]?.body_text || "",
    status: thread.status,
    sentiment: "neutral",
  };
}

export async function getUserThreads(userId: string, options?: { limit?: number; status?: string }): Promise<ThreadSummary[]> {
  let sql = `SELECT * FROM email_threads WHERE user_id = $1 ORDER BY last_message_at DESC`;
  const params: any[] = [userId];

  if (options?.status) {
    params.push(options.status);
    sql += ` AND status = $${params.length}`;
  }

  if (options?.limit) {
    params.push(options.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const threads = await query<any>(sql, params);

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
