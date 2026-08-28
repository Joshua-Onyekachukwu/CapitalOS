// =============================================
// Dashboard Analytics API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";

export async function GET(_request: NextRequest) {
  const user = await requireAuth(_request);
  if (user instanceof NextResponse) return user;

  try {
    // Check cache first (analytics changes infrequently)
    const cacheKey = userCacheKey(user.id, "analytics");
    const cached = await cache.getOrSet(
      cacheKey,
      () => computeAnalytics(),
      { ttlMs: CACHE_TTL.long }
    );
    return NextResponse.json(cached);
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}

async function computeAnalytics() {
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

  // These tables may not exist — gracefully return empty, all in parallel
  let emailsSent = 0;
  let replyRate = 0;
  let pendingDuplicates = 0;
  let activeCampaigns = 0;

  const [sentResult, replyResult, dupResult, campaignResult] = await Promise.allSettled([
    sp.from("email_messages").select("id", { count: "exact", head: true }).eq("direction", "outbound").eq("status", "sent"),
    sp.from("email_messages").select("id", { count: "exact", head: true }).eq("direction", "inbound"),
    sp.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sp.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  emailsSent = sentResult.status === "fulfilled" ? (sentResult.value.count || 0) : 0;
  const replyCount = replyResult.status === "fulfilled" ? (replyResult.value.count || 0) : 0;
  replyRate = emailsSent > 0 ? Math.round((replyCount / emailsSent) * 100) : 0;
  pendingDuplicates = dupResult.status === "fulfilled" ? (dupResult.value.count || 0) : 0;
  activeCampaigns = campaignResult.status === "fulfilled" ? (campaignResult.value.count || 0) : 0;

  return {
    totalInvestors,
    highFitInvestors: highFit,
    avgFitScore,
    withEmail,
    withLinkedIn,
    emailsSent,
    replyRate,
    activeCampaigns,
    pendingDuplicates,
  };
}
