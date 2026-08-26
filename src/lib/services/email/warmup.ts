// =============================================
// Email Warm-Up Service
// =============================================
// Manages gradual sending volume ramp-up for new accounts.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================
// Warm-Up Stage Definitions
// =============================================

const WARMUP_STAGES = [
  { stage: 1, dailyTarget: 5, label: "Getting Started" },
  { stage: 2, dailyTarget: 8, label: "Building Reputation" },
  { stage: 3, dailyTarget: 12, label: "Gaining Traction" },
  { stage: 4, dailyTarget: 18, label: "Growing Volume" },
  { stage: 5, dailyTarget: 25, label: "Scaling Up" },
  { stage: 6, dailyTarget: 35, label: "Established Sender" },
  { stage: 7, dailyTarget: 50, label: "High Volume" },
  { stage: 8, dailyTarget: 70, label: "Approaching Limit" },
  { stage: 9, dailyTarget: 90, label: "Near Maximum" },
  { stage: 10, dailyTarget: 120, label: "Full Capacity" },
];

export interface WarmupStatus {
  id: string;
  accountId: string;
  status: "active" | "paused" | "completed" | "failed";
  currentStage: number;
  dailyTarget: number;
  dailySent: number;
  dayNumber: number;
  stageLabel: string;
  healthAtStart: number;
  healthCurrent: number;
}

// =============================================
// Start Warm-Up
// =============================================

export async function startWarmup(
  userId: string,
  accountId: string,
  startingStage: number = 1
): Promise<WarmupStatus | null> {
  const sp = getSp();

  // Check if already in warmup
  const existing = await sp
    .from("email_warmup")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (existing.data) return null; // Already warming up

  const stage = WARMUP_STAGES[Math.max(0, Math.min(startingStage - 1, 9))];

  // Get current health score
  const { data: account } = await sp
    .from("email_accounts")
    .select("health_score")
    .eq("id", accountId)
    .single();

  const { data } = await sp.from("email_warmup").insert({
    user_id: userId,
    account_id: accountId,
    status: "active",
    current_stage: stage.stage,
    daily_target: stage.dailyTarget,
    daily_sent: 0,
    day_number: 1,
    health_at_start: account?.health_score || 0,
    health_current: account?.health_score || 0,
    auto_escalate: true,
    daily_log: [],
  }).select().single();

  // Update account
  await sp.from("email_accounts").update({
    warmup_status: "active",
    warmup_day: 1,
    warmup_started_at: new Date().toISOString(),
    recommended_daily_limit: stage.dailyTarget,
  }).eq("id", accountId);

  return {
    id: data.id,
    accountId,
    status: "active",
    currentStage: stage.stage,
    dailyTarget: stage.dailyTarget,
    dailySent: 0,
    dayNumber: 1,
    stageLabel: stage.label,
    healthAtStart: account?.health_score || 0,
    healthCurrent: account?.health_score || 0,
  };
}

// =============================================
// Pause Warm-Up
// =============================================

export async function pauseWarmup(accountId: string): Promise<void> {
  const sp = getSp();

  await sp.from("email_warmup").update({
    status: "paused",
    paused_at: new Date().toISOString(),
  }).eq("account_id", accountId).eq("status", "active");

  await sp.from("email_accounts").update({
    warmup_status: "paused",
  }).eq("id", accountId);
}

// =============================================
// Resume Warm-Up
// =============================================

export async function resumeWarmup(accountId: string): Promise<void> {
  const sp = getSp();

  await sp.from("email_warmup").update({
    status: "active",
    paused_at: null,
  }).eq("account_id", accountId).eq("status", "paused");

  await sp.from("email_accounts").update({
    warmup_status: "active",
  }).eq("id", accountId);
}

// =============================================
// Record daily send during warmup
// =============================================

export async function recordWarmupSend(
  accountId: string,
  count: number = 1
): Promise<void> {
  const sp = getSp();

  const { data: warmup } = await sp
    .from("email_warmup")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!warmup) return;

  const newSent = warmup.daily_sent + count;
  await sp.from("email_warmup").update({
    daily_sent: newSent,
  }).eq("id", warmup.id);

  await sp.from("email_accounts").update({
    warmup_day: warmup.day_number,
  }).eq("id", accountId);
}

// =============================================
// Advance warm-up day (run daily)
// =============================================

export async function advanceWarmupDay(accountId: string): Promise<void> {
  const sp = getSp();

  const { data: warmup } = await sp
    .from("email_warmup")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!warmup) return;

  const { data: account } = await sp
    .from("email_accounts")
    .select("health_score")
    .eq("id", accountId)
    .single();

  const currentHealth = account?.health_score || 0;

  // Log the day
  const dailyLog = warmup.daily_log || [];
  dailyLog.push({
    day: warmup.day_number,
    sent: warmup.daily_sent,
    target: warmup.daily_target,
    health: currentHealth,
  });

  // Check if we should auto-escalate
  let newStage = warmup.current_stage;
  let newTarget = warmup.daily_target;

  if (warmup.auto_escalate && warmup.daily_sent >= warmup.daily_target * 0.8) {
    // Good performance — escalate if health is decent
    if (currentHealth >= 50 && newStage < 10) {
      newStage = Math.min(10, newStage + 1);
      const stageDef = WARMUP_STAGES[newStage - 1];
      newTarget = stageDef.dailyTarget;
    }
  } else if (currentHealth < 30) {
    // Poor health — pause
    await sp.from("email_warmup").update({
      status: "failed",
      health_current: currentHealth,
      daily_log: dailyLog,
    }).eq("id", warmup.id);

    await sp.from("email_accounts").update({
      warmup_status: "failed",
      sending_paused: true,
      pause_reason: "Warm-up failed: health score too low",
    }).eq("id", accountId);
    return;
  }

  // Check if warmup is complete (stage 10 for 3+ days)
  if (newStage >= 10 && warmup.day_number >= 3) {
    await sp.from("email_warmup").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      health_current: currentHealth,
      daily_log: dailyLog,
    }).eq("id", warmup.id);

    await sp.from("email_accounts").update({
      warmup_status: "completed",
      recommended_daily_limit: 120,
    }).eq("id", accountId);
    return;
  }

  // Advance to next day
  await sp.from("email_warmup").update({
    day_number: warmup.day_number + 1,
    current_stage: newStage,
    daily_target: newTarget,
    daily_sent: 0,
    health_current: currentHealth,
    daily_log: dailyLog,
  }).eq("id", warmup.id);

  await sp.from("email_accounts").update({
    warmup_day: warmup.day_number + 1,
    recommended_daily_limit: newTarget,
  }).eq("id", accountId);
}

// =============================================
// Get warmup status
// =============================================

export async function getWarmupStatus(
  accountId: string
): Promise<WarmupStatus | null> {
  const sp = getSp();

  const { data } = await sp
    .from("email_warmup")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  const stageDef = WARMUP_STAGES[data.current_stage - 1] || WARMUP_STAGES[0];

  return {
    id: data.id,
    accountId: data.account_id,
    status: data.status,
    currentStage: data.current_stage,
    dailyTarget: data.daily_target,
    dailySent: data.daily_sent,
    dayNumber: data.day_number,
    stageLabel: stageDef.label,
    healthAtStart: data.health_at_start,
    healthCurrent: data.health_current,
  };
}
