// =============================================
// Credit Service
// =============================================
// Manages credit consumption, balance checks, and ledger queries.

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================
// Check if User Has Enough Credits
// =============================================

export async function hasCredits(
  userId: string,
  operation: string
): Promise<{ hasCredits: boolean; balance: number; cost: number }> {
  const supabase = getSupabase();

  // Get user's remaining credits
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("credits_remaining")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  const balance = sub?.credits_remaining ?? 0;

  // Get operation cost
  const { data: costData } = await supabase
    .from("credit_costs")
    .select("credit_cost")
    .eq("operation", operation)
    .single();

  const cost = costData?.credit_cost ?? 0;

  return {
    hasCredits: balance >= cost,
    balance,
    cost,
  };
}

// =============================================
// Consume Credits
// =============================================

export async function consumeCredits(
  userId: string,
  operation: string,
  options?: {
    modelUsed?: string;
    tokensUsed?: number;
    detail?: Record<string, unknown>;
  }
): Promise<{ success: boolean; balance: number; cost: number; error?: string }> {
  const supabase = getSupabase();

  // Get subscription
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("id, credits_remaining")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!sub) {
    return { success: false, balance: 0, cost: 0, error: "No active subscription" };
  }

  // Get operation cost
  const { data: costData } = await supabase
    .from("credit_costs")
    .select("credit_cost")
    .eq("operation", operation)
    .single();

  const cost = costData?.credit_cost ?? 0;

  if (sub.credits_remaining < cost) {
    return {
      success: false,
      balance: sub.credits_remaining,
      cost,
      error: `Insufficient credits. Need ${cost}, have ${sub.credits_remaining}.`,
    };
  }

  const newBalance = sub.credits_remaining - cost;

  // Update subscription balance
  await supabase
    .from("user_subscriptions")
    .update({ credits_remaining: newBalance })
    .eq("id", sub.id);

  // Log to ledger
  await supabase.from("credit_ledger").insert({
    user_id: userId,
    amount: -cost,
    balance_after: newBalance,
    operation,
    operation_detail: options?.detail || {},
    model_used: options?.modelUsed || null,
    tokens_used: options?.tokensUsed || null,
  });

  return { success: true, balance: newBalance, cost };
}

// =============================================
// Add Credits (e.g., from plan upgrade or pack purchase)
// =============================================

export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  detail?: Record<string, unknown>
): Promise<{ success: boolean; balance: number }> {
  const supabase = getSupabase();

  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("id, credits_remaining")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!sub) {
    return { success: false, balance: 0 };
  }

  const newBalance = sub.credits_remaining + amount;

  await supabase
    .from("user_subscriptions")
    .update({ credits_remaining: newBalance })
    .eq("id", sub.id);

  await supabase.from("credit_ledger").insert({
    user_id: userId,
    amount,
    balance_after: newBalance,
    operation: reason,
    operation_detail: detail || {},
  });

  return { success: true, balance: newBalance };
}

// =============================================
// Get Credit History
// =============================================

export async function getCreditHistory(
  userId: string,
  limit = 50
): Promise<
  Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    operation: string;
    operationDetail: Record<string, unknown>;
    modelUsed: string | null;
    tokensUsed: number | null;
    createdAt: string;
  }>
> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("credit_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((r) => ({
    id: r.id,
    amount: r.amount,
    balanceAfter: r.balance_after,
    operation: r.operation,
    operationDetail: r.operation_detail || {},
    modelUsed: r.model_used,
    tokensUsed: r.tokens_used,
    createdAt: r.created_at,
  }));
}
