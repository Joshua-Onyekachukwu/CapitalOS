import { NextRequest, NextResponse } from "next/server";
import { queryAs, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch credit history
    const ledgerData = await queryAs<any>(
      user.id,
      `SELECT * FROM credit_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );

    // Fetch billing info (join subscription + plan)
    const billingData = await query<any>(
      `SELECT
         bp.name AS plan_name,
         us.credits_remaining,
         us.credits_used_this_period,
         bp.included_credits
       FROM user_subscriptions us
       JOIN billing_plans bp ON us.plan_id = bp.id
       WHERE us.user_id = $1
       LIMIT 1`,
      [user.id]
    );

    const entries = ledgerData.map((r: any) => ({
      id: r.id,
      amount: r.amount,
      balanceAfter: r.balance_after,
      operation: r.operation,
      operationDetail: r.operation_detail || {},
      modelUsed: r.model_used,
      tokensUsed: r.tokens_used,
      createdAt: r.created_at,
    }));

    const billing = billingData.length > 0 ? {
      planName: billingData[0].plan_name,
      creditsRemaining: billingData[0].credits_remaining,
      creditsUsedThisPeriod: billingData[0].credits_used_this_period,
      includedCredits: billingData[0].included_credits,
    } : null;

    return NextResponse.json({ entries, billing });
  } catch (err) {
    console.error("AI activity API error:", err);
    return NextResponse.json({ error: "Failed to load AI activity" }, { status: 500 });
  }
}
