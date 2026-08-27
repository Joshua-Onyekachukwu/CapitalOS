// =============================================
// Email Health Analytics API
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";

// GET — Get email analytics data
export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get sending log data
    const { data: sendingLog } = await sp
      .from("email_sending_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const logs = sendingLog || [];

    // Calculate summary
    const totalSent = logs.filter(l => l.status === "sent").length;
    const totalDelivered = logs.filter(l => l.status === "sent" && l.delivery_status !== "failed").length;
    const totalBounced = logs.filter(l => l.status === "bounced").length;
    const totalHardBounced = logs.filter(l => l.bounce_type === "hard").length;
    const totalSoftBounced = logs.filter(l => l.bounce_type === "soft").length;
    const totalComplaints = logs.filter(l => l.status === "failed" && l.error?.includes("complaint")).length;

    // Get reply count
    const { count: replyCount } = await sp
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", since);

    const totalReplied = replyCount || 0;

    const summary = {
      totalSent,
      totalDelivered,
      totalBounced,
      totalHardBounced,
      totalSoftBounced,
      totalReplied,
      totalComplaints,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      replyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
      complaintRate: totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0,
    };

    // Daily trend
    const dailyMap: Record<string, any> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = {
        date: key,
        sent: 0,
        delivered: 0,
        bounced: 0,
        hardBounced: 0,
        softBounced: 0,
        replied: 0,
        complaints: 0,
      };
    }

    for (const log of logs) {
      if (!log.sent_at) continue;
      const key = new Date(log.sent_at).toISOString().split("T")[0];
      if (!dailyMap[key]) continue;

      if (log.status === "sent") {
        dailyMap[key].sent++;
        dailyMap[key].delivered++;
      }
      if (log.status === "bounced") {
        dailyMap[key].bounced++;
        if (log.bounce_type === "hard") dailyMap[key].hardBounced++;
        else if (log.bounce_type === "soft") dailyMap[key].softBounced++;
      }
    }

    const dailyTrend = Object.values(dailyMap);

    // Bounce breakdown
    const bounceBreakdown = {
      hard: totalHardBounced,
      soft: totalSoftBounced,
      unknown: totalBounced - totalHardBounced - totalSoftBounced,
    };

    // Top bounced addresses
    const bouncedLogs = logs.filter(l => l.status === "bounced");
    const addrCounts: Record<string, { count: number; type: string }> = {};
    for (const log of bouncedLogs) {
      const addr = log.to_address?.toLowerCase() || "";
      if (!addrCounts[addr]) {
        addrCounts[addr] = { count: 0, type: log.bounce_type || "unknown" };
      }
      addrCounts[addr].count++;
    }
    const topBouncedAddresses = Object.entries(addrCounts)
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Account trends
    const accountMap: Record<string, any> = {};
    for (const log of logs) {
      const accId = log.account_id || "unknown";
      if (!accountMap[accId]) {
        accountMap[accId] = {
          accountId: accId,
          email: log.to_address || "",
          provider: log.provider || "",
          daily: {},
        };
      }
      if (log.sent_at) {
        const key = new Date(log.sent_at).toISOString().split("T")[0];
        if (!accountMap[accId].daily[key]) {
          accountMap[accId].daily[key] = { sent: 0, bounced: 0 };
        }
        if (log.status === "sent") accountMap[accId].daily[key].sent++;
        if (log.status === "bounced") accountMap[accId].daily[key].bounced++;
      }
    }

    const accountTrends = Object.values(accountMap).map((acc: any) => ({
      ...acc,
      daily: Object.entries(acc.daily).map(([date, stats]: [string, any]) => ({
        date,
        ...stats,
      })),
    }));

    return NextResponse.json({
      summary,
      dailyTrend,
      accountTrends,
      bounceBreakdown,
      topBouncedAddresses,
    });
  } catch (error: any) {
    console.error("Email analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
