/**
 * Credentials health probe — exercises stored Gmail OAuth grants nightly.
 *
 * For every `email_accounts` row with provider='google', attempts a real
 * token refresh against Google's OAuth endpoint using the stored
 * (encrypted) refresh token. Verdicts:
 *   healthy   — refresh succeeded, access token minted
 *   revoked   — Google rejected the grant (revoked / password change /
 *               app uninstalled) → user must reconnect
 *   unverified— no stored grant, or refresh endpoint misconfigured
 *   error     — network/unknown failure (not attributed to the grant)
 *
 * Results persist to `email_accounts.health_*` columns (already used by
 * the deliverability health system) and drive the settings card:
 * a revoked grant shows a red "Reconnect required" state with a
 * reconnect button.
 */

import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/services/email/crypto";

export type GrantVerdict = "healthy" | "revoked" | "unverified" | "error";

export interface AccountGrantStatus {
  account_id: string;
  email: string;
  verdict: GrantVerdict;
  detail: string;
  checked_at: string;
}

function sp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Attempt a real token refresh; classify Google's response. */
export async function probeGrant(
  encryptedRefreshToken: string | null
): Promise<{ verdict: GrantVerdict; detail: string }> {
  if (!encryptedRefreshToken) {
    return { verdict: "unverified", detail: "no stored refresh token" };
  }
  let clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { verdict: "error", detail: "GOOGLE_CLIENT_ID/SECRET not configured" };
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(encryptedRefreshToken);
  } catch {
    return { verdict: "error", detail: "stored token failed to decrypt" };
  }
  if (!refreshToken) {
    return { verdict: "unverified", detail: "empty stored refresh token" };
  }

  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (resp.ok) {
      return { verdict: "healthy", detail: "refresh token exercised successfully" };
    }
    const bodyText = (await resp.text()).slice(0, 200);
    // Google signals a dead grant with 400 + one of these errors:
    // invalid_grant (revoked/expired), unauthorized_client.
    if (/invalid_grant|unauthorized_client/.test(bodyText)) {
      return { verdict: "revoked", detail: "grant rejected by Google — reconnect required" };
    }
    return { verdict: "error", detail: `google ${resp.status}: ${bodyText}` };
  } catch (err) {
    return { verdict: "error", detail: `network: ${(err as Error).message.slice(0, 120)}` };
  }
}

/** Probe every Google account; persist verdicts. Returns per-account status. */
export async function runCredentialHealthProbe(): Promise<{
  results: AccountGrantStatus[];
  summary: { healthy: number; revoked: number; unverified: number; error: number };
}> {
  const client = sp();
  const { data: accounts, error } = await client
    .from("email_accounts")
    .select("id, email_address, refresh_token, user_id")
    .eq("provider", "google")
    .eq("is_active", true);

  if (error) throw new Error(`failed to load google accounts: ${error.message}`);

  const results: AccountGrantStatus[] = [];
  const summary = { healthy: 0, revoked: 0, unverified: 0, error: 0 };
  const now = new Date().toISOString();

  for (const acct of accounts || []) {
    const { verdict, detail } = await probeGrant(acct.refresh_token);
    summary[verdict]++;

    // Persist to the health columns the settings card already reads.
    // Map grant verdicts onto health_status so the UI shows reconnect state.
    const healthStatus =
      verdict === "healthy" ? "healthy" : verdict === "revoked" ? "reconnect_required" : "unverified";
    await client
      .from("email_accounts")
      .update({
        health_status: healthStatus,
        health_last_checked_at: now,
        // Warmup/deliverability health uses health_score; grant health does
        // not overwrite it — status only.
      })
      .eq("id", acct.id);

    results.push({
      account_id: acct.id,
      email: acct.email_address,
      verdict,
      detail,
      checked_at: now,
    });
  }

  // Record the probe run for observability (surfaced in /admin/intelligence).
  await client.from("background_jobs").insert({
    job_type: "credential_health",
    status: summary.revoked > 0 ? "failed" : "completed",
    input: { accounts: (accounts || []).length },
    output: { summary, revoked: results.filter((r) => r.verdict === "revoked").map((r) => r.email) },
    started_at: now,
    completed_at: new Date().toISOString(),
  });

  return { results, summary };
}
