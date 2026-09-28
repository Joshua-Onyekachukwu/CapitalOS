#!/usr/bin/env node
/**
 * Email E2E — OAuth (XOAUTH2) edition.
 *
 * Full outreach loop against the production DB using the user's connected
 * Google account (email_accounts.provider='google') instead of the dead
 * app-password path:
 *   1. verify  — refresh the stored token, verify SMTP XOAUTH2 auth
 *   2. full    — send a real email from the user's Gmail, seed the thread +
 *                outbound message, send a threaded reply (In-Reply-To),
 *                trigger the deployed cron poller, assert the inbound row
 *   3. cleanup — remove E2E thread/messages
 *
 * Usage: node scripts/email-e2e-oauth.cjs [verify|full|cleanup]
 */

require("dotenv").config({ path: ".env.local" });
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const PROD = process.env.E2E_CRON_URL || "https://capital-os-nine.vercel.app";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
const ok = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => {
  console.error(`  ❌ ${msg}`);
  process.exitCode = 1;
};

// Mirrors src/lib/services/email/crypto.ts decryptToken
function decryptToken(enc) {
  const parts = String(enc).split(":");
  if (parts.length !== 3) throw new Error("bad encrypted format");
  const keyHex = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  const key =
    keyHex && Buffer.from(keyHex, "hex").length === 32
      ? Buffer.from(keyHex, "hex")
      : crypto
          .createHash("sha256")
          .update(keyHex || process.env.NEXT_PUBLIC_SUPABASE_URL || "capital-os-default-key")
          .digest();
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[0], "hex"));
  d.setAuthTag(Buffer.from(parts[1], "hex"));
  return Buffer.concat([d.update(Buffer.from(parts[2], "hex")), d.final()]).toString("utf8");
}

async function loadGoogleAccount() {
  const { data: accounts, error } = await db
    .from("email_accounts")
    .select("*")
    .eq("provider", "google")
    .eq("is_active", true)
    .limit(1);
  if (error) throw new Error(`email_accounts query: ${error.message}`);
  if (!accounts || accounts.length === 0) {
    throw new Error(
      "No connected Google account. Open Settings → Connect Gmail and complete the consent flow first."
    );
  }
  return accounts[0];
}

async function refreshAccessToken(refreshToken) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error(`token refresh failed: ${resp.status} ${(await resp.text()).slice(0, 160)}`);
  const j = await resp.json();
  return j.access_token;
}

function xoauth2Transport(account, accessToken) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { type: "OAuth2", user: account.email_address, accessToken },
  });
}

async function getFreshToken() {
  step(1, "Load connected Google account + refresh token");
  const account = await loadGoogleAccount();
  ok(`account: ${account.email_address} (user ${account.user_id})`);
  if (!account.refresh_token) throw new Error("Account has no refresh token stored");
  const refreshToken = decryptToken(account.refresh_token);
  ok("refresh token decrypted");
  const accessToken = await refreshAccessToken(refreshToken);
  ok("access token refreshed");
  return { account, refreshToken };
}

async function smtpVerify() {
  const { account, refreshToken } = await getFreshToken();
  const accessToken = await refreshAccessToken(refreshToken);
  step(2, `SMTP XOAUTH2 verify ${account.email_address}`);
  try {
    await xoauth2Transport(account, accessToken).verify();
    ok(`Authenticated via XOAUTH2 — ${account.email_address} can send`);
  } catch (err) {
    fail(`XOAUTH2 auth failed: ${err.message}`);
    if (String(err.message).includes("scope")) {
      console.error("  Hint: the consent grant may predate the mail.google.com scope — reconnect Gmail in Settings.");
    }
  }
}

async function ensureThread(userId, ts) {
  const subject = `Capital OS — E2E thread ${ts}`;
  const { data, error } = await db
    .from("email_threads")
    .insert({ user_id: userId, subject, status: "active", message_count: 0 })
    .select("id")
    .single();
  if (error) throw new Error(`thread insert: ${error.message}`);
  return data.id;
}

async function triggerCron() {
  step(6, `Trigger deployed poller: GET ${PROD}/api/cron/daily`);
  const resp = await fetch(`${PROD}/api/cron/daily`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const text = await resp.text();
  if (resp.status !== 200) {
    fail(`cron returned ${resp.status}: ${text.slice(0, 300)}`);
    return;
  }
  const j = JSON.parse(text);
  ok(
    `cron 200 — accountsPolled=${j.accountsPolled} checked=${j.emailsChecked} replies=${j.repliesDetected}`
  );
}

async function assertReply(userId, threadId, replyMessageId) {
  step(7, "Assert inbound email_messages row + thread match");
  const { data: msgs } = await db
    .from("email_messages")
    .select("id, direction, status, thread_id, from_address, replied_at")
    .eq("message_id", replyMessageId);
  const inbound = (msgs || []).find((m) => m.direction === "inbound");
  if (!inbound) {
    fail(`no inbound row for ${replyMessageId} — poller did not record the reply`);
    return;
  }
  ok(`inbound row status=${inbound.status} from=${inbound.from_address}`);
  if (inbound.thread_id !== threadId) fail(`thread mismatch: ${inbound.thread_id} ≠ ${threadId}`);
  else ok("thread matched via In-Reply-To");

  const { data: acct } = await db
    .from("email_accounts")
    .select("last_synced_at")
    .eq("id", userId)
    .maybeSingle();
  if (acct?.last_synced_at) ok(`account last_synced_at=${acct.last_synced_at}`);
}

async function full() {
  const { account, refreshToken } = await getFreshToken();
  const ts = Date.now();
  const subject = `Capital OS — E2E thread ${ts}`;
  const origId = `<e2e-oauth-orig-${ts}@capital-os.local>`;
  const recipient = process.env.E2E_RECIPIENT || "buffy.qa+prod-e2e-20260927@gmail.com";

  const threadId = await ensureThread(account.user_id, ts);
  ok(`thread ${threadId}`);

  const accessToken = await refreshAccessToken(refreshToken);
  const transport = xoauth2Transport(account, accessToken);

  step(2, `Send REAL email ${account.email_address} → ${recipient}`);
  const info = await transport.sendMail({
    from: account.email_address,
    to: recipient,
    subject,
    text: "Capital OS end-to-end outreach test (OAuth path). The next message replies to this one.",
    headers: { "Message-ID": origId },
  });
  ok(`sent — accepted: ${(info.accepted || []).join(", ")}`);

  const { error: msgErr } = await db.from("email_messages").insert({
    user_id: account.user_id,
    thread_id: threadId,
    message_id: origId,
    direction: "outbound",
    from_address: account.email_address,
    to_address: recipient,
    subject,
    body_text: "E2E outreach seed (OAuth path).",
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  if (msgErr) fail(`outbound seed: ${msgErr.message}`);
  else ok(`outbound message seeded (${origId})`);

  step(3, "Send REAL threaded reply (In-Reply-To → original)");
  const accessToken2 = await refreshAccessToken(refreshToken);
  const reply = await xoauth2Transport(account, accessToken2).sendMail({
    from: account.email_address,
    to: recipient,
    subject: `Re: ${subject}`,
    text: "Interested — let's schedule a meeting this week to walk through the deck.",
    inReplyTo: origId,
    references: origId,
  });
  const replyMessageId = reply.messageId;
  ok(`reply sent — Message-ID ${replyMessageId}`);

  await triggerCron();
  await assertReply(account.user_id, threadId, replyMessageId);

  console.log("\n—— E2E summary ——");
  console.log(`thread: ${threadId}\nreply Message-ID: ${replyMessageId}`);
  console.log(process.exitCode ? "RESULT: FAILED ❌" : "RESULT: PASSED ✅");
}

async function cleanup() {
  step(1, "Remove E2E artifacts");
  const { data: threads } = await db
    .from("email_threads")
    .select("id")
    .like("subject", "Capital OS — E2E thread %");
  for (const t of threads || []) {
    await db.from("email_messages").delete().eq("thread_id", t.id);
    await db.from("email_threads").delete().eq("id", t.id);
  }
  ok(`removed ${(threads || []).length} E2E thread(s)`);
}

const cmd = process.argv[2] || "verify";
(cmd === "full" ? full() : cmd === "cleanup" ? cleanup() : smtpVerify()).catch((err) => {
  fail(err.message);
  process.exit(1);
});
