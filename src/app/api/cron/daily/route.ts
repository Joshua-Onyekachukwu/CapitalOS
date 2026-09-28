// =============================================
// Daily maintenance cron
// =============================================
// Called by Vercel Cron (vercel.json crons) once per day. Runs the
// background work the outreach loop needs but which nothing triggered until
// now: reply polling across all active email accounts.
//
// Auth: the caller must present the CRON_SECRET env var as a Bearer token.
// The admin manual trigger (POST /api/admin/poll-emails) remains available
// for on-demand runs.

import { NextRequest, NextResponse } from "next/server";
import { pollEmailAccounts } from "@/lib/services/email/reply-poller";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const pollResults = await pollEmailAccounts(); // all users, all active accounts
    const totalReplies = pollResults.reduce((sum, r) => sum + r.repliesDetected, 0);
    const errors = pollResults.filter((r) => r.errors.length > 0);

    console.log(
      `[cron/daily] polled ${pollResults.length} accounts, ${totalReplies} replies, ` +
      `${errors.length} account errors, ${Date.now() - startedAt}ms`
    );

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      accountsPolled: pollResults.length,
      repliesDetected: totalReplies,
      accountErrors: errors.length,
    });
  } catch (err) {
    console.error("[cron/daily] failed:", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
