// =============================================
// Integration status
// =============================================
// One honest answer to "is this wired up?" for the demo and for Settings.
// It reports configuration only — it deliberately does not perform a live send
// or a Stripe charge, so calling it cannot spend money or deliver email.
//
// `configured` means the credential is present. `ready` is the stricter claim
// the UI should gate on: credentials present AND (where relevant) an account
// row exists.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const present = (...keys: string[]) => keys.every((k) => !!process.env[k]);

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();

  const [accounts, sent, queue] = await Promise.all([
    sp
      .from("email_accounts")
      .select("id, provider, email_address, is_active, token_expires_at")
      .eq("user_id", user.id)
      .eq("is_active", true),
    sp
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("direction", "outbound")
      .eq("status", "sent"),
    sp
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "queued_dev"),
  ]);

  const emailAccounts = accounts.data ?? [];
  const emailConfigured =
    present("SMTP_HOST", "SMTP_USER", "SMTP_PASS") ||
    present("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") ||
    present("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET");

  const stripeConfigured = present("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET");
  const stripeMode = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_")
    ? "live"
    : process.env.STRIPE_SECRET_KEY
      ? "test"
      : "unconfigured";

  const posthogConfigured = present("NEXT_PUBLIC_POSTHOG_KEY");

  return NextResponse.json(
    {
      email: {
        // Credentials alone are not enough: a send needs an account row.
        configured: emailConfigured,
        ready: emailConfigured && emailAccounts.length > 0,
        accounts: emailAccounts.map((a) => ({
          provider: a.provider,
          address: a.email_address,
          active: a.is_active,
        })),
        sentCount: sent.count ?? 0,
        outboxCount: queue.count ?? 0,
        outboxEnabled: process.env.EMAIL_PROVIDER === "outbox",
        missing:
          emailAccounts.length === 0
            ? ["A connected sending account (SMTP credentials or Google/Microsoft OAuth)"]
            : [],
      },
      stripe: {
        configured: stripeConfigured,
        ready: stripeConfigured,
        mode: stripeMode,
        missing: stripeConfigured
          ? []
          : ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "price IDs"],
      },
      posthog: {
        configured: posthogConfigured,
        ready: posthogConfigured,
        missing: posthogConfigured ? [] : ["NEXT_PUBLIC_POSTHOG_KEY"],
      },
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
