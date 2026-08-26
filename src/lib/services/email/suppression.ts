// =============================================
// Email Suppression Service
// =============================================
// Manages the suppression list to prevent sending to
// bounced, unsubscribed, or complained contacts.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SuppressionEntry {
  id: string;
  userId: string;
  emailAddress: string;
  reason: "bounced" | "hard_bounced" | "unsubscribed" | "complained" | "manual";
  bounceType?: "hard" | "soft";
  source: "system" | "manual" | "campaign";
  suppressedAt: string;
  expiresAt?: string;
  notes?: string;
}

// =============================================
// Check if an address is suppressed
// =============================================

export async function isSuppressed(userId: string, emailAddress: string): Promise<boolean> {
  const sp = getSp();
  const normalized = emailAddress.toLowerCase().trim();

  const { data } = await sp
    .from("email_suppression_list")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("email_address", normalized)
    .limit(1)
    .single();

  if (!data) return false;

  // Check if suppression has expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Remove expired suppression
    await sp.from("email_suppression_list").delete().eq("id", data.id);
    return false;
  }

  return true;
}

// =============================================
// Check multiple addresses at once
// =============================================

export async function filterSuppressed(
  userId: string,
  emailAddresses: string[]
): Promise<{ allowed: string[]; suppressed: string[] }> {
  const sp = getSp();
  const normalized = emailAddresses.map(e => e.toLowerCase().trim());

  const { data } = await sp
    .from("email_suppression_list")
    .select("email_address, expires_at")
    .eq("user_id", userId)
    .in("email_address", normalized);

  const suppressedSet = new Set<string>();
  const expiredIds: string[] = [];

  for (const entry of data || []) {
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      expiredIds.push(entry.email_address);
    } else {
      suppressedSet.add(entry.email_address);
    }
  }

  // Clean up expired entries
  if (expiredIds.length > 0) {
    await sp.from("email_suppression_list")
      .delete()
      .eq("user_id", userId)
      .in("email_address", expiredIds);
  }

  const allowed: string[] = [];
  const suppressed: string[] = [];

  for (const addr of normalized) {
    if (suppressedSet.has(addr)) {
      suppressed.push(addr);
    } else {
      allowed.push(addr);
    }
  }

  return { allowed, suppressed };
}

// =============================================
// Add to suppression list
// =============================================

export async function suppressAddress(
  userId: string,
  emailAddress: string,
  reason: SuppressionEntry["reason"],
  options?: {
    bounceType?: "hard" | "soft";
    source?: string;
    campaignId?: string;
    expiresAt?: string;
    notes?: string;
  }
): Promise<void> {
  const sp = getSp();
  const normalized = emailAddress.toLowerCase().trim();

  // Check if already suppressed
  const existing = await isSuppressed(userId, normalized);
  if (existing) return;

  await sp.from("email_suppression_list").insert({
    user_id: userId,
    email_address: normalized,
    reason,
    bounce_type: options?.bounceType || null,
    source: options?.source || "system",
    campaign_id: options?.campaignId || null,
    expires_at: options?.expiresAt || null,
    notes: options?.notes || null,
  });

  // Log the event
  await sp.from("email_health_events").insert({
    user_id: userId,
    event_type: "suppressed",
    severity: reason === "hard_bounced" ? "critical" : "warning",
    details: {
      email_address: normalized,
      reason,
      bounce_type: options?.bounceType,
    },
  });
}

// =============================================
// Remove from suppression list
// =============================================

export async function unsuppressAddress(
  userId: string,
  emailAddress: string
): Promise<void> {
  const sp = getSp();
  const normalized = emailAddress.toLowerCase().trim();

  await sp.from("email_suppression_list")
    .delete()
    .eq("user_id", userId)
    .eq("email_address", normalized);
}

// =============================================
// Get full suppression list
// =============================================

export async function getSuppressionList(
  userId: string,
  options?: { limit?: number; offset?: number; reason?: string }
): Promise<{ entries: SuppressionEntry[]; total: number }> {
  const sp = getSp();

  let query = sp
    .from("email_suppression_list")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("suppressed_at", { ascending: false });

  if (options?.reason) {
    query = query.eq("reason", options.reason);
  }

  if (options?.limit) {
    query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
  }

  const { data, count } = await query;

  return {
    entries: (data || []) as SuppressionEntry[],
    total: count || 0,
  };
}

// =============================================
// Auto-suppress on bounce
// =============================================

export async function handleBounce(
  userId: string,
  emailAddress: string,
  bounceType: "hard" | "soft",
  accountId?: string
): Promise<void> {
  // Hard bounces are always suppressed permanently
  if (bounceType === "hard") {
    await suppressAddress(userId, emailAddress, "hard_bounced", {
      bounceType: "hard",
      source: "system",
      notes: "Auto-suppressed: hard bounce detected",
    });

    // Update account bounce count
    if (accountId) {
      const sp = getSp();
      await sp.rpc("increment_bounce_count" as any, { p_account_id: accountId }).catch(() => {
        // Fallback: direct update
        sp.from("email_accounts").select("total_bounced_all_time").eq("id", accountId).single().then(({ data }) => {
          if (data) {
            sp.from("email_accounts").update({
              total_bounced_all_time: (data.total_bounced_all_time || 0) + 1,
            }).eq("id", accountId);
          }
        });
      });
    }
  }
  // Soft bounces: suppress after 3 consecutive soft bounces
  else {
    const sp = getSp();
    const recentSoftBounces = await sp
      .from("email_sending_log")
      .select("id", { count: "exact", head: true })
      .eq("to_address", emailAddress.toLowerCase().trim())
      .eq("bounce_type", "soft")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if ((recentSoftBounces.count || 0) >= 3) {
      await suppressAddress(userId, emailAddress, "bounced", {
        bounceType: "soft",
        source: "system",
        notes: `Auto-suppressed: ${recentSoftBounces.count} soft bounces in 7 days`,
      });
    }
  }
}

// =============================================
// Auto-suppress on unsubscribe
// =============================================

export async function handleUnsubscribe(
  userId: string,
  emailAddress: string
): Promise<void> {
  await suppressAddress(userId, emailAddress, "unsubscribed", {
    source: "system",
    notes: "Auto-suppressed: recipient unsubscribed",
  });
}

// =============================================
// Auto-suppress on complaint
// =============================================

export async function handleComplaint(
  userId: string,
  emailAddress: string
): Promise<void> {
  await suppressAddress(userId, emailAddress, "complained", {
    source: "system",
    notes: "Auto-suppressed: spam complaint received",
  });
}
