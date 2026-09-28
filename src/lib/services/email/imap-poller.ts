/**
 * IMAP inbox polling — reply/bounce/complaint detection for app-password
 * email accounts (the `custom_smtp` provider path).
 *
 * The reply-poller previously only supported Gmail/Microsoft OAuth accounts,
 * so SMTP accounts could send but never detect replies — the outreach loop
 * silently dead-ended. This module reads the INBOX over IMAP (schema columns
 * imap_host/port/user/pass_encrypted already existed, unwired) and reuses
 * processReply() for classification, threading and suppression handling.
 */

import { ImapFlow } from "imapflow";
import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto";
import { processReply } from "./reply-poller";

export interface ImapPollResult {
  accountId: string;
  provider: string;
  emailsChecked: number;
  repliesDetected: number;
  errors: string[];
}

interface IncomingEmail {
  id: string;
  from: string;
  subject: string;
  bodyPreview: string;
  date: string;
  inReplyTo: string | null;
  messageId: string;
}

export async function pollImapAccount(account: Record<string, any>): Promise<ImapPollResult> {
  const result: ImapPollResult = {
    accountId: account.id,
    provider: account.provider || "custom_smtp",
    emailsChecked: 0,
    repliesDetected: 0,
    errors: [],
  };

  const host = account.imap_host || "imap.gmail.com";
  const port = account.imap_port || 993;
  const user = account.imap_user || account.smtp_user || account.email_address;
  const encPass = account.imap_pass_encrypted || account.smtp_pass_encrypted;
  if (!encPass) {
    result.errors.push("No IMAP password stored");
    return result;
  }

  let password: string;
  try {
    password = decryptToken(encPass);
  } catch {
    result.errors.push("Failed to decrypt IMAP password — re-save the account");
    return result;
  }

  const client = new ImapFlow({
    host,
    port,
    secure: account.imap_secure !== false,
    auth: { user, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Window: last 24h, newest 25 messages (same window as the OAuth poller)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const uids = await client.search({ since });
      const recent = (uids || []).slice(-25);

      for (const uid of recent) {
        const msg: Awaited<ReturnType<typeof client.fetchOne>> = await client.fetchOne(String(uid), { envelope: true, source: true, uid: true });
        const m = msg && typeof msg === "object" ? msg : null;
        if (!m || !m.envelope || !m.source) continue;

        const env = m.envelope;
        const headers = parseHeaders(m.source);
        result.emailsChecked++;

        const incoming: IncomingEmail = {
          id: String(uid),
          from: env.from?.map((a) => `${a.name || ""} <${a.address || ""}>`).join(", ") || "",
          subject: env.subject || "",
          // First 500 chars of the decoded text body is enough for the
          // classifier (sentiment, bounce and complaint detection).
          bodyPreview: extractTextPreview(m.source),
          date: (env.date ? new Date(env.date) : new Date()).toISOString(),
          inReplyTo: headers["in-reply-to"] || null,
          messageId: headers["message-id"] || `${host}-${uid}-${m.uid}`,
        };

        const wasReply = await processReply(incoming, String(account.user_id), null, String(account.id));
        if (wasReply) result.repliesDetected++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    result.errors.push(String((err as Error).message || err).slice(0, 200));
  }

  return result;
}

function parseHeaders(source: Buffer): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerEnd = source.indexOf("\r\n\r\n");
  const headerBlock = source.subarray(0, headerEnd > 0 ? headerEnd : Math.min(source.length, 4000)).toString("utf8");
  for (const line of headerBlock.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }
  return headers;
}

function extractTextPreview(source: Buffer): string {
  const raw = source.toString("utf8");
  // Prefer the plain-text part; fall back to a stripped HTML body
  const textMatch = raw.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n[A-Z]|$)/i);
  let body = textMatch?.[1];
  if (!body) {
    const htmlMatch = raw.match(/Content-Type: text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|$)/i);
    body = htmlMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
  return (body || "").replace(/=[A-F0-9]{2}/gi, "").trim().slice(0, 500);
}

/**
 * Poll all active IMAP-capable accounts (provider custom_smtp with an
 * encrypted password). Used by the cron and admin triggers alongside the
 * OAuth poller.
 */
export async function pollImapAccounts(userId?: string): Promise<ImapPollResult[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let q = db
    .from("email_accounts")
    .select("*")
    .eq("is_active", true)
    .eq("provider", "custom_smtp")
    .not("smtp_pass_encrypted", "is", null);
  if (userId) q = q.eq("user_id", userId);

  const { data: accounts, error } = await q;
  if (error) return [{ accountId: "-", provider: "imap", emailsChecked: 0, repliesDetected: 0, errors: [error.message] }];

  const results: ImapPollResult[] = [];
  for (const account of accounts || []) {
    const result = await pollImapAccount(account);
    if (result.errors.length === 0) {
      await db.from("email_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", account.id);
    }
    results.push(result);
  }
  return results;
}
