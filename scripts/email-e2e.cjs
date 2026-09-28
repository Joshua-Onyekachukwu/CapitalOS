#!/usr/bin/env node
/**
 * SMTP E2E — live send + reply-detection cycle.
 *
 * Drives the full outreach email loop against the production database:
 *   1. verify  — SMTP auth + connection check (nodemailer verify)
 *   2. full    — send a real email to the QA founder address, seed the
 *                `email_accounts` row (password encrypted with
 *                EMAIL_TOKEN_ENCRYPTION_KEY, same format as crypto.ts),
 *                send a threaded reply carrying In-Reply-To, trigger the
 *                deployed cron poller, then assert the inbound
 *                email_messages row, thread match and reply status.
 *   3. cleanup — remove the seeded thread/messages/account (optional)
 *
 * Usage:
 *   node scripts/email-e2e.cjs verify
 *   node scripts/email-e2e.cjs full
 *   node scripts/email-e2e.cjs cleanup
 *
 * Env (from .env.local): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * EMAIL_TOKEN_ENCRYPTION_KEY, CRON_SECRET, FOUNDER_USER_ID (optional),
 * E2E_RECIPIENT (optional).
 */

require("dotenv").config({ path: ".env.local" });
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const QA_EMAIL = process.env.E2E_RECIPIENT || "buffy.qa+prod-e2e-20260927@gmail.com";
const FOUNDER_ID =
  process.env.FOUNDER_USER_ID || "486e84f9-a184-410f-97f3-75888e14ce2b";
const CRON_URL = process.env.E2E_CRON_URL || "https://capital-os-nine.vercel.app/api/cron/daily";

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

function assertEnv() {
  const missing = [
    ["SMTP_USER", SMTP_USER],
    ["SMTP_PASS", SMTP_PASS],
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    fail(`Missing env: ${missing.join(", ")} (check .env.local)`);
    process.exit(1);
  }
}

function transporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// Mirrors src/lib/services/email/crypto.ts encryptToken (AES-256-GCM iv:tag:hex)
function encryptToken(plaintext) {
  const keyHex = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  const key =
    keyHex && Buffer.from(keyHex, "hex").length === 32
      ? Buffer.from(keyHex, "hex")
      : crypto
          .createHash("sha256")
          .update(keyHex || process.env.NEXT_PUBLIC_SUPABASE_URL || "capital-os-default-key")
          .digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(plaintext, "utf8", "hex");
  enc += cipher.final("hex");
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc}`;
}

async function smtpVerify() {
  step(1, `SMTP verify ${SMTP_USER} → ${SMTP_HOST}:${SMTP_PORT}`);
  try {
    await transporter().verify();
    ok(`Authenticated — ${SMTP_USER} can send via ${SMTP_HOST}`);
    return true;
  } catch (err) {
    fail(`SMTP auth failed: ${err.message}`);
    return false;
  }
}

async function ensureEmailAccount() {
  step(2, "Seed email_accounts row (custom_smtp + IMAP, encrypted password)");
  const enc = encryptToken(SMTP_PASS);
  const row = {
    user_id: FOUNDER_ID,
    provider: "custom_smtp",
    email_address: SMTP_USER,
    display_name: "Capital OS E2E",
    smtp_host: SMTP_HOST,
    smtp_port: SMTP_PORT,
    smtp_user: SMTP_USER,
    smtp_pass_encrypted: enc,
    smtp_secure: SMTP_PORT === 465,
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_user: SMTP_USER,
    imap_pass_encrypted: enc,
    imap_secure: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db
    .from("email_accounts")
    .select("id")
    .eq("user_id", FOUNDER_ID)
    .eq("email_address", SMTP_USER)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("email_accounts").update(row).eq("id", existing.id);
    if (error) return fail(`account update: ${error.message}`);
    ok(`updated account ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await db.from("email_accounts").insert(row).select("id").single();
  if (error) return fail(`account insert: ${error.message}`);
  ok(`created account ${data.id}`);
  return data.id;
}

async function ensureThread(ts) {
  step(3, "Ensure email_threads row for thread-match fallback");
  const subject = `Capital OS — E2E thread ${ts}`;
  const { data: existing } = await db
    .from("email_threads")
    .select("id")
    .eq("user_id", FOUNDER_ID)
    .eq("subject", subject)
    .maybeSingle();
  if (existing) {
    ok(`thread exists ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await db
    .from("email_threads")
    .insert({ user_id: FOUNDER_ID, subject, status: "active", message_count: 0 })
    .select("id")
    .single();
  if (error) return fail(`thread insert: ${error.message}`);
  ok(`thread created ${data.id}`);
  return data.id;
}

async function seedOutboundMessage(threadId, messageId, subject, ts) {
  // processReply threads by In-Reply-To → email_messages.message_id, so the
  // original send must exist there with its Message-ID.
  const { error } = await db.from("email_messages").insert({
    user_id: FOUNDER_ID,
    thread_id: threadId,
    message_id: messageId,
    direction: "outbound",
    from_address: SMTP_USER,
    to_address: QA_EMAIL,
    subject,
    body_text: "E2E outreach seed — safe to ignore.",
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  if (error) fail(`outbound seed: ${error.message}`);
  else ok(`outbound message seeded (${messageId})`);
}

async function triggerCron() {
  step(6, `Trigger deployed poller: GET ${CRON_URL}`);
  const resp = await fetch(CRON_URL, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const text = await resp.text();
  if (resp.status !== 200) {
    fail(`cron returned ${resp.status}: ${text.slice(0, 400)}`);
    return null;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    ok(`cron 200 (non-JSON): ${text.slice(0, 200)}`);
    return null;
  }
  ok(
    `cron 200 — accountsPolled=${json.accountsPolled} checked=${json.emailsChecked} ` +
      `replies=${json.repliesDetected} errors=${json.accountErrors ?? 0}`
  );
  if (json.accountErrorDetails?.length)
    console.log(`  accountErrorDetails: ${JSON.stringify(json.accountErrorDetails).slice(0, 400)}`);
  return json;
}

async function assertReply(threadId, replyMessageId) {
  step(7, "Assert inbound email_messages row + thread match + reply status");
  const { data: msgs, error } = await db
    .from("email_messages")
    .select("id, direction, status, thread_id, from_address, subject, replied_at")
    .eq("message_id", replyMessageId);
  if (error) return fail(`query: ${error.message}`);
  const inbound = (msgs || []).find((m) => m.direction === "inbound");
  if (!inbound) {
    fail(`no inbound row for Message-ID ${replyMessageId} — poller did not record the reply`);
    return;
  }
  ok(`inbound row ${inbound.id} status=${inbound.status} from=${inbound.from_address}`);
  if (inbound.thread_id !== threadId) fail(`thread mismatch: ${inbound.thread_id} ≠ ${threadId}`);
  else ok("thread matched via In-Reply-To");
  if (inbound.status !== "replied") fail(`status=${inbound.status}, expected 'replied'`);
  else ok("reply recorded (replied_at set)");

  const { data: thread } = await db
    .from("email_threads")
    .select("status, message_count, last_message_preview")
    .eq("id", threadId)
    .single();
  if (thread) {
    ok(`thread status=${thread.status} message_count=${thread.message_count}`);
    if (thread.status !== "meeting_requested")
      console.log(`  ⚠️ thread status '${thread.status}' (sentiment keyword may not have matched)`);
  }

  const { data: acct } = await db
    .from("email_accounts")
    .select("last_synced_at")
    .eq("user_id", FOUNDER_ID)
    .eq("email_address", SMTP_USER)
    .maybeSingle();
  if (acct?.last_synced_at) ok(`account last_synced_at=${acct.last_synced_at}`);
}

async function full() {
  assertEnv();
  const ts = Date.now();

  if (!(await smtpVerify())) {
    console.error("\nE2E aborted — fix SMTP credentials first.");
    process.exit(1);
  }

  const accountId = await ensureEmailAccount();
  if (!accountId) process.exit(1);

  const threadId = await ensureThread(ts);
  if (!threadId) process.exit(1);

  const subject = `Capital OS — E2E thread ${ts}`;
  const origMessageId = `<e2e-orig-${ts}@capital-os.local>`;

  step(4, `Send REAL email ${SMTP_USER} → ${QA_EMAIL}`);
  try {
    const info = await transporter().sendMail({
      from: SMTP_USER,
      to: QA_EMAIL,
      subject,
      text: "Capital OS end-to-end outreach test. This is the original send; the next message replies to it.",
      headers: { "Message-ID": origMessageId },
    });
    ok(`sent — accepted: ${(info.accepted || []).join(", ") || QA_EMAIL}`);
  } catch (err) {
    fail(`send failed: ${err.message}`);
    process.exit(1);
  }
  await db
    .from("email_accounts")
    .update({ last_test_sent_at: new Date().toISOString(), test_recipient: QA_EMAIL })
    .eq("id", accountId);
  await seedOutboundMessage(threadId, origMessageId, subject, ts);

  step(5, "Send REAL threaded reply (In-Reply-To → original Message-ID)");
  let replyMessageId;
  try {
    const info = await transporter().sendMail({
      from: SMTP_USER,
      to: QA_EMAIL,
      subject: `Re: ${subject}`,
      text: "Interested — let's schedule a meeting this week to walk through the deck.",
      inReplyTo: origMessageId,
      references: origMessageId,
    });
    replyMessageId = info.messageId;
    ok(`reply sent — Message-ID ${replyMessageId}`);
  } catch (err) {
    fail(`reply send failed: ${err.message}`);
    process.exit(1);
  }

  await triggerCron();
  await assertReply(threadId, replyMessageId);

  console.log("\n—— E2E summary ——");
  console.log(`account: ${accountId}\nthread: ${threadId}\nreply Message-ID: ${replyMessageId}`);
  console.log(process.exitCode ? "RESULT: FAILED ❌" : "RESULT: PASSED ✅");
}

async function verifyOnly() {
  assertEnv();
  await smtpVerify();
}

async function cleanup() {
  assertEnv();
  step(1, "Remove E2E artifacts (thread, messages, account)");
  const { data: threads } = await db
    .from("email_threads")
    .select("id")
    .eq("user_id", FOUNDER_ID)
    .like("subject", "Capital OS — E2E thread %");
  for (const t of threads || []) {
    await db.from("email_messages").delete().eq("thread_id", t.id);
    await db.from("email_threads").delete().eq("id", t.id);
  }
  ok(`removed ${(threads || []).length} E2E thread(s)`);
  const { data: acct } = await db
    .from("email_accounts")
    .select("id")
    .eq("user_id", FOUNDER_ID)
    .eq("email_address", SMTP_USER)
    .maybeSingle();
  if (acct) {
    await db.from("email_accounts").delete().eq("id", acct.id);
    ok(`removed account ${acct.id}`);
  }
}

const cmd = process.argv[2] || "full";
(assertEnv(), cmd === "verify" ? verifyOnly() : cmd === "cleanup" ? cleanup() : full()).catch(
  (err) => {
    fail(err.message);
    process.exit(1);
  }
);
