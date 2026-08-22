// =============================================
// Entitlements Service
// =============================================
// Checks whether a user is allowed to perform an operation
// based on their current plan and usage.

import { getUserSubscription, type UserSubscription } from "./plans";

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  upgradeRequired?: boolean;
}

// =============================================
// Check if User Can Add Investor to Database
// =============================================

export async function canAddInvestor(
  userId: string
): Promise<EntitlementCheck> {
  const sub = await getUserSubscription(userId);
  if (!sub) {
    return { allowed: false, reason: "No subscription found", current: 0, limit: 0 };
  }

  // Count current investors (all authenticated users share the investor DB)
  // For per-user limits, we'd need a user_investors junction table
  // For now, the investor DB limit applies globally
  return {
    allowed: true,
    current: 0,
    limit: sub.investorDbLimit,
  };
}

// =============================================
// Check if User Can Run Deep Research
// =============================================

export async function canRunDeepResearch(
  userId: string,
  currentUsageThisPeriod = 0
): Promise<EntitlementCheck> {
  const sub = await getUserSubscription(userId);
  if (!sub) {
    return { allowed: false, reason: "No subscription found", current: 0, limit: 0 };
  }

  const allowed = currentUsageThisPeriod < sub.deepResearchLimit;
  return {
    allowed,
    reason: allowed ? undefined : `Deep research limit reached (${sub.deepResearchLimit}/${sub.deepResearchLimit}). Upgrade for more.`,
    current: currentUsageThisPeriod,
    limit: sub.deepResearchLimit,
    upgradeRequired: !allowed,
  };
}

// =============================================
// Check if User Can Generate Pitch Deck
// =============================================

export async function canGeneratePitchDeck(
  userId: string,
  currentUsageThisPeriod = 0
): Promise<EntitlementCheck> {
  const sub = await getUserSubscription(userId);
  if (!sub) {
    return { allowed: false, reason: "No subscription found", current: 0, limit: 0 };
  }

  const allowed = currentUsageThisPeriod < sub.pitchDeckLimit;
  return {
    allowed,
    reason: allowed ? undefined : `Pitch deck limit reached (${sub.pitchDeckLimit}/${sub.pitchDeckLimit}). Upgrade for more.`,
    current: currentUsageThisPeriod,
    limit: sub.pitchDeckLimit,
    upgradeRequired: !allowed,
  };
}

// =============================================
// Check if User Can Create Campaign
// =============================================

export async function canCreateCampaign(
  userId: string,
  currentActiveCampaigns = 0
): Promise<EntitlementCheck> {
  const sub = await getUserSubscription(userId);
  if (!sub) {
    return { allowed: false, reason: "No subscription found", current: 0, limit: 0 };
  }

  const allowed = currentActiveCampaigns < sub.campaignLimit;
  return {
    allowed,
    reason: allowed ? undefined : `Campaign limit reached (${sub.campaignLimit}/${sub.campaignLimit}). Upgrade for more.`,
    current: currentActiveCampaigns,
    limit: sub.campaignLimit,
    upgradeRequired: !allowed,
  };
}

// =============================================
// Check if User Can Connect Email Account
// =============================================

export async function canConnectEmail(
  userId: string,
  currentConnected = 0
): Promise<EntitlementCheck> {
  const sub = await getUserSubscription(userId);
  if (!sub) {
    return { allowed: false, reason: "No subscription found", current: 0, limit: 0 };
  }

  const allowed = currentConnected < sub.emailAccountsLimit;
  return {
    allowed,
    reason: allowed ? undefined : `Email account limit reached (${sub.emailAccountsLimit}/${sub.emailAccountsLimit}). Upgrade for more.`,
    current: currentConnected,
    limit: sub.emailAccountsLimit,
    upgradeRequired: !allowed,
  };
}

// =============================================
// Generic Credit Check
// =============================================

export async function canPerformOperation(
  userId: string,
  creditsRequired: number,
  currentBalance: number
): Promise<EntitlementCheck> {
  const allowed = currentBalance >= creditsRequired;
  return {
    allowed,
    reason: allowed
      ? undefined
      : `Insufficient credits. Need ${creditsRequired}, have ${currentBalance}. Purchase more credits or upgrade your plan.`,
    current: currentBalance,
    limit: creditsRequired,
    upgradeRequired: !allowed,
  };
}
