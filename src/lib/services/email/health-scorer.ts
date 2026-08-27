// =============================================
// Email Health Scoring Service
// =============================================
// Calculates health scores for email accounts based on
// authentication, bounce rates, engagement, consistency, warmup, and domain config.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface HealthScore {
  accountId: string;
  overallScore: number;
  status: "excellent" | "healthy" | "needs_attention" | "at_risk" | "critical";
  authentication: number;
  bounce: number;
  engagement: number;
  consistency: number;
  warmup: number;
  domain: number;
  factors: Record<string, any>;
  recommendations: string[];
}

// =============================================
// Main Health Score Calculator
// =============================================

export async function calculateHealthScore(accountId: string): Promise<HealthScore | null> {
  const sp = getSp();

  const { data: account } = await sp
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (!account) return null;

  const userId = account.user_id;

  // Gather data
  const [sendingStats, recentEvents, warmupData] = await Promise.all([
    getSendingStats(accountId, userId),
    getRecentEvents(accountId, 30),
    getWarmupData(accountId),
  ]);

  // Calculate component scores
  const authentication = calculateAuthenticationScore(account);
  const bounce = calculateBounceScore(sendingStats, recentEvents);
  const engagement = calculateEngagementScore(sendingStats, recentEvents);
  const consistency = calculateConsistencyScore(sendingStats);
  const warmup = calculateWarmupScore(account, warmupData);
  const domain = calculateDomainScore(account);

  // Weighted overall score
  const weights = {
    authentication: 0.25,
    bounce: 0.25,
    engagement: 0.2,
    consistency: 0.1,
    warmup: 0.1,
    domain: 0.1,
  };

  const overallScore = Math.round(
    authentication * weights.authentication +
    bounce * weights.bounce +
    engagement * weights.engagement +
    consistency * weights.consistency +
    warmup * weights.warmup +
    domain * weights.domain
  );

  const status = getStatus(overallScore);

  // Generate factors and recommendations
  const factors = {
    authentication: { score: authentication, details: getAuthDetails(account) },
    bounce: { score: bounce, details: getBounceDetails(sendingStats) },
    engagement: { score: engagement, details: getEngagementDetails(sendingStats) },
    consistency: { score: consistency, details: getConsistencyDetails(sendingStats) },
    warmup: { score: warmup, details: getWarmupDetails(account, warmupData) },
    domain: { score: domain, details: getDomainDetails(account) },
  };

  const recommendations = generateRecommendations(factors, account);

  const result: HealthScore = {
    accountId,
    overallScore,
    status,
    authentication,
    bounce,
    engagement,
    consistency,
    warmup,
    domain,
    factors,
    recommendations,
  };

  // Store the score
  await storeHealthScore(userId, result);
  await updateAccountHealth(accountId, overallScore, status);

  return result;
}

// =============================================
// Component Score Calculators
// =============================================

function calculateAuthenticationScore(account: any): number {
  let score = 100;

  // Token validity
  if (!account.access_token && !account.smtp_host) score -= 30;

  // Token expiry
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    if (expiresAt < Date.now()) score -= 40;
    else if (expiresAt < Date.now() + 7 * 24 * 60 * 60 * 1000) score -= 10;
  }

  // DNS auth
  if (account.spf_status === "valid") score += 0;
  else if (account.spf_status === "invalid") score -= 15;
  else score -= 5;

  if (account.dkim_status === "valid") score += 0;
  else if (account.dkim_status === "invalid") score -= 15;
  else score -= 5;

  if (account.dmarc_status === "valid") score += 0;
  else if (account.dmarc_status === "invalid") score -= 10;
  else score -= 3;

  return Math.max(0, Math.min(100, score));
}

function calculateBounceScore(stats: any, events: any[]): number {
  let score = 100;

  const bounceRate7d = stats.bounceRate7d || 0;
  const bounceRate30d = stats.bounceRate30d || 0;
  const hardBounces = stats.hardBounces7d || 0;

  // 7-day bounce rate impact
  if (bounceRate7d > 5) score -= 40;
  else if (bounceRate7d > 3) score -= 25;
  else if (bounceRate7d > 1) score -= 10;

  // 30-day bounce rate impact
  if (bounceRate30d > 5) score -= 20;
  else if (bounceRate30d > 3) score -= 10;

  // Hard bounces are more serious
  if (hardBounces > 5) score -= 20;
  else if (hardBounces > 2) score -= 10;

  // Recent bounces in events
  const recentBounces = events.filter(e =>
    e.event_type === "bounced" || e.event_type === "hard_bounced"
  ).length;
  if (recentBounces > 10) score -= 15;
  else if (recentBounces > 5) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function calculateEngagementScore(stats: any, events: any[]): number {
  let score = 50; // Start at neutral

  const replyRate7d = stats.replyRate7d || 0;
  const openRate = stats.openRate || 0;

  // Reply rate is a strong positive signal
  if (replyRate7d > 5) score += 30;
  else if (replyRate7d > 2) score += 20;
  else if (replyRate7d > 0) score += 10;
  else score -= 10;

  // Open rate
  if (openRate > 30) score += 20;
  else if (openRate > 15) score += 10;
  else if (openRate > 5) score += 5;

  // Complaint signals reduce engagement
  const complaints = events.filter(e => e.event_type === "complaint").length;
  if (complaints > 3) score -= 30;
  else if (complaints > 0) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function calculateConsistencyScore(stats: any): number {
  let score = 50;

  const sentLast7d = stats.sentLast7d || 0;
  const sentLast30d = stats.sentLast30d || 0;
  const avgDailyLast30d = sentLast30d / 30;

  // Consistent sending is good
  if (sentLast7d > 0 && avgDailyLast30d > 0) {
    const ratio = sentLast7d / 7 / avgDailyLast30d;
    // If sending is within 50-200% of average, that's consistent
    if (ratio >= 0.5 && ratio <= 2) score += 30;
    else if (ratio >= 0.2 && ratio <= 3) score += 15;
    else score -= 10; // Too erratic
  } else if (sentLast7d === 0 && sentLast30d > 0) {
    score -= 20; // Stopped sending
  } else if (sentLast30d === 0) {
    score -= 10; // Never sent
  }

  // Sending too fast is bad
  if (sentLast7d > 500) score -= 20;
  else if (sentLast7d > 200) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function calculateWarmupScore(account: any, warmup: any): number {
  if (account.warmup_status === "completed") return 100;
  if (!warmup) return 50; // No warmup = neutral

  let score = 50;

  if (warmup.status === "active") {
    score += Math.min(40, warmup.day_number * 4);
    if (warmup.health_current > warmup.health_at_start) score += 10;
  } else if (warmup.status === "paused") {
    score += Math.min(20, warmup.day_number * 2);
  } else if (warmup.status === "failed") {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateDomainScore(account: any): number {
  let score = 50;

  if (account.spf_status === "valid") score += 20;
  else if (account.spf_status === "invalid") score -= 20;

  if (account.dkim_status === "valid") score += 15;
  else if (account.dkim_status === "invalid") score -= 15;

  if (account.dmarc_status === "valid") score += 15;
  else if (account.dmarc_status === "invalid") score -= 10;

  return Math.max(0, Math.min(100, score));
}

// =============================================
// Helpers
// =============================================

async function getSendingStats(accountId: string, userId: string) {
  const sp = getSp();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sendingLog } = await sp
    .from("email_sending_log")
    .select("status, bounce_type, sent_at")
    .eq("account_id", accountId)
    .gte("created_at", thirtyDaysAgo);

  const logs = sendingLog || [];

  const sentLast7d = logs.filter(l =>
    l.status === "sent" && l.sent_at && new Date(l.sent_at) >= new Date(sevenDaysAgo)
  ).length;

  const sentLast30d = logs.filter(l => l.status === "sent").length;

  const bouncedLast7d = logs.filter(l =>
    (l.status === "bounced") && l.sent_at && new Date(l.sent_at) >= new Date(sevenDaysAgo)
  ).length;

  const hardBounces7d = logs.filter(l =>
    l.bounce_type === "hard" && l.sent_at && new Date(l.sent_at) >= new Date(sevenDaysAgo)
  ).length;

  const softBounces7d = logs.filter(l =>
    l.bounce_type === "soft" && l.sent_at && new Date(l.sent_at) >= new Date(sevenDaysAgo)
  ).length;

  const bounceRate7d = sentLast7d > 0 ? (bouncedLast7d / sentLast7d) * 100 : 0;

  const bouncedLast30d = logs.filter(l => l.status === "bounced").length;
  const bounceRate30d = sentLast30d > 0 ? (bouncedLast30d / sentLast30d) * 100 : 0;

  // Get reply rate from email_messages
  const { count: replyCount } = await sp
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("direction", "inbound")
    .gte("created_at", sevenDaysAgo);

  const replyRate7d = sentLast7d > 0 ? ((replyCount || 0) / sentLast7d) * 100 : 0;

  // Get open rate
  const { count: openedCount } = await sp
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("direction", "outbound")
    .not("opened_at", "is", null);

  const openRate = sentLast30d > 0 ? ((openedCount || 0) / sentLast30d) * 100 : 0;

  return {
    sentLast7d,
    sentLast30d,
    bouncedLast7d,
    hardBounces7d,
    softBounces7d,
    bounceRate7d,
    bounceRate30d,
    replyRate7d,
    openRate,
  };
}

async function getRecentEvents(accountId: string, days: number) {
  const sp = getSp();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await sp
    .from("email_health_events")
    .select("*")
    .eq("account_id", accountId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  return events || [];
}

async function getWarmupData(accountId: string) {
  const sp = getSp();
  const { data } = await sp
    .from("email_warmup")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .limit(1)
    .single();

  return data;
}

function getAuthDetails(account: any): string {
  if (!account.access_token && !account.smtp_host) return "No authentication configured";
  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now()) {
    return "Authentication token has expired";
  }
  return "Authentication is valid";
}

function getBounceDetails(stats: any): string {
  if (stats.bounceRate7d > 5) return `High bounce rate: ${stats.bounceRate7d.toFixed(1)}% in 7 days`;
  if (stats.bounceRate7d > 3) return `Elevated bounce rate: ${stats.bounceRate7d.toFixed(1)}% in 7 days`;
  if (stats.hardBounces7d > 0) return `${stats.hardBounces7d} hard bounces in 7 days`;
  return "Bounce rate is healthy";
}

function getEngagementDetails(stats: any): string {
  if (stats.replyRate7d > 2) return `Good reply rate: ${stats.replyRate7d.toFixed(1)}%`;
  if (stats.replyRate7d > 0) return `Reply rate: ${stats.replyRate7d.toFixed(1)}%`;
  return "No replies detected yet";
}

function getConsistencyDetails(stats: any): string {
  if (stats.sentLast7d === 0) return "No emails sent in the last 7 days";
  if (stats.sentLast7d > 500) return "Sending volume is very high — consider reducing";
  return `Sent ${stats.sentLast7d} emails in the last 7 days`;
}

function getWarmupDetails(account: any, warmup: any): string {
  if (account.warmup_status === "completed") return "Warm-up completed";
  if (!warmup) return "No warm-up in progress";
  if (warmup.status === "active") return `Warm-up day ${warmup.day_number}, target: ${warmup.daily_target}/day`;
  if (warmup.status === "paused") return "Warm-up is paused";
  return "Warm-up status unknown";
}

function getDomainDetails(account: any): string {
  const issues: string[] = [];
  if (account.spf_status !== "valid") issues.push("SPF");
  if (account.dkim_status !== "valid") issues.push("DKIM");
  if (account.dmarc_status !== "valid") issues.push("DMARC");
  if (issues.length > 0) return `${issues.join(", ")} not configured or invalid`;
  return "All DNS records verified";
}

function getStatus(score: number): HealthScore["status"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 50) return "needs_attention";
  if (score >= 30) return "at_risk";
  return "critical";
}

function generateRecommendations(factors: Record<string, any>, account: any): string[] {
  const recs: string[] = [];

  if (factors.authentication.score < 70) {
    recs.push("Re-authenticate your email account. The current token may be expired or invalid.");
  }
  if (factors.bounce.score < 60) {
    recs.push("Review your recipient list. High bounce rates harm your sending reputation.");
  }
  if (factors.bounce.score < 40) {
    recs.push("Pause sending immediately. Your bounce rate requires attention before continuing.");
  }
  if (factors.engagement.score < 40) {
    recs.push("Improve your email personalization. Generic outreach gets ignored.");
  }
  if (factors.consistency.score < 40) {
    recs.push("Maintain a consistent sending schedule. Erratic patterns hurt deliverability.");
  }
  if (factors.warmup.score < 50 && account.warmup_status !== "completed") {
    recs.push("Consider starting or completing a warm-up sequence for this account.");
  }
  if (factors.domain.score < 60) {
    recs.push("Configure SPF, DKIM, and DMARC records to improve authentication.");
  }

  return recs;
}

async function storeHealthScore(userId: string, score: HealthScore) {
  const sp = getSp();
  await sp.from("email_health_scores").insert({
    user_id: userId,
    account_id: score.accountId,
    health_score: score.overallScore,
    health_status: score.status,
    authentication_score: score.authentication,
    bounce_score: score.bounce,
    engagement_score: score.engagement,
    consistency_score: score.consistency,
    warmup_score: score.warmup,
    domain_score: score.domain,
    factors: score.factors,
    recommendations: score.recommendations,
  });
}

async function updateAccountHealth(accountId: string, score: number, status: string) {
  const sp = getSp();
  await sp.from("email_accounts").update({
    health_score: score,
    health_status: status,
    health_last_checked_at: new Date().toISOString(),
  }).eq("id", accountId);
}

// =============================================
// Calculate all accounts for a user
// =============================================

export async function calculateAllAccountHealth(userId: string): Promise<HealthScore[]> {
  const sp = getSp();
  const { data: accounts } = await sp
    .from("email_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!accounts) return [];

  const scores: HealthScore[] = [];
  for (const account of accounts) {
    const score = await calculateHealthScore(account.id);
    if (score) scores.push(score);
  }

  return scores;
}
