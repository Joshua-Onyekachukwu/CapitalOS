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
import { runApolloEnrichment } from "@/lib/services/investor/apollo-enrichment";

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

    // Scheduled enrichment pass (weekly cadence is enforced inside the
    // service via the run-horizon check). Safe no-op without APOLLO_API_KEY.
    const apollo = await runApolloEnrichment({ limit: 400 });

    console.log(
      `[cron/daily] polled ${pollResults.length} accounts, ${totalReplies} replies, ` +
      `${errors.length} account errors, apollo=${apollo.status} ` +
      `(matched=${apollo.matched}/emails=${apollo.emailsFound}), ${Date.now() - startedAt}ms`
    );

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      accountsPolled: pollResults.length,
      repliesDetected: totalReplies,
      accountErrors: errors.length,
      apollo: apollo,
    });
  } catch (err) {
    console.error("[cron/daily] failed:", err);
    // Scheduled work that partially completed must still report its outcome
    // so the run is observable; a hard failure returns 500 for retry signals.
    const partial = (err as { partial?: unknown }).partial;
    if (partial) return NextResponse.json({ success: false, partial });
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
