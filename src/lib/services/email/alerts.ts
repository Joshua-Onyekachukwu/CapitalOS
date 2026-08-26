// =============================================
// Email Alerts Service
// =============================================
// Generates smart alerts for health issues, milestones, and important events.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  accountId?: string;
  category: string;
  actionUrl?: string;
  acknowledged: boolean;
  createdAt: string;
}

// =============================================
// Generate Alerts for a User
// =============================================

export async function getActiveAlerts(
  userId: string
): Promise<Alert[]> {
  const sp = getSp();

  const { data: accounts } = await sp
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!accounts?.length) return [];

  const alerts: Alert[] = [];

  for (const account of accounts) {
    // Critical: token expired
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      alerts.push({
        id: `alert-token-${account.id}`,
        type: "critical",
        title: "Authentication expired",
        message: `Your ${account.provider} token for ${account.email_address} has expired. Reconnect in Settings to continue sending.`,
        accountId: account.id,
        category: "auth",
        actionUrl: "/dashboard/settings",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Critical: sending paused
    if (account.sending_paused) {
      alerts.push({
        id: `alert-paused-${account.id}`,
        type: "critical",
        title: "Sending paused",
        message: account.pause_reason || "Sending has been paused due to health issues.",
        accountId: account.id,
        category: "health",
        actionUrl: "/dashboard/email-health",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Warning: high bounce rate
    if (account.bounce_rate_7d > 5) {
      alerts.push({
        id: `alert-bounce-${account.id}`,
        type: "warning",
        title: "High bounce rate detected",
        message: `Your bounce rate increased to ${account.bounce_rate_7d.toFixed(1)}% over 7 days. Review your recipient list before continuing.`,
        accountId: account.id,
        category: "deliverability",
        actionUrl: "/dashboard/email-health",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Warning: health score critical
    if (account.health_score != null && account.health_score < 40) {
      alerts.push({
        id: `alert-health-${account.id}`,
        type: "warning",
        title: "Account health needs attention",
        message: `Health score is ${account.health_score}/100. Check the health dashboard for specific recommendations.`,
        accountId: account.id,
        category: "health",
        actionUrl: "/dashboard/email-health",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Info: warmup milestone
    if (account.warmup_status === "active" && account.warmup_day) {
      const milestones = [1, 3, 5, 7, 10, 14, 21, 30];
      if (milestones.includes(account.warmup_day)) {
        alerts.push({
          id: `alert-warmup-${account.id}-${account.warmup_day}`,
          type: "success",
          title: "Warm-up milestone",
          message: `Day ${account.warmup_day} complete. Your sending reputation is building.`,
          accountId: account.id,
          category: "warmup",
          actionUrl: "/dashboard/email-health/warmup",
          acknowledged: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Info: warmup completed
    if (account.warmup_status === "completed") {
      alerts.push({
        id: `alert-warmup-done-${account.id}`,
        type: "success",
        title: "Warm-up completed",
        message: `Your ${account.email_address} account has completed warm-up. You can now send at full capacity.`,
        accountId: account.id,
        category: "warmup",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Warning: DNS issues
    const missingDns: string[] = [];
    if (account.spf_status !== "valid") missingDns.push("SPF");
    if (account.dkim_status !== "valid") missingDns.push("DKIM");
    if (account.dmarc_status !== "valid") missingDns.push("DMARC");

    if (missingDns.length > 0) {
      alerts.push({
        id: `alert-dns-${account.id}`,
        type: "warning",
        title: "DNS configuration incomplete",
        message: `${missingDns.join(", ")} records are not configured. This affects email authentication.`,
        accountId: account.id,
        category: "domain",
        actionUrl: "/dashboard/email-health/domain",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Sort: critical first, then warning, info, success
  const order = { critical: 0, warning: 1, info: 2, success: 3 };
  alerts.sort((a, b) => order[a.type] - order[b.type]);

  return alerts;
}

// =============================================
// Get alert count
// =============================================

export async function getAlertCount(userId: string): Promise<{
  total: number;
  critical: number;
  warning: number;
  info: number;
}> {
  const alerts = await getActiveAlerts(userId);

  return {
    total: alerts.length,
    critical: alerts.filter(a => a.type === "critical").length,
    warning: alerts.filter(a => a.type === "warning").length,
    info: alerts.filter(a => a.type === "info" || a.type === "success").length,
  };
}
