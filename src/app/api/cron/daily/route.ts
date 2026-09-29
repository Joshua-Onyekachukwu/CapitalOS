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
import { runEdgarReverification } from "@/lib/services/investor/edgar-reverify";
import { runCredentialHealthProbe } from "@/lib/services/email/credential-health";
import { runSnapshotExport } from "@/lib/services/investor/snapshot-archive";
import { runQualificationPass } from "@/lib/services/investor/qualification-tiers";

// The chain includes up to ~60 paced SEC fetches (EDGAR re-verification) and
// a full-dataset snapshot upload — 300s covers worst case; typical run ~60s.
export const maxDuration = 300;

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

    // Monthly EDGAR re-verification (cadence enforced inside the service).
    // Batch is sized so the whole cron chain fits the function window;
    // already-rechecked rows get a fresh last_verified_at and sort to the
    // back, so the next day's run resumes where this one left off.
    const edgar = await runEdgarReverification({ limit: 60 });

    // Qualification tiers re-stamped daily (cheap: pure compute + bulk
    // updates) so evidence freshness never drifts from reality.
    const qualification = await runQualificationPass();

    // Daily JSONL snapshot to Supabase Storage (idempotent per day) — runs
    // last so the archive captures this run's stamps.
    const snapshot = await runSnapshotExport();

    // Credentials-health probe: exercise every stored Gmail refresh token
    // so revoked grants are detected nightly (settings card shows the
    // reconnect state; failures surface in background_jobs).
    const grantProbe = await runCredentialHealthProbe();

    console.log(
      `[cron/daily] polled ${allResults.length} accounts, ${totalChecked} checked, ${totalReplies} replies, ` +
      `${errors.length} account errors, apollo=${apollo.status} ` +
      `(matched=${apollo.matched}/emails=${apollo.emailsFound}), edgar=${edgar.status} ` +
      `(rechecked=${edgar.rechecked}/refreshed=${edgar.filingsRefreshed}/drift=${edgar.sicDrift}), ` +
      `qualification=${qualification.status} (verified=${qualification.tierCounts.verified}/derived=${qualification.tierCounts.derived}/up=${qualification.upgrades}/down=${qualification.downgrades}), ` +
      `snapshot=${snapshot.status} (${snapshot.rows} rows), ` +
      `grants=${grantProbe.summary.healthy}h/${grantProbe.summary.revoked}r/${grantProbe.summary.unverified}u/${grantProbe.summary.error}e, ${Date.now() - startedAt}ms`
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
      edgarReverification: edgar,
      qualification: qualification,
      snapshot: snapshot,
      grantHealth: grantProbe.summary,
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
