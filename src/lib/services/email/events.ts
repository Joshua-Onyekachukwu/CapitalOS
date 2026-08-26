// =============================================
// Email Health Events Service
// =============================================
// Logs every important email event for the health timeline.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type EventType =
  | "sent"
  | "delivered"
  | "bounced"
  | "hard_bounced"
  | "soft_bounced"
  | "complaint"
  | "opened"
  | "clicked"
  | "replied"
  | "unsubscribed"
  | "suppressed"
  | "warmup_milestone"
  | "health_score_change"
  | "sending_paused"
  | "sending_resumed"
  | "dns_check"
  | "token_refreshed"
  | "token_refresh_failed"
  | "daily_limit_reached"
  | "warmup_started"
  | "warmup_paused"
  | "warmup_completed";

export type Severity = "info" | "warning" | "critical";

// =============================================
// Log an event
// =============================================

export async function logEvent(params: {
  userId: string;
  accountId?: string;
  eventType: EventType;
  severity?: Severity;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
}): Promise<void> {
  const sp = getSp();

  await sp.from("email_health_events").insert({
    user_id: params.userId,
    account_id: params.accountId || null,
    event_type: params.eventType,
    severity: params.severity || "info",
    details: params.details || {},
    metadata: params.metadata || {},
  });
}

// =============================================
// Log a send event
// =============================================

export async function logSend(params: {
  userId: string;
  accountId?: string;
  campaignId?: string;
  investorId?: string;
  emailMessageId?: string;
  provider: string;
  toAddress: string;
  subject?: string;
  trackingId?: string;
}): Promise<string> {
  const sp = getSp();

  const { data } = await sp.from("email_sending_log").insert({
    user_id: params.userId,
    account_id: params.accountId || null,
    campaign_id: params.campaignId || null,
    investor_id: params.investorId || null,
    email_message_id: params.emailMessageId || null,
    provider: params.provider,
    to_address: params.toAddress,
    subject: params.subject || null,
    status: "sent",
    tracking_id: params.trackingId || null,
    sent_at: new Date().toISOString(),
  }).select("id").single();

  await logEvent({
    userId: params.userId,
    accountId: params.accountId,
    eventType: "sent",
    details: {
      to: params.toAddress,
      provider: params.provider,
      subject: params.subject,
    },
  });

  // Update account send count
  if (params.accountId) {
    await sp.rpc("increment_send_count" as any, { p_account_id: params.accountId }).catch(() => {
      sp.from("email_accounts").select("total_sent_all_time").eq("id", params.accountId).single().then(({ data: acct }) => {
        if (acct) {
          sp.from("email_accounts").update({
            total_sent_all_time: (acct.total_sent_all_time || 0) + 1,
          }).eq("id", params.accountId);
        }
      });
    });
  }

  return data?.id || "";
}

// =============================================
// Log a bounce event
// =============================================

export async function logBounce(params: {
  userId: string;
  accountId?: string;
  sendingLogId?: string;
  toAddress: string;
  bounceType: "hard" | "soft";
  error?: string;
}): Promise<void> {
  const sp = getSp();

  // Update sending log
  if (params.sendingLogId) {
    await sp.from("email_sending_log").update({
      status: "bounced",
      bounce_type: params.bounceType,
      bounced_at: new Date().toISOString(),
      error: params.error,
    }).eq("id", params.sendingLogId);
  }

  await logEvent({
    userId: params.userId,
    accountId: params.accountId,
    eventType: params.bounceType === "hard" ? "hard_bounced" : "soft_bounced",
    severity: params.bounceType === "hard" ? "critical" : "warning",
    details: {
      to: params.toAddress,
      bounce_type: params.bounceType,
      error: params.error,
    },
  });
}

// =============================================
// Get recent events
// =============================================

export async function getRecentEvents(
  userId: string,
  options?: {
    accountId?: string;
    limit?: number;
    offset?: number;
    eventType?: string;
    severity?: string;
    since?: string;
  }
): Promise<{ events: any[]; total: number }> {
  const sp = getSp();

  let query = sp
    .from("email_health_events")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.accountId) {
    query = query.eq("account_id", options.accountId);
  }
  if (options?.eventType) {
    query = query.eq("event_type", options.eventType);
  }
  if (options?.severity) {
    query = query.eq("severity", options.severity);
  }
  if (options?.since) {
    query = query.gte("created_at", options.since);
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count } = await query;

  return {
    events: data || [],
    total: count || 0,
  };
}

// =============================================
// Get event counts by type
// =============================================

export async function getEventCounts(
  userId: string,
  days: number = 30
): Promise<Record<string, number>> {
  const sp = getSp();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await sp
    .from("email_health_events")
    .select("event_type")
    .eq("user_id", userId)
    .gte("created_at", since);

  const counts: Record<string, number> = {};
  for (const event of data || []) {
    counts[event.event_type] = (counts[event.event_type] || 0) + 1;
  }

  return counts;
}

// =============================================
// Get sending timeline
// =============================================

export async function getSendingTimeline(
  userId: string,
  options?: { accountId?: string; days?: number }
): Promise<any[]> {
  const sp = getSp();
  const days = options?.days || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = sp
    .from("email_sending_log")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (options?.accountId) {
    query = query.eq("account_id", options.accountId);
  }

  const { data } = await query.limit(200);

  return data || [];
}
