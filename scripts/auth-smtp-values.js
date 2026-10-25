#!/usr/bin/env node
/**
 * Auth SMTP helper for Supabase.
 *
 *   node scripts/auth-smtp-values.js            -> prints paste-ready dashboard values
 *   node scripts/auth-smtp-values.js --verify   -> end-to-end verify (live SMTP probe +
 *                                                  reset-email request + auth log guidance)
 *
 * Values come from .env.local: SMTP_HOST, SMTP_PORT, SMTP_USER, EMAIL_FROM.
 * The app-password itself is NOT stored in env (by design) — you paste it
 * straight into the dashboard when generating it.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const user = process.env.SMTP_USER || process.env.EMAIL_FROM || "";
const from = process.env.EMAIL_FROM || user;
const [namePart, addrPart] = from.includes("<") ? from.split(/<|>/).map((s) => s.trim()) : ["Capital OS", from];
const senderName = namePart || "Capital OS";
const senderEmail = (addrPart || from).replace(/^"?"|"?$/g, "");

if (process.argv.includes("--await-inbox")) {
  runWatchdog().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
} else if (process.argv.includes("--verify")) {
  runVerify().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
} else {
  printValues();
}

function printValues() {
  const appUrl = "https://capital-os-nine.vercel.app";
  console.log("============================================================");
  console.log(" Supabase Dashboard -> Project Settings -> Authentication:");
  console.log("============================================================\n");
  console.log("[SMTP Settings]  -> toggle 'Enable Custom SMTP' ON\n");
  console.log("  Sender name:     " + senderName);
  console.log("  Sender email:    " + senderEmail);
  console.log("  Host:            " + host);
  console.log("  Port:            " + port + "   (STARTTLS)");
  console.log("  Username:        " + user);
  console.log("  Password:        <16-char Gmail App Password - create at");
  console.log("                   https://myaccount.google.com/apppasswords>\n");
  console.log("Minimum interval between emails: 60 seconds (free tier, leave default)");
  console.log("");
  console.log("[URL Configuration]\n");
  console.log("  Site URL:                        " + appUrl);
  console.log("  Additional Redirect URLs (add):  " + appUrl + "/auth/callback");
  console.log("                                   http://localhost:3000/auth/callback\n");
  console.log("[Authentication -> Emails -> Templates]  (files in supabase/templates/)");
  console.log("  Reset Password:  paste supabase/templates/reset-password.html");
  console.log("  Confirm Signup:  paste supabase/templates/confirm-signup.html");
  console.log("  (or leave defaults — they work once SMTP is on)");
  console.log("");
  console.log("Gmail app-password prerequisites: 2FA enabled on the Google account.");
  console.log("Gmail caps app-password SMTP at ~500 recipients/day - fine for auth emails.");
  console.log("============================================================");
  console.log("Then verify everything: node scripts/auth-smtp-values.js --verify");
}

async function runVerify() {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) { throw new Error("Missing Supabase env vars"); }
  const sp = createClient(url, anon, { auth: { persistSession: false } });

  const argv = process.argv;
  const emailFlagIdx = argv.indexOf("--email");
  const cliEmail = emailFlagIdx !== -1 && argv[emailFlagIdx + 1] && !argv[emailFlagIdx + 1].startsWith("--")
    ? argv[emailFlagIdx + 1]
    : null;
  const targetEmail = cliEmail || process.env.TEST_ADMIN_EMAIL || process.env.SMTP_USER;
  if (!targetEmail || !targetEmail.includes("@")) {
    throw new Error("No valid target email: pass --email <addr> or set TEST_ADMIN_EMAIL/SMTP_USER");
  }

  console.log("=== Supabase Auth SMTP end-to-end verification ===\n");

  // 1. Password reset email (hits custom SMTP when enabled)
  process.stdout.write("[1/2] Triggering password-reset for " + mask(targetEmail) + "... ");
  const { error } = await sp.auth.resetPasswordForEmail(targetEmail, {
    redirectTo: "https://capital-os-nine.vercel.app/auth/callback?next=/reset-password",
  });
  if (error) {
    if (/rate limit/i.test(error.message || "")) {
      console.log("RATE LIMITED - GoTrue allows ~1 auth email per address per minute.");
      console.log("      Wait 60+ seconds and rerun, or verify with a different address (--email you@x.com).");
    } else {
      console.log("API ERROR: " + error.message);
      process.exitCode = 1;
    }
  } else {
    console.log("accepted (HTTP 200).");
  }

  // 2. Signup confirmation email (only fires for a fresh email address)
  const probe = "buffy.qa+smtpverify-" + Date.now() + "@gmail.com";
  process.stdout.write("[2/2] Triggering signup confirmation for " + mask(probe) + "... ");
  const { error: err2 } = await sp.auth.signUp({ email: probe, password: "Xk9!vR2#mQz8$" });
  if (err2) {
    if (/rate limit/i.test(err2.message || "")) {
      console.log("RATE LIMITED - wait a minute and rerun if you need the signup probe too.");
    } else {
      console.log("API ERROR: " + err2.message);
      process.exitCode = 1;
    }
  } else {
    console.log("accepted (HTTP 200).");
  }

  console.log(`
NEXT (manual, 1 minute):
  1. Check the inbox of ${mask(targetEmail)} for 'Reset your Capital OS password'
     - arrived?  -> custom SMTP works.
     - nothing?  -> Dashboard -> Authentication -> Logs. Look for 'SMTP error'
       or 'Error sending'. Common causes: wrong app password, port blocked,
       sender email not verified.
  2. Open the reset link in the email -> /reset-password page must load.
  3. Clean up: dashboard -> Authentication -> Users -> delete the
     'smtpverify' probe user (it stays unconfirmed).`);
}

function mask(e) {
  if (!e || !e.includes("@")) return e || "";
  const [a, b] = e.split("@");
  return a.slice(0, 2) + "***@" + b;
}

// ============================================================
// Watchdog mode (--await-inbox): prove auth emails physically
// arrive. TWO legs, each with its own fresh plus-alias:
//   leg "reset"  — password reset via resetPasswordForEmail
//   leg "signup" — signup confirmation via signUp
// One IMAP poll loop watches for both messages. Emits GitHub
// Actions outputs (reset_status / signup_status / failed_legs),
// optionally sweeps GoTrue logs for SMTP errors (SUPABASE_ACCESS_TOKEN),
// and routes failures into email_health_events (in-product alerting)
// when SUPABASE_SERVICE_ROLE_KEY is present.
// ============================================================

function argValue(name, dflt) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] && !String(process.argv[i + 1]).startsWith("--")
    ? process.argv[i + 1]
    : dflt;
}

function plusAlias(user, tag) {
  const at = user.lastIndexOf("@");
  return `${user.slice(0, at)}+${tag}${Date.now()}@${user.slice(at + 1)}`;
}

function emitOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    require("fs").appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(`[watchdog] output ${key}=${value}`);
}

async function imapFindArrived(client, toAddr, since) {
  const uids = await client.search({ to: toAddr, since });
  if (!uids || !uids.length) return null;
  let subject = "(unavailable)";
  try {
    const msg = await client.fetchOne(uids[uids.length - 1], { envelope: true });
    subject = msg.envelope?.subject || subject;
  } catch {}
  return { count: uids.length, subject };
}

async function pollLegs({ user, pass, host, port }, legs, deadline) {
  const { ImapFlow } = require("imapflow");
  const since = new Date(Date.now() - 20 * 60_000);
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    const pending = legs.filter((l) => l.status === "waiting");
    if (pending.length === 0) break;

    const client = new ImapFlow({
      host, port, secure: true,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
    });
    try {
      await client.connect();
      const lock = await client.getLock();
      try {
        await client.mailboxOpen("INBOX");
        for (const leg of pending) {
          const hit = await imapFindArrived(client, leg.probe, since);
          if (hit) {
            leg.status = "delivered";
            leg.subject = hit.subject;
            console.log(`[watchdog] leg "${leg.name}" DELIVERED — "${hit.subject}" (attempt ${attempt})`);
          }
        }
      } finally {
        lock.release();
        client.close();
      }
    } catch (e) {
      console.log(`[watchdog] IMAP attempt ${attempt} error: ${e.message}`);
      try { client.close(); } catch {}
    }

    const stillWaiting = legs.some((l) => l.status === "waiting");
    if (stillWaiting && Date.now() < deadline) {
      console.log(`[watchdog] waiting on legs: ${legs.filter((l) => l.status === "waiting").map((l) => l.name).join(", ")} — retrying in 30s (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
  for (const leg of legs) {
    if (leg.status === "waiting") leg.status = "timeout";
  }
}

// Best-effort GoTrue log sweep via the Management API (needs a PAT).
// Returns a short human summary or null when unavailable.
async function sweepAuthLogs() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!token || !ref) return null;
  try {
    const url = `https://api.supabase.com/v1/projects/${ref[1]}/logs?source=supabase_auth_admin` +
      `&sql=` + encodeURIComponent(
        `select timestamp, log_attributes['error'] as err, log_attributes['msg'] as msg ` +
        `from logs where source='supabase_auth_admin' ` +
        `and timestamp > now() - interval '30 minutes' ` +
        `and (log_attributes['error'] is not null or log_attributes['msg'] ilike '%smtp%') limit 20`
      );
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return `log sweep unavailable (HTTP ${res.status})`;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return "no SMTP/auth errors in the last 30 minutes";
    const errs = rows.slice(0, 5).map((r) => `  - ${String(r.err || r.msg || "").slice(0, 160)}`);
    return `${rows.length} recent auth log entries with errors/SMTP mentions:\n${errs.join("\n")}`;
  } catch (e) {
    return `log sweep failed: ${e.message}`;
  }
}

// Route the outcome into the in-product Email Health timeline.
// Requires SUPABASE_SERVICE_ROLE_KEY; targets HEALTH_ALERT_USER_ID or the
// oldest confirmed user (the founder account).
async function routeToProductAlert(failedLegs) {
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) return "skipped (SUPABASE_SERVICE_ROLE_KEY not set)";
  try {
    const { createClient } = require("@supabase/supabase-js");
    const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, svcKey);
    let userId = process.env.HEALTH_ALERT_USER_ID;
    if (!userId) {
      const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 50 });
      const confirmed = (data?.users || []).filter((u) => u.email_confirmed_at)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      userId = confirmed[0]?.id;
    }
    if (!userId) return "skipped (no confirmed user found)";
    const { error } = await svc.from("email_health_events").insert({
      user_id: userId,
      event_type: failedLegs.length ? "auth_deliverability_failed" : "auth_deliverability_recovered",
      severity: failedLegs.length ? "critical" : "info",
      details: {
        source: "smtp_watchdog",
        failed_legs: failedLegs,
        checked_at: new Date().toISOString(),
      },
      metadata: { actor: "github_actions_watchdog" },
    });
    if (error) return "insert failed: " + error.message;
    return failedLegs.length
      ? `critical event logged to email_health_events (user ${userId.slice(0, 8)}…)`
      : `recovery event logged to email_health_events (user ${userId.slice(0, 8)}…)`;
  } catch (e) {
    return "routing error: " + e.message;
  }
}

async function runWatchdog() {
  const user = process.env.WATCHDOG_EMAIL_USER;
  const pass = process.env.WATCHDOG_EMAIL_PASS;
  const host = process.env.WATCHDOG_IMAP_HOST || "imap.gmail.com";
  const port = parseInt(process.env.WATCHDOG_IMAP_PORT || "993", 10);
  const timeoutMin = parseInt(argValue("--timeout-min", process.env.WATCHDOG_TIMEOUT_MIN || "5"), 10);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
  const skipSignup = process.argv.includes("--skip-signup");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[watchdog] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not configured");
    process.exit(1);
  }
  if (!user || !pass) {
    console.error("[watchdog] WATCHDOG_EMAIL_USER and WATCHDOG_EMAIL_PASS are required (IMAP inbox credentials)");
    process.exit(1);
  }

  const { createClient } = require("@supabase/supabase-js");
  const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });

  const legs = [];

  // ── Leg 1: password reset ──
  const resetProbe = plusAlias(user, "wdr");
  process.stdout.write(`[watchdog] leg "reset": triggering reset for ${resetProbe}... `);
  const { error: errReset } = await sp.auth.resetPasswordForEmail(resetProbe, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });
  if (errReset) {
    console.log("TRIGGER FAILED: " + errReset.message);
    emitOutput("reset_status", "trigger_failed");
    emitOutput("failed_legs", "reset");
    console.error("[watchdog] cannot continue without a successful reset trigger");
    process.exit(1);
  }
  console.log("accepted");
  legs.push({ name: "reset", probe: resetProbe, status: "waiting", subject: null });

  // ── Leg 2: signup confirmation ──
  if (!skipSignup) {
    const signupProbe = plusAlias(user, "wds");
    process.stdout.write(`[watchdog] leg "signup": triggering signup for ${signupProbe}... `);
    const { error: errSignup } = await sp.auth.signUp({ email: signupProbe, password: "Xk9!vR2#mQz8$" });
    if (errSignup && !/rate limit/i.test(errSignup.message || "")) {
      console.log("TRIGGER FAILED: " + errSignup.message);
      legs.push({ name: "signup", probe: null, status: "trigger_failed", subject: null });
    } else {
      console.log(errSignup ? "RATE LIMITED (leg will report timeout)" : "accepted");
      legs.push({ name: "signup", probe: errSignup ? null : signupProbe, status: errSignup ? "trigger_failed" : "waiting", subject: null });
    }
  }

  console.log(`[watchdog] inbox: ${host}:${port} for ${mask(user)} | timeout: ${timeoutMin} min`);
  const deadline = Date.now() + timeoutMin * 60_000;
  await pollLegs({ user, pass, host, port }, legs, deadline);

  // ── Results ──
  const failed = [];
  for (const leg of legs) {
    emitOutput(`${leg.name}_status`, leg.status);
    if (leg.status === "delivered") {
      console.log(`[watchdog] leg "${leg.name}": ✓ delivered ("${leg.subject}")`);
    } else {
      failed.push(leg.name + "(" + leg.status + ")");
      console.log(`[watchdog] leg "${leg.name}": ✗ ${leg.status}`);
    }
  }
  emitOutput("failed_legs", failed.join(",") || "none");

  const logSummary = await sweepAuthLogs();
  if (logSummary) console.log("[watchdog] GoTrue log sweep: " + logSummary.replace(/\n/g, "\n   "));

  const routing = await routeToProductAlert(failed);
  console.log("[watchdog] in-product alert: " + routing);

  if (failed.length) {
    console.error(`[watchdog] RESULT: FAILING LEGS -> ${failed.join(", ")}`);
    console.error(`[watchdog] triage: 1) Supabase Auth SMTP settings 2) Auth logs: ${logSummary || "(no PAT — set SUPABASE_ACCESS_TOKEN for automatic sweep)"} 3) Gmail sender app-password/quota`);
    process.exit(1);
  }
  console.log("[watchdog] RESULT: all legs delivered — auth email deliverability is healthy");
  process.exit(0);
}
