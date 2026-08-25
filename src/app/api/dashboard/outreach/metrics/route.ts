import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch email messages (may not exist in Supabase)
    let allEmails: any[] = [];
    try {
      const { data, error } = await sp
        .from("email_messages")
        .select("id, investor_id, subject, status, direction, sent_at, created_at, ai_generated")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      allEmails = data || [];
    } catch {
      allEmails = [];
    }

    const outbound = allEmails.filter((e) => e.direction === "outbound");

    const sent = outbound.filter((e) => e.status === "sent" || e.status === "delivered").length;
    const drafted = outbound.filter((e) => e.status === "draft").length;
    const replied = allEmails.filter((e) => e.direction === "inbound").length;
    const bounced = outbound.filter((e) => e.status === "bounced").length;
    const opened = outbound.filter((e) => e.status === "opened").length;

    // Emails by day (last 14 days)
    const now = new Date();
    const emailsByDay: Array<{ date: string; sent: number; replied: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      emailsByDay.push({
        date: dayLabel,
        sent: outbound.filter((e) => e.sent_at?.startsWith(dateStr) || e.created_at?.startsWith(dateStr)).length,
        replied: allEmails.filter((e) => e.direction === "inbound" && e.created_at?.startsWith(dateStr)).length,
      });
    }

    const statusBreakdown = [
      { name: "Sent", value: sent, color: "#3b82f6" },
      { name: "Drafted", value: drafted, color: "#f59e0b" },
      { name: "Replied", value: replied, color: "#84cc16" },
      { name: "Bounced", value: bounced, color: "#ef4444" },
    ].filter((s) => s.value > 0);

    // Top investors
    const investorIds = [...new Set(outbound.map((e) => e.investor_id).filter(Boolean))];
    let topInvestors: Array<{ name: string; firm: string; status: string; fitScore: number }> = [];
    if (investorIds.length > 0) {
      const { data: invs } = await sp
        .from("investors")
        .select("id, first_name, last_name, fit_score")
        .in("id", investorIds.slice(0, 20));
      const invMap = new Map((invs || []).map((i) => [i.id, i]));
      topInvestors = outbound.slice(0, 10).map((e) => {
        const inv = invMap.get(e.investor_id);
        return {
          name: inv ? `${inv.first_name} ${inv.last_name}` : "Unknown",
          firm: "",
          status: e.status,
          fitScore: inv?.fit_score || 0,
        };
      });
    }

    return NextResponse.json({
      totalEmails: allEmails.length,
      sent,
      drafted,
      replied,
      bounced,
      opened,
      responseRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      emailsByDay,
      statusBreakdown,
      topInvestors,
    });
  } catch (err) {
    console.error("Outreach metrics API error:", err);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
