// =============================================
// Email Health API
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { calculateHealthScore, calculateAllAccountHealth } from "@/lib/services/email/health-scorer";
import { getRecommendations, getSendingCapacity } from "@/lib/services/email/recommendations";
import { getActiveAlerts, getAlertCount } from "@/lib/services/email/alerts";
import { getRecentEvents, getEventCounts } from "@/lib/services/email/events";
import { createClient } from "@supabase/supabase-js";

function getUserId(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Extract JWT and verify
  const token = authHeader.replace("Bearer ", "");
  // Use service role to get user from JWT
  return null; // Will be handled by middleware
}

// GET — Get email health overview
export async function GET(request: NextRequest) {
  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user from session cookie
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    // For now, use the first user's accounts (will be replaced with proper auth)
    const { data: accounts } = await sp
      .from("email_accounts")
      .select("*")
      .eq("is_active", true)
      .limit(10);

    if (!accounts?.length) {
      return NextResponse.json({
        accounts: [],
        recommendations: [],
        alerts: [],
        capacity: [],
      });
    }

    const userId = accounts[0].user_id;

    // Calculate health scores for all accounts
    const healthScores = accountId
      ? [await calculateHealthScore(accountId)].filter(Boolean)
      : await calculateAllAccountHealth(userId);

    // Get recommendations
    const recommendations = await getRecommendations(userId, accountId || undefined);

    // Get alerts
    const alerts = await getActiveAlerts(userId);
    const alertCount = await getAlertCount(userId);

    // Get sending capacity for each account
    const capacity = await Promise.all(
      accounts.map(async (account) => {
        const cap = await getSendingCapacity(userId, account.id);
        return {
          accountId: account.id,
          email: account.email_address,
          provider: account.provider,
          ...cap,
        };
      })
    );

    // Get recent events
    const recentEvents = await getRecentEvents(userId, {
      accountId: accountId || undefined,
      limit: 20,
    });

    // Get event counts
    const eventCounts = await getEventCounts(userId, 30);

    return NextResponse.json({
      accounts: healthScores,
      recommendations,
      alerts,
      alertCount,
      capacity,
      recentEvents: recentEvents.events,
      eventCounts,
    });
  } catch (error: any) {
    console.error("Email health API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email health data" },
      { status: 500 }
    );
  }
}

// POST — Refresh health scores for all accounts
export async function POST(request: NextRequest) {
  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: accounts } = await sp
      .from("email_accounts")
      .select("id, user_id")
      .eq("is_active", true);

    if (!accounts?.length) {
      return NextResponse.json({ refreshed: 0 });
    }

    const userId = accounts[0].user_id;
    const scores = await calculateAllAccountHealth(userId);

    return NextResponse.json({
      refreshed: scores.length,
      accounts: scores,
    });
  } catch (error: any) {
    console.error("Email health refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh health scores" },
      { status: 500 }
    );
  }
}
