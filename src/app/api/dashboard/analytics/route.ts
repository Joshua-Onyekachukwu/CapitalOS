// =============================================
// Dashboard Analytics API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Use count queries instead of fetching all rows (Supabase caps at 1000)
    const [
      totalResult,
      withEmailResult,
      withLinkedInResult,
      highFitResult,
      avgResult,
    ] = await Promise.all([
      sp.from("investors").select("id", { count: "exact", head: true }),
      sp.from("investors").select("id", { count: "exact", head: true }).not("email", "is", null).neq("email", ""),
      sp.from("investors").select("id", { count: "exact", head: true }).not("linkedin_url", "is", null).neq("linkedin_url", ""),
      sp.from("investors").select("id", { count: "exact", head: true }).gte("fit_score", 80),
      sp.from("investors").select("fit_score").gt("fit_score", 0).limit(1000),
    ]);

    const totalInvestors = totalResult.count || 0;
    const withEmail = withEmailResult.count || 0;
    const withLinkedIn = withLinkedInResult.count || 0;
    const highFit = highFitResult.count || 0;
    const avgScores = avgResult.data || [];
    const avgFitScore = avgScores.length > 0
      ? Math.round(avgScores.reduce((sum: number, i: any) => sum + (i.fit_score || 0), 0) / avgScores.length)
      : 0;

    // These tables may not exist — gracefully return empty
    let emailsSent = 0;
    let replyRate = 0;
    let pendingDuplicates = 0;
    let activeCampaigns = 0;

    try {
      const { count } = await sp.from("email_messages").select("id", { count: "exact", head: true }).eq("direction", "outbound").eq("status", "sent");
      emailsSent = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { count: sentCount } = await sp.from("email_messages").select("id", { count: "exact", head: true }).eq("direction", "outbound").eq("status", "sent");
      const { count: replyCount } = await sp.from("email_messages").select("id", { count: "exact", head: true }).eq("direction", "inbound");
      replyRate = (sentCount || 0) > 0 ? Math.round(((replyCount || 0) / (sentCount || 0)) * 100) : 0;
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingDuplicates = count || 0;
    } catch { /* table may not exist */ }

    try {
      const { count } = await sp.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active");
      activeCampaigns = count || 0;
    } catch { /* table may not exist */ }

    return NextResponse.json({
      totalInvestors,
      highFitInvestors: highFit,
      avgFitScore,
      withEmail,
      withLinkedIn,
      emailsSent,
      replyRate,
      activeCampaigns,
      pendingDuplicates,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
