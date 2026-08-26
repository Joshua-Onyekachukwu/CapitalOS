// =============================================
// Email Reply Poller Service
// =============================================
// Uses CockroachDB for data.

import { query } from "@/lib/db";
import { decryptToken } from "./crypto";
import { analyzeSentiment } from "./reply-detection";
import { handleBounce, handleComplaint } from "./suppression";
import { logEvent, logBounce } from "./events"

interface PollResult {
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

async function fetchGmailMessages(accessToken: string, since: Date): Promise<IncomingEmail[]> {
  const emails: IncomingEmail[] = [];
  const sinceTimestamp = Math.floor(since.getTime() / 1000);

  try {
    const searchResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${sinceTimestamp}&maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResp.ok) return emails;
    const searchData = await searchResp.json();
    const messages = searchData.messages || [];

    for (const msg of messages.slice(0, 20)) {
      try {
        const msgResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=Message-ID&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResp.ok) continue;
        const msgData = await msgResp.json();
        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        emails.push({
          id: msgData.id,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          bodyPreview: msgData.snippet || "",
          date: getHeader("Date"),
          inReplyTo: getHeader("In-Reply-To") || null,
          messageId: getHeader("Message-ID") || msgData.id,
        });
      } catch { /* Skip */ }
    }
  } catch { /* Gmail API error */ }

  return emails;
}

async function fetchMicrosoftMessages(accessToken: string, since: Date): Promise<IncomingEmail[]> {
  const emails: IncomingEmail[] = [];
  const sinceISO = since.toISOString();

  try {
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${sinceISO}&$top=20&$orderby=receivedDateTime desc`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) return emails;
    const data = await resp.json();

    for (const msg of data.value || []) {
      emails.push({
        id: msg.id,
        from: msg.from?.emailAddress?.address || "",
        subject: msg.subject || "",
        bodyPreview: msg.bodyPreview || "",
        date: msg.receivedDateTime || "",
        inReplyTo: msg.internetMessageHeaders?.find((h: any) => h.name.toLowerCase() === "in-reply-to")?.value || null,
        messageId: msg.internetMessageId || msg.id,
      });
    }
  } catch { /* Microsoft Graph API error */ }

  return emails;
}

async function processReply(email: IncomingEmail, userId: string, investorId: string | null, accountId?: string): Promise<boolean> {
  // Check if already processed
  const existing = await query<any>(
    `SELECT id FROM email_messages WHERE message_id = $1 LIMIT 1`,
    [email.messageId]
  );
  if (existing.length > 0) return false;

  // Detect bounce/NDR messages
  if (isBounceMessage(email)) {
    const bounceType = isHardBounce(email) ? "hard" : "soft";
    await handleBounce(userId, extractBouncedAddress(email), bounceType, accountId);
    await logBounce({
      userId,
      accountId,
      toAddress: extractBouncedAddress(email),
      bounceType,
      error: email.bodyPreview.slice(0, 200),
    });
    return true;
  }

  // Detect complaints
  if (isComplaintMessage(email)) {
    await handleComplaint(userId, email.from);
    await logEvent({
      userId,
      accountId,
      eventType: "complaint",
      severity: "critical",
      details: { from: email.from, subject: email.subject },
    });
    return true;
  }

  let threadId: string | null = null;
  let resolvedInvestorId = investorId;

  if (email.inReplyTo) {
    const original = await query<any>(
      `SELECT thread_id, investor_id FROM email_messages WHERE message_id = $1`,
      [email.inReplyTo]
    );
    if (original.length) {
      threadId = original[0].thread_id;
      if (!resolvedInvestorId) resolvedInvestorId = original[0].investor_id;
    }
  }

  if (!threadId) {
    const cleanSubject = email.subject.replace(/^(re:|fwd?:|fw:)\s*/i, "").trim();
    const threads = await query<any>(
      `SELECT id, investor_id FROM email_threads WHERE subject ILIKE $1 ORDER BY created_at DESC LIMIT 3`,
      [`%${cleanSubject}%`]
    );
    if (threads.length) {
      threadId = threads[0].id;
      if (!resolvedInvestorId) resolvedInvestorId = threads[0].investor_id;
    }
  }

  if (!threadId) return false;

  const sentiment = analyzeSentiment(email.subject, email.bodyPreview);

  await query(
    `INSERT INTO email_messages (user_id, investor_id, thread_id, message_id, direction, from_address, subject, body_text, status, replied_at)
     VALUES ($1, $2, $3, $4, 'inbound', $5, $6, $7, $8, NOW())`,
    [userId, resolvedInvestorId, threadId, email.messageId, email.from, email.subject, email.bodyPreview,
     sentiment === "meeting_requested" ? "replied" : sentiment === "not_interested" ? "bounced" : "replied"]
  );

  const msgCount = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM email_messages WHERE thread_id = $1`,
    [threadId]
  );

  await query(
    `UPDATE email_threads SET message_count = $1, last_message_at = NOW(), last_message_preview = $2, status = $3 WHERE id = $4`,
    [(parseInt(msgCount[0]?.count || "0") || 0) + 1, email.bodyPreview.slice(0, 200),
     sentiment === "meeting_requested" ? "meeting_requested" : "replied", threadId]
  );

  if (resolvedInvestorId) {
    const readinessMap: Record<string, string> = {
      meeting_requested: "ready",
      positive: "contacted",
      negative: "do_not_contact",
      not_interested: "do_not_contact",
      neutral: "contacted",
    };
    await query(
      `UPDATE investors SET outreach_readiness = $1 WHERE id = $2`,
      [readinessMap[sentiment] || "contacted", resolvedInvestorId]
    );
  }

  return true;
}

export async function pollEmailAccounts(userId?: string): Promise<PollResult[]> {
  let sql = `SELECT * FROM email_accounts WHERE is_active = true`;
  const params: any[] = [];
  if (userId) {
    params.push(userId);
    sql += ` AND user_id = $${params.length}`;
  }

  const accounts = await query<any>(sql, params);
  if (!accounts.length) return [];

  // Bounce detection helpers
  function isBounceMessage(email: IncomingEmail): boolean {
    const text = `${email.subject} ${email.bodyPreview}`.toLowerCase();
    return text.includes("delivery failed") || text.includes("delivery status notification") ||
      text.includes("undeliverable") || text.includes("returned mail") ||
      text.includes("non-delivery report") || text.includes("mail delivery subsystem") ||
      (email.from.toLowerCase().includes("mailer-daemon") ||
       email.from.toLowerCase().includes("postmaster"));
  }

  function isHardBounce(email: IncomingEmail): boolean {
    const text = `${email.subject} ${email.bodyPreview}`.toLowerCase();
    return text.includes("mailbox not found") || text.includes("user unknown") ||
      text.includes("invalid address") || text.includes("does not exist") ||
      text.includes("no such user") || text.includes("address rejected");
  }

  function extractBouncedAddress(email: IncomingEmail): string {
    const match = email.bodyPreview.match(/\b([\w.-]+@[\w.-]+\.\w+)\b/);
    return match ? match[1] : email.from;
  }

  function isComplaintMessage(email: IncomingEmail): boolean {
    const text = `${email.subject} ${email.bodyPreview}`.toLowerCase();
    return text.includes("spam complaint") || text.includes("abuse report") ||
      text.includes("unsubscribe request");
  }

  const results: PollResult[] = [];

  for (const account of accounts) {
    const result: PollResult = { accountId: account.id, provider: account.provider, emailsChecked: 0, repliesDetected: 0, errors: [] };

    try {
      let accessToken: string;
      try {
        accessToken = decryptToken(account.access_token);
      } catch {
        result.errors.push("Failed to decrypt access token");
        results.push(result);
        continue;
      }

      const expiresAt = new Date(account.token_expires_at).getTime();
      if (expiresAt <= Date.now() + 300_000) {
        const refreshToken = decryptToken(account.refresh_token);
        const refreshed = await refreshTokenFlow(account.provider, refreshToken);
        if (!refreshed) {
          result.errors.push("Token refresh failed");
          results.push(result);
          continue;
        }
        accessToken = refreshed.accessToken;
        await query(
          `UPDATE email_accounts SET access_token = $1, token_expires_at = $2 WHERE id = $3`,
          [accessToken, new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(), account.id]
        );
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const emails = account.provider === "google"
        ? await fetchGmailMessages(accessToken, since)
        : await fetchMicrosoftMessages(accessToken, since);

      result.emailsChecked = emails.length;

      for (const email of emails) {
        const wasReply = await processReply(email, account.user_id, null, account.id);
        if (wasReply) result.repliesDetected++;
      }

      await query(`UPDATE email_accounts SET last_synced_at = NOW() WHERE id = $1`, [account.id]);
    } catch (err) {
      result.errors.push(String(err));
    }

    results.push(result);
  }

  return results;
}

async function refreshTokenFlow(provider: string, refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    if (provider === "google") {
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return { accessToken: data.access_token, expiresIn: data.expires_in };
    }

    if (provider === "microsoft") {
      const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID || "",
          client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          scope: "Mail.Send Mail.Read offline_access",
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return { accessToken: data.access_token, expiresIn: data.expires_in };
    }

    return null;
  } catch {
    return null;
  }
}
