// API Route: Email Reply Polling
import { NextRequest, NextResponse } from "next/server";
import { pollEmailAccounts } from "@/lib/services/email/reply-poller";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
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
      { error: err instanceof Error ? err.message : "Email polling failed" },
      { status: 500 }
    );
  }
}
