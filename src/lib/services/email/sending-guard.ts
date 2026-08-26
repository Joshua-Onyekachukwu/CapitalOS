// =============================================
// Email Sending Guard Service
// =============================================
// Performs pre-send health checks, enforces sending limits,
// checks suppression lists, and auto-pauses on poor health.

import { createClient } from "@supabase/supabase-js";
import { isSuppressed } from "./suppression";
import { logEvent } from "./events";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface PreSendCheck {
  allowed: boolean;
  reason?: string;
  severity?: "info" | "warning" | "critical";
  recommendations?: string[];
}

// =============================================
// Pre-Send Health Check
// =============================================

export async function checkBeforeSend(
  userId: string,
  accountId: string,
  toAddress: string
): Promise<PreSendCheck> {
  const sp = getSp();

  // 1. Check if account exists and is active
  const { data: account } = await sp
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (!account) {
    return { allowed: false, reason: "Email account not found", severity: "critical" };
  }

  if (!account.is_active) {
    return { allowed: false, reason: "Email account is not active", severity: "critical" };
  }

  // 2. Check if sending is paused
  if (account.sending_paused) {
    return {
      allowed: false,
      reason: account.pause_reason || "Sending is paused for this account",
      severity: "critical",
      recommendations: ["Review your account health and resolve the issue before resuming."],
    };
  }

  // 3. Check suppression list
  const suppressed = await isSuppressed(userId, toAddress);
  if (suppressed) {
    return {
      allowed: false,
      reason: `${toAddress} is on your suppression list`,
      severity: "warning",
      recommendations: ["This address has bounced or unsubscribed previously."],
    };
  }

  // 4. Check daily send limit
  const now = new Date();
  const lastReset = account.last_send_reset_at
    ? new Date(account.last_send_reset_at)
    : new Date(0);
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  let sendsToday = account.sends_today || 0;
  if (hoursSinceReset >= 24) {
    sendsToday = 0;
  }

  const effectiveLimit = account.recommended_daily_limit || account.daily_send_limit || 50;

  if (sendsToday >= effectiveLimit) {
    await logEvent({
      userId,
      accountId,
      eventType: "daily_limit_reached",
      severity: "warning",
      details: { sends_today: sendsToday, limit: effectiveLimit },
    });

    return {
      allowed: false,
      reason: `Daily sending limit reached (${sendsToday}/${effectiveLimit})`,
      severity: "warning",
      recommendations: [
        `You've reached your recommended daily limit of ${effectiveLimit} emails.`,
        "Wait until tomorrow to continue sending, or review your account health to increase the limit.",
      ],
    };
  }

  // 5. Check sending window (time of day)
  const userTimezone = account.timezone || "America/New_York";
  const hourInTZ = parseInt(
    new Date().toLocaleString("en-US", { timeZone: userTimezone, hour: "numeric", hour12: false })
  );

  if (account.sending_window_start != null && account.sending_window_end != null) {
    if (hourInTZ < account.sending_window_start || hourInTZ >= account.sending_window_end) {
      return {
        allowed: false,
        reason: `Outside sending window (${account.sending_window_start}:00 - ${account.sending_window_end}:00 ${userTimezone})`,
        severity: "info",
        recommendations: [
          `Your sending window is set to ${account.sending_window_start}:00 - ${account.sending_window_end}:00.`,
          "Emails sent outside this window may have lower engagement.",
        ],
      };
    }
  }

  // 6. Check health score
  if (account.health_score != null && account.health_score < 30) {
    await logEvent({
      userId,
      accountId,
      eventType: "sending_paused",
      severity: "critical",
      details: {
        health_score: account.health_score,
        reason: "Auto-paused: health score below 30",
      },
    });

    // Auto-pause
    await sp.from("email_accounts").update({
      sending_paused: true,
      pause_reason: `Auto-paused: health score is ${account.health_score}/100`,
    }).eq("id", accountId);

    return {
      allowed: false,
      reason: `Account health is critical (${account.health_score}/100). Sending has been auto-paused.`,
      severity: "critical",
      recommendations: [
        "Review your bounce rates, authentication status, and sending patterns.",
        "Fix any issues before resuming sending.",
      ],
    };
  }

  // 7. Check bounce rate
  if (account.bounce_rate_7d > 5) {
    return {
      allowed: false,
      reason: `High bounce rate: ${account.bounce_rate_7d}% in the last 7 days`,
      severity: "critical",
      recommendations: [
        "Pause sending and review your recipient list.",
        "Remove invalid addresses before continuing.",
      ],
    };
  }

  // 8. Check warmup limits
  if (account.warmup_status === "active") {
    if (sendsToday >= (account.recommended_daily_limit || 5)) {
      return {
        allowed: false,
        reason: `Warm-up limit reached (${sendsToday}/${account.recommended_daily_limit} today)`,
        severity: "warning",
        recommendations: [
          "You're in warm-up mode. Respect the daily limit to build a good sending reputation.",
          "Tomorrow's limit will be higher if today's sends go well.",
        ],
      };
    }
  }

  // All checks passed
  return {
    allowed: true,
    reason: "All pre-send checks passed",
    recommendations: [],
  };
}

// =============================================
// Auto-Pause Check (run periodically)
// =============================================

export async function checkAndAutoPause(
  userId: string,
  accountId: string
): Promise<{ paused: boolean; reason?: string }> {
  const sp = getSp();

  const { data: account } = await sp
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (!account) return { paused: false };

  const reasons: string[] = [];

  // Health score critical
  if (account.health_score != null && account.health_score < 30) {
    reasons.push(`Health score is critical: ${account.health_score}/100`);
  }

  // Bounce rate high
  if (account.bounce_rate_7d > 5) {
    reasons.push(`Bounce rate is high: ${account.bounce_rate_7d}%`);
  }

  // Token expired
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    reasons.push("Authentication token has expired");
  }

  if (reasons.length > 0 && !account.sending_paused) {
    await sp.from("email_accounts").update({
      sending_paused: true,
      pause_reason: reasons.join(". "),
    }).eq("id", accountId);

    await logEvent({
      userId,
      accountId,
      eventType: "sending_paused",
      severity: "critical",
      details: { reasons },
    });

    return { paused: true, reason: reasons.join(". ") };
  }

  return { paused: false };
}

// =============================================
// Resume Sending
// =============================================

export async function resumeSending(
  userId: string,
  accountId: string
): Promise<void> {
  const sp = getSp();

  await sp.from("email_accounts").update({
    sending_paused: false,
    pause_reason: null,
  }).eq("id", accountId);

  await logEvent({
    userId,
    accountId,
    eventType: "sending_resumed",
    severity: "info",
  });
}
