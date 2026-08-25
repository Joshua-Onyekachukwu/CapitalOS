import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Credit history (may not exist in Supabase)
    let entries: any[] = [];
    try {
      const { data, error } = await sp
        .from("credit_ledger")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      entries = (data || []).map((r) => ({
        id: r.id,
        amount: r.amount,
        balanceAfter: r.balance_after,
        operation: r.operation,
        operationDetail: r.operation_detail || {},
        modelUsed: r.model_used,
        tokensUsed: r.tokens_used,
        createdAt: r.created_at,
      }));
    } catch {
      entries = [];
    }

    // Billing info (may not exist in Supabase)
    let billing = null;
    try {
      const { data: sub } = await sp
        .from("user_subscriptions")
        .select("credits_remaining, credits_used_this_period, plan_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (sub?.plan_id) {
        const { data: plan } = await sp
          .from("billing_plans")
          .select("name, included_credits")
          .eq("id", sub.plan_id)
          .single();
        if (plan) {
          billing = {
            planName: plan.name,
            creditsRemaining: sub.credits_remaining,
            creditsUsedThisPeriod: sub.credits_used_this_period,
            includedCredits: plan.included_credits,
          };
        }
      }
    } catch {
      billing = null;
    }

    return NextResponse.json({ entries, billing });
  } catch (err) {
    console.error("AI activity API error:", err);
    return NextResponse.json({ error: "Failed to load AI activity" }, { status: 500 });
  }
}
