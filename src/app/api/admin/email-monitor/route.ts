// =============================================
// Admin Email Monitor API
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/middleware/api-auth";

// GET — System-wide email monitoring data (admin only)
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all email accounts across all users
    const { data: accounts } = await sp
      .from("email_accounts")
      .select("*")
      .eq("is_active", true);

    if (!accounts?.length) {
      return NextResponse.json({
        stats: {
          totalAccounts: 0,
          activeAccounts: 0,
          pausedAccounts: 0,
          healthyAccounts: 0,
          criticalAccounts: 0,
          totalSentToday: 0,
          totalSentAllTime: 0,
          systemBounceRate: 0,
          providerDistribution: {},
          expiringTokens: 0,
        },
        accounts: [],
        recentErrors: [],
        expiringTokens: [],
      });
    }

    // Get sending logs for bounce rate
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await sp
      .from("email_sending_log")
      .select("status, bounce_type, account_id, sent_at")
      .gte("created_at", sevenDaysAgo);

    const logs = recentLogs || [];

    // Get recent health events (errors)
    const { data: recentErrors } = await sp
      .from("email_health_events")
      .select("*")
      .in("severity", ["warning", "critical"])
      .order("created_at", { ascending: false })
      .limit(20);

    // Calculate system stats
    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter(a => !a.sending_paused).length;
    const pausedAccounts = accounts.filter(a => a.sending_paused).length;
    const healthyAccounts = accounts.filter(a => (a.health_score || 0) >= 70).length;
    const criticalAccounts = accounts.filter(a => (a.health_score || 0) < 40 || a.sending_paused).length;

    const totalSentToday = accounts.reduce((sum, a) => sum + (a.sends_today || 0), 0);
    const totalSentAllTime = accounts.reduce((sum, a) => sum + (a.total_sent_all_time || 0), 0);

    // System bounce rate
    const totalSent7d = logs.filter(l => l.status === "sent").length;
    const totalBounced7d = logs.filter(l => l.status === "bounced").length;
    const systemBounceRate = totalSent7d > 0 ? (totalBounced7d / totalSent7d) * 100 : 0;

    // Provider distribution
    const providerDistribution: Record<string, number> = {};
    for (const acc of accounts) {
      providerDistribution[acc.provider] = (providerDistribution[acc.provider] || 0) + 1;
    }

    // Token expiry warnings (tokens expiring in next 7 days)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expiringTokens = accounts
      .filter(a => a.token_expires_at && a.token_expires_at < sevenDaysFromNow)
      .map(a => ({
        accountId: a.id,
        email: a.email_address,
        expiresAt: a.token_expires_at,
      }));

    // Build account overview
    const accountOverviews = accounts.map(acc => {
      const accLogs = logs.filter(l => l.account_id === acc.id);
      const sent7d = accLogs.filter(l => l.status === "sent").length;
      const bounced7d = accLogs.filter(l => l.status === "bounced").length;

      return {
        accountId: acc.id,
        email: acc.email_address,
        provider: acc.provider,
        userId: acc.user_id,
        healthScore: acc.health_score || 0,
        healthStatus: acc.health_status || "unknown",
        warmupStatus: acc.warmup_status || "not_started",
        warmupDay: acc.warmup_day || 0,
        sendsToday: acc.sends_today || 0,
        dailyLimit: acc.recommended_daily_limit || acc.daily_send_limit || 50,
        totalSent: acc.total_sent_all_time || 0,
        totalBounced: acc.total_bounced_all_time || 0,
        bounceRate7d: sent7d > 0 ? (bounced7d / sent7d) * 100 : 0,
        sendingPaused: acc.sending_paused || false,
        pauseReason: acc.pause_reason || null,
        tokenExpiry: acc.token_expires_at || null,
        lastSynced: acc.last_synced_at || null,
      };
    });

    return NextResponse.json({
      stats: {
        totalAccounts,
        activeAccounts,
        pausedAccounts,
        healthyAccounts,
        criticalAccounts,
        totalSentToday,
        totalSentAllTime,
        systemBounceRate,
        providerDistribution,
        expiringTokens: expiringTokens.length,
      },
      accounts: accountOverviews,
      recentErrors: recentErrors || [],
      expiringTokens,
    });
  } catch (error: any) {
    console.error("Admin email monitor error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin email monitor data" },
      { status: 500 }
    );
  }
}
