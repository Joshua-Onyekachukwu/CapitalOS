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
import { pollImapAccounts } from "@/lib/services/email/imap-poller";
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
    const pollResults = await pollEmailAccounts(); // OAuth accounts (Gmail/Microsoft)
    const imapResults = await pollImapAccounts(); // app-password SMTP accounts
    const allResults = [...pollResults, ...imapResults];
    const totalReplies = allResults.reduce((sum, r) => sum + r.repliesDetected, 0);
    const totalChecked = allResults.reduce((sum, r) => sum + r.emailsChecked, 0);
    const errors = allResults.filter((r) => r.errors.length > 0);

    // Scheduled enrichment pass (weekly cadence is enforced inside the
    // service via the run-horizon check). Safe no-op without APOLLO_API_KEY.
    const apollo = await runApolloEnrichment({ limit: 400 });

    console.log(
      `[cron/daily] polled ${allResults.length} accounts, ${totalChecked} checked, ${totalReplies} replies, ` +
      `${errors.length} account errors, apollo=${apollo.status} ` +
      `(matched=${apollo.matched}/emails=${apollo.emailsFound}), ${Date.now() - startedAt}ms`
    );

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      accountsPolled: allResults.length,
      emailsChecked: totalChecked,
      repliesDetected: totalReplies,
      accountErrors: errors.length,
      accountErrorDetails: errors.map((e) => ({ accountId: e.accountId, errors: e.errors })),
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
