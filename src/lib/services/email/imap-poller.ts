/**
 * IMAP inbox polling — reply/bounce/complaint detection for app-password
 * email accounts (the `custom_smtp` provider path).
 *
 * The reply-poller previously only supported Gmail/Microsoft OAuth accounts,
 * so SMTP accounts could send but never detect replies — the outreach loop
 * silently dead-ended. This module reads the INBOX over IMAP (schema columns
 * imap_host/port/user/pass_encrypted already existed, unwired) and reuses
 * processReply() for classification, threading and suppression handling.
 *
 * Message parsing uses mailparser's simpleParser (robust RFC822 handling:
 * folded headers, encoded-words, MIME multipart) rather than regex slicing,
 * which broke on Gmail's folded Message-ID/In-Reply-To headers — exactly the
 * headers threading depends on.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
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
    provider: typeof account.provider === "string" && account.provider ? account.provider : "custom_smtp",
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
        const msg = await client.fetchOne(String(uid), { envelope: true, source: true, uid: true });
        if (!msg || !msg.source) continue;

        // simpleParser handles folded headers + encoded-words: Message-ID and
        // In-Reply-To come back unwrapped exactly as they were generated, so
        // the In-Reply-To → email_messages.message_id thread lookup matches.
        const parsed = await simpleParser(msg.source);

        const fromText =
          parsed.from?.text ||
          (parsed.from?.value || []).map((a) => `${a.name || ""} <${a.address || ""}>`).join(", ");

        result.emailsChecked++;

        const incoming: IncomingEmail = {
          id: String(msg.uid ?? uid),
          from: fromText || "",
          subject: parsed.subject || "",
          // First 500 chars of the decoded text body is enough for the
          // classifier (sentiment, bounce and complaint detection).
          bodyPreview: extractTextPreview(parsed),
          date: (parsed.date ? new Date(parsed.date) : new Date()).toISOString(),
          inReplyTo: parsed.inReplyTo || null,
          messageId: parsed.messageId || `imap-${host}-${msg.uid ?? uid}`,
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

function extractTextPreview(parsed: Awaited<ReturnType<typeof simpleParser>>): string {
  if (parsed.text) return parsed.text.replace(/\s+/g, " ").trim().slice(0, 500);

  if (parsed.html) {
    const html = String(parsed.html);
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
  }

  return "";
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
  if (error)
    return [
      { accountId: "-", provider: "imap", emailsChecked: 0, repliesDetected: 0, errors: [error.message] },
    ];

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
