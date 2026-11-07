#!/usr/bin/env node
/**
 * End-to-end proof that a data room alert email is DELIVERED, not merely queued.
 *
 * Creates a disposable account on a plus-alias of the platform inbox, gives it a
 * data room share, opens the link once, then:
 *   1. waits for the in-app alert row to reach email_status = "sent";
 *   2. polls that inbox over IMAP until the message actually arrives.
 *
 * Everything it creates (share, access log, notifications, auth user) is removed
 * afterwards. It never touches a real user's data or the investor corpus.
 *
 * Requires ALERT_DELIVERY=1 because it sends real mail and writes to the
 * production database.
 *
 * Usage: ALERT_DELIVERY=1 node scripts/check-platform-alert-delivery.cjs
 */

require("dotenv").config({ path: ".env.e2e.local", quiet: true });
require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { ImapFlow } = require("imapflow");
const db = require("./db.cjs");

if (process.env.ALERT_DELIVERY !== "1") {
  console.error("Refusing to run: set ALERT_DELIVERY=1 (this sends real email and then cleans up).");
  process.exit(2);
}

const BASE_URL = process.env.E2E_BASE_URL || "https://capital-os-nine.vercel.app";
const SUBJECT = "Your data room link was opened";
const STATUS_TIMEOUT_MS = 90_000;
const INBOX_TIMEOUT_MS = 180_000;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase service credentials are required (.env.local).");
  process.exit(1);
}

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const inbox = {
  host: process.env.ALERT_TEST_IMAP_HOST || "imap.gmail.com",
  user: process.env.ALERT_TEST_INBOX || process.env.SMTP_USER || "",
  pass: process.env.ALERT_TEST_INBOX_PASS || process.env.SMTP_PASS || "",
};

if (!inbox.user || !inbox.pass) {
  console.error("Inbox credentials missing: set SMTP_USER and SMTP_PASS (or ALERT_TEST_INBOX / ALERT_TEST_INBOX_PASS).");
  process.exit(1);
}

const runTag = Date.now().toString(36);
const recipient = inbox.user.replace("@", `+dralert${runTag}@`);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
}

const redact = (addr) => addr.replace(/^(.).*(@.*)$/, "$1***$2");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls the notification row until the background send records an outcome. */
async function waitForEmailStatus(shareId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const rows = await db.query(
      "select id, email_status from public.data_room_notifications where share_id = $1 and kind = 'opened'",
      [shareId]
    );
    last = rows[0] || null;
    if (last && ["sent", "failed", "skipped_no_provider", "skipped_no_account"].includes(last.email_status)) {
      return last;
    }
    await sleep(3000);
  }
  return last;
}

/** Waits for the message in the inbox (or Gmail's All Mail, if it was filed away). */
async function waitForMessage({ timeoutMs }) {
  const client = new ImapFlow({
    host: inbox.host,
    port: Number(process.env.ALERT_TEST_IMAP_PORT || 993),
    secure: true,
    auth: { user: inbox.user, pass: inbox.pass },
    logger: false,
  });

  await client.connect();
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() < deadline) {
      for (const mailbox of ["INBOX", "[Gmail]/All Mail"]) {
        let lock;
        try {
          lock = await client.getMailboxLock(mailbox);
        } catch {
          continue; // mailbox not present on this server
        }
        try {
          const uids = await client.search({ to: recipient, since }, { uid: true });
          for (const uid of uids) {
            const message = await client.fetchOne(uid, { envelope: true }, { uid: true });
            const subject = message?.envelope?.subject || "";
            if (subject.includes(SUBJECT)) {
              return { mailbox, subject, receivedAt: message.envelope.date };
            }
          }
        } finally {
          lock.release();
        }
      }
      await sleep(10_000);
    }
    return null;
  } finally {
    await client.logout().catch(() => {});
  }
}

(async () => {
  let shareId = null;
  let userId = null;

  try {
    // 1. A disposable owner whose address is a real inbox, so delivery is provable.
    const { data: created, error: userError } = await sp.auth.admin.createUser({
      email: recipient,
      email_confirm: true,
      app_metadata: { source: "alert_delivery_check" },
    });
    if (userError || !created?.user) throw new Error(`could not create check account: ${userError?.message}`);
    userId = created.user.id;

    const { data: share, error: shareError } = await sp
      .from("data_room_shares")
      .insert({
        user_id: userId,
        token: crypto.randomBytes(32).toString("base64url"),
        label: "alert delivery check",
        document_ids: [],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id, token")
      .single();
    if (shareError || !share) throw new Error(`could not create share: ${shareError?.message}`);
    shareId = share.id;

    // 2. The real request an investor would make.
    const open = await fetch(`${BASE_URL}/api/data-room/${share.token}`, {
      headers: { "user-agent": "capitalos-alert-delivery-check" },
    });
    check("granted open returns 200", open.status === 200, open.status);

    // 3. The in-app alert exists and the platform sender reported success.
    const notification = await waitForEmailStatus(shareId, STATUS_TIMEOUT_MS);
    check("opened alert recorded", Boolean(notification), notification);
    check("email status is sent", notification.email_status === "sent", notification);

    // 4. The message actually reached the inbox.
    const delivered = await waitForMessage({ timeoutMs: INBOX_TIMEOUT_MS });
    check("message arrived in the inbox", Boolean(delivered), {
      recipient: redact(recipient),
      subject: SUBJECT,
      deliveredIn: delivered?.mailbox,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: BASE_URL,
          recipient: redact(recipient),
          mailbox: delivered.mailbox,
          receivedAt: delivered.receivedAt,
          checks: results,
        },
        null,
        2
      )
    );
  } finally {
    if (shareId) {
      await db.query("delete from public.data_room_notifications where share_id = $1", [shareId]).catch(() => {});
      await db.query("delete from public.data_room_access_log where share_id = $1", [shareId]).catch(() => {});
      await db.query("delete from public.data_room_shares where id = $1", [shareId]).catch(() => {});
    }
    if (userId) {
      await sp.auth.admin.deleteUser(userId).catch(() => {});
    }
    await db.close();
  }
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, checks: results, error: err.message }, null, 2));
  process.exit(1);
});
