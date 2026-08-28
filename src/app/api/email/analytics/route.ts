// =============================================
// Email Analytics API
// =============================================
// Returns comprehensive email sending analytics:
// open rates, click rates, reply rates, device breakdown, timeline.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import {
  getEmailStats,
  getInvestorEmailStats,
} from "@/lib/services/email/tracking-supabase";
import { createClient } from "@supabase/supabase-js";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: rateLimitResponse.status, headers: rateLimitResponse.headers }
    );
  }

  try {
    const cacheKey = userCacheKey(user.id, "email-analytics");
    const data = await cache.getOrSet(
      cacheKey,
      () => computeAnalytics(user.id),
      { ttlMs: CACHE_TTL.medium }
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error("Email analytics error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}

async function computeAnalytics(userId: string) {
  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get overall stats
  const stats = await getEmailStats(userId);

  // Get per-investor stats
  const investorStats = await getInvestorEmailStats(userId);

  // Get timeline (last 30 days)
  const now = new Date();
  const timeline: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    timeline.push({ date: dayLabel, sent: 0, opened: 0, clicked: 0, replied: 0 });
  }

  // Fetch all outbound emails for timeline
  const { data: emails } = await sp
    .from("email_messages")
    .select("sent_at, opened_at, clicked_at, reply_detected_at, created_at")
    .eq("user_id", userId)
    .eq("direction", "outbound");

  if (emails) {
    for (const email of emails) {
      const sentDate = (email.sent_at || email.created_at || "").split("T")[0];
      const entry = timeline.find((t) => {
        const d = new Date(now);
        d.setDate(d.getDate() - timeline.indexOf(t));
        return d.toISOString().split("T")[0] === sentDate;
      });
      if (entry) {
        entry.sent++;
        if (email.opened_at) entry.opened++;
        if (email.clicked_at) entry.clicked++;
        if (email.reply_detected_at) entry.replied++;
      }
    }
  }

  // Get device breakdown from tracking events
  const { data: events } = await sp
    .from("email_tracking_events")
    .select("event_type, device_type, email_client")
    .eq("user_id", userId);

  const deviceBreakdown: Record<string, number> = {};
  const clientBreakdown: Record<string, number> = {};

  if (events) {
    for (const event of events) {
      if (event.device_type) {
        deviceBreakdown[event.device_type] =
          (deviceBreakdown[event.device_type] || 0) + 1;
      }
      if (event.email_client) {
        clientBreakdown[event.email_client] =
          (clientBreakdown[event.email_client] || 0) + 1;
      }
    }
  }

  // Top performing emails
  const { data: topEmails } = await sp
    .from("email_messages")
    .select("id, investor_id, subject, status, open_count, click_count, sent_at")
    .eq("user_id", userId)
    .eq("direction", "outbound")
    .order("open_count", { ascending: false })
    .limit(10);

  // Get investor names for top emails
  const investorIds = [
    ...new Set((topEmails || []).map((e) => e.investor_id).filter(Boolean)),
  ];
  let invMap = new Map<string, any>();
  if (investorIds.length > 0) {
    const { data: invs } = await sp
      .from("investors")
      .select("id, first_name, last_name")
      .in("id", investorIds);
    invMap = new Map((invs || []).map((i) => [i.id, i]));
  }

  const topPerforming = (topEmails || []).map((e) => {
    const inv = invMap.get(e.investor_id);
    return {
      id: e.id,
      investorName: inv ? `${inv.first_name} ${inv.last_name}` : "Unknown",
      subject: e.subject,
      status: e.status,
      opens: e.open_count || 0,
      clicks: e.click_count || 0,
      sentAt: e.sent_at,
    };
  });

  return {
    stats,
    investorStats: investorStats.slice(0, 20),
    timeline,
    deviceBreakdown: Object.entries(deviceBreakdown).map(([name, count]) => ({
      name,
      count,
    })),
    clientBreakdown: Object.entries(clientBreakdown).map(([name, count]) => ({
      name,
      count,
    })),
    topPerforming,
  };
}
