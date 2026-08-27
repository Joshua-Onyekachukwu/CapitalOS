// =============================================
// Email Warm-Up API
// =============================================

import { NextRequest, NextResponse } from "next/server";
import {
  startWarmup,
  pauseWarmup,
  resumeWarmup,
  getWarmupStatus,
  advanceWarmupDay,
} from "@/lib/services/email/warmup";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";

// GET — Get warmup status
export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (accountId) {
      const status = await getWarmupStatus(accountId);
      return NextResponse.json({ warmup: status });
    }

    // Get all accounts with warmup status
    const { data: accounts } = await sp
      .from("email_accounts")
      .select("id, email_address, provider, warmup_status, warmup_day, recommended_daily_limit")
      .eq("is_active", true);

    if (!accounts?.length) {
      return NextResponse.json({ warmups: [] });
    }

    const warmups = await Promise.all(
      accounts.map(async (account) => {
        const status = await getWarmupStatus(account.id);
        return {
          accountId: account.id,
          email: account.email_address,
          provider: account.provider,
          warmup: status,
        };
      })
    );

    return NextResponse.json({ warmups });
  } catch (error: any) {
    console.error("Warmup GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch warmup status" },
      { status: 500 }
    );
  }
}

// POST — Start, pause, or resume warmup
export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const body = await request.json();
    const { action, accountId, startingStage } = body;

    if (!action || !accountId) {
      return NextResponse.json(
        { error: "action and accountId are required" },
        { status: 400 }
      );
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: account } = await sp
      .from("email_accounts")
      .select("user_id")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    switch (action) {
      case "start": {
        const result = await startWarmup(account.user_id, accountId, startingStage || 1);
        if (!result) {
          return NextResponse.json(
            { error: "Account is already in warm-up" },
            { status: 400 }
          );
        }
        return NextResponse.json({ warmup: result });
      }
      case "pause": {
        await pauseWarmup(accountId);
        return NextResponse.json({ success: true });
      }
      case "resume": {
        await resumeWarmup(accountId);
        return NextResponse.json({ success: true });
      }
      case "advance": {
        await advanceWarmupDay(accountId);
        const status = await getWarmupStatus(accountId);
        return NextResponse.json({ warmup: status });
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Warmup POST error:", error);
    return NextResponse.json(
      { error: "Failed to process warmup request" },
      { status: 500 }
    );
  }
}
