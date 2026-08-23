// =============================================
// Credit Service
// =============================================
// Manages credit consumption, balance checks, and ledger queries.
// Uses CockroachDB for data.

import { query } from "@/lib/db";

// =============================================
// Check if User Has Enough Credits
// =============================================

export async function hasCredits(
  userId: string,
  operation: string
): Promise<{ hasCredits: boolean; balance: number; cost: number }> {
  // Get user's remaining credits
  const subs = await query<{ credits_remaining: number }>(
    `SELECT credits_remaining FROM user_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  );

  const balance = subs[0]?.credits_remaining ?? 0;

  // Get operation cost
  const costs = await query<{ credit_cost: number }>(
    `SELECT credit_cost FROM credit_costs WHERE operation = $1`,
    [operation]
  );

  const cost = costs[0]?.credit_cost ?? 0;

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
  // Get subscription
  const subs = await query<{ id: string; credits_remaining: number }>(
    `SELECT id, credits_remaining FROM user_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  );

  if (!subs.length) {
    return { success: false, balance: 0, cost: 0, error: "No active subscription" };
  }

  const sub = subs[0];

  // Get operation cost
  const costs = await query<{ credit_cost: number }>(
    `SELECT credit_cost FROM credit_costs WHERE operation = $1`,
    [operation]
  );

  const cost = costs[0]?.credit_cost ?? 0;

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
  await query(
    `UPDATE user_subscriptions SET credits_remaining = $1 WHERE id = $2`,
    [newBalance, sub.id]
  );

  // Log to ledger
  await query(
    `INSERT INTO credit_ledger (user_id, amount, balance_after, operation, operation_detail, model_used, tokens_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, -cost, newBalance, operation, options?.detail || {}, options?.modelUsed || null, options?.tokensUsed || null]
  );

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
  const subs = await query<{ id: string; credits_remaining: number }>(
    `SELECT id, credits_remaining FROM user_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  );

  if (!subs.length) {
    return { success: false, balance: 0 };
  }

  const sub = subs[0];
  const newBalance = sub.credits_remaining + amount;

  await query(
    `UPDATE user_subscriptions SET credits_remaining = $1 WHERE id = $2`,
    [newBalance, sub.id]
  );

  await query(
    `INSERT INTO credit_ledger (user_id, amount, balance_after, operation, operation_detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, amount, newBalance, reason, detail || {}]
  );

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
  const rows = await query<any>(
    `SELECT * FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );

  return rows.map((r) => ({
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
