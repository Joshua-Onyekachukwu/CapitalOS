import { NextRequest, NextResponse } from "next/server";
import { queryAs, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all email messages for this user
    const allEmails = await queryAs<any>(
      user.id,
      `SELECT id, investor_id, subject, status, direction, sent_at, created_at, ai_generated
       FROM email_messages
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    const outbound = allEmails.filter((e) => e.direction === "outbound");

    // Compute stats
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
        sent: outbound.filter((e) => e.sent_at?.startsWith(dateStr) || e.created_at.startsWith(dateStr)).length,
        replied: allEmails.filter((e) => e.direction === "inbound" && e.created_at.startsWith(dateStr)).length,
      });
    }

    // Status breakdown
    const statusBreakdown = [
      { name: "Sent", value: sent, color: "#3b82f6" },
      { name: "Drafted", value: drafted, color: "#f59e0b" },
      { name: "Replied", value: replied, color: "#84cc16" },
      { name: "Bounced", value: bounced, color: "#ef4444" },
    ].filter((s) => s.value > 0);

    // Fetch unique investor names for top investors
    const investorIds = [...new Set(outbound.map((e) => e.investor_id).filter(Boolean))];
    let topInvestors: Array<{ name: string; firm: string; status: string; fitScore: number }> = [];
    if (investorIds.length > 0) {
      const invs = await query<any>(
        `SELECT id, first_name, last_name, fit_score
         FROM investors
         WHERE id = ANY($1)`,
        [investorIds.slice(0, 20)]
      );
      const invMap = new Map(invs.map((i) => [i.id, i]));
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
