// =============================================
// Email Recommendations Service
// =============================================
// Generates smart, actionable recommendations based on email health data.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface Recommendation {
  id: string;
  type: "action" | "warning" | "info" | "critical";
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
  priority: number; // 1 = highest
  category: "health" | "warmup" | "sending" | "auth" | "domain" | "suppression";
}

// =============================================
// Generate Recommendations for an Account
// =============================================

export async function getRecommendations(
  userId: string,
  accountId?: string
): Promise<Recommendation[]> {
  const sp = getSp();

  let query = sp
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (accountId) {
    query = query.eq("id", accountId);
  }

  const { data: accounts } = await query;
  if (!accounts?.length) return [];

  const recommendations: Recommendation[] = [];

  for (const account of accounts) {
    // Critical: sending paused
    if (account.sending_paused) {
      recommendations.push({
        id: `paused-${account.id}`,
        type: "critical",
        title: "Sending paused",
        description: account.pause_reason || "Sending has been paused due to health issues.",
        action: "Review account health",
        actionUrl: "/dashboard/email-health",
        priority: 1,
        category: "health",
      });
    }

    // Critical: token expired
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      recommendations.push({
        id: `token-${account.id}`,
        type: "critical",
        title: "Authentication expired",
        description: `Your ${account.provider} token for ${account.email_address} has expired. Reconnect to continue sending.`,
        action: "Reconnect account",
        actionUrl: "/dashboard/settings",
        priority: 1,
        category: "auth",
      });
    }

    // Warning: high bounce rate
    if (account.bounce_rate_7d > 3) {
      recommendations.push({
        id: `bounce-${account.id}`,
        type: "warning",
        title: "High bounce rate",
        description: `Your bounce rate is ${account.bounce_rate_7d.toFixed(1)}% over the last 7 days. This can harm your sending reputation.`,
        action: "Review recipient list",
        actionUrl: "/dashboard/email-health",
        priority: 2,
        category: "sending",
      });
    }

    // Warning: health score declining
    if (account.health_score != null && account.health_score < 50) {
      recommendations.push({
        id: `health-${account.id}`,
        type: "warning",
        title: "Account health needs attention",
        description: `Your email health score is ${account.health_score}/100. Review the health dashboard to identify issues.`,
        action: "View health details",
        actionUrl: "/dashboard/email-health",
        priority: 2,
        category: "health",
      });
    }

    // Info: warmup recommended
    if (
      account.warmup_status === "not_started" &&
      account.total_sent_all_time < 100
    ) {
      recommendations.push({
        id: `warmup-${account.id}`,
        type: "info",
        title: "Start warm-up",
        description: `Your ${account.email_address} account is new. Start a warm-up sequence to build a good sending reputation.`,
        action: "Start warm-up",
        actionUrl: "/dashboard/email-health/warmup",
        priority: 3,
        category: "warmup",
      });
    }

    // Info: DNS not configured
    if (
      account.spf_status !== "valid" ||
      account.dkim_status !== "valid" ||
      account.dmarc_status !== "valid"
    ) {
      const missing: string[] = [];
      if (account.spf_status !== "valid") missing.push("SPF");
      if (account.dkim_status !== "valid") missing.push("DKIM");
      if (account.dmarc_status !== "valid") missing.push("DMARC");

      recommendations.push({
        id: `dns-${account.id}`,
        type: "warning",
        title: "DNS records need configuration",
        description: `${missing.join(", ")} records are not configured for your domain. This affects email authentication and deliverability.`,
        action: "Check domain health",
        actionUrl: "/dashboard/email-health/domain",
        priority: 3,
        category: "domain",
      });
    }

    // Info: low engagement
    if (account.reply_rate_7d < 1 && account.total_sent_all_time > 50) {
      recommendations.push({
        id: `engagement-${account.id}`,
        type: "info",
        title: "Low reply rate",
        description: "Your reply rate is below 1%. Consider improving your email personalization and targeting.",
        priority: 4,
        category: "sending",
      });
    }
  }

  // Sort by priority
  recommendations.sort((a, b) => a.priority - b.priority);

  return recommendations;
}

// =============================================
// Get sending capacity recommendation
// =============================================

export async function getSendingCapacity(
  userId: string,
  accountId: string
): Promise<{
  providerLimit: number;
  recommendedToday: number;
  sentToday: number;
  remaining: number;
  warmupLimited: boolean;
  explanation: string;
}> {
  const sp = getSp();

  const { data: account } = await sp
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (!account) {
    return {
      providerLimit: 0,
      recommendedToday: 0,
      sentToday: 0,
      remaining: 0,
      warmupLimited: false,
      explanation: "Account not found",
    };
  }

  const providerLimit = account.daily_send_limit || 500;

  // Check if in warmup
  const warmupLimited = account.warmup_status === "active";
  const recommendedToday = account.recommended_daily_limit || providerLimit;

  // Reset sends_today if needed
  const now = new Date();
  const lastReset = account.last_send_reset_at
    ? new Date(account.last_send_reset_at)
    : new Date(0);
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  let sentToday = account.sends_today || 0;
  if (hoursSinceReset >= 24) sentToday = 0;

  const remaining = Math.max(0, recommendedToday - sentToday);

  let explanation = "";
  if (account.sending_paused) {
    explanation = "Sending is paused due to health issues. Resolve them before continuing.";
  } else if (warmupLimited) {
    explanation = `Your account is warming up (day ${account.warmup_day || 1}). The recommended limit will increase as your reputation improves.`;
  } else if (account.health_score != null && account.health_score < 50) {
    explanation = `Recommended volume is reduced due to health score (${account.health_score}/100). Improve health to increase capacity.`;
  } else {
    explanation = `You can safely send up to ${recommendedToday} emails today based on your account health and sending history.`;
  }

  return {
    providerLimit,
    recommendedToday,
    sentToday,
    remaining,
    warmupLimited,
    explanation,
  };
}
