// API Route: Email Reply Polling
import { NextRequest, NextResponse } from "next/server";
import { pollEmailAccounts } from "@/lib/services/email/reply-poller";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    const results = await pollEmailAccounts(userId || undefined);

    return NextResponse.json({
      success: true,
      accountsPolled: results.length,
      totalReplies: results.reduce((sum, r) => sum + r.repliesDetected, 0),
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
