// =============================================
// Email Reply Poller Service
// =============================================
// Polls connected email accounts for new messages,
// detects replies to outreach emails, and updates
// investor status accordingly.

import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto";
import { analyzeSentiment } from "./reply-detection";

// =============================================
// Types
// =============================================

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

// =============================================
// Gmail API — Fetch Recent Emails
// =============================================

async function fetchGmailMessages(
  accessToken: string,
  since: Date
): Promise<IncomingEmail[]> {
  const emails: IncomingEmail[] = [];
  const sinceTimestamp = Math.floor(since.getTime() / 1000);

  try {
    // Search for emails after the timestamp
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${sinceTimestamp}&maxResults=50`;
    const searchResp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResp.ok) return emails;
    const searchData = await searchResp.json();
    const messages = searchData.messages || [];

    // Fetch each message details
    for (const msg of messages.slice(0, 20)) {
      try {
        const msgResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=Message-ID&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResp.ok) continue;
        const msgData = await msgResp.json();

        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        emails.push({
          id: msgData.id,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          bodyPreview: msgData.snippet || "",
          date: getHeader("Date"),
          inReplyTo: getHeader("In-Reply-To") || null,
          messageId: getHeader("Message-ID") || msgData.id,
        });
      } catch {
        // Skip individual message errors
      }
    }
  } catch {
    // Gmail API error
  }

  return emails;
}

// =============================================
// Microsoft Graph API — Fetch Recent Emails
// =============================================

async function fetchMicrosoftMessages(
  accessToken: string,
  since: Date
): Promise<IncomingEmail[]> {
  const emails: IncomingEmail[] = [];
  const sinceISO = since.toISOString();

  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${sinceISO}&$top=20&$orderby=receivedDateTime desc`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) return emails;
    const data = await resp.json();
    const messages = data.value || [];

    for (const msg of messages) {
      emails.push({
        id: msg.id,
        from: msg.from?.emailAddress?.address || "",
        subject: msg.subject || "",
        bodyPreview: msg.bodyPreview || "",
        date: msg.receivedDateTime || "",
        inReplyTo: msg.internetMessageHeaders?.find(
          (h: { name: string; value: string }) => h.name.toLowerCase() === "in-reply-to"
        )?.value || null,
        messageId: msg.internetMessageId || msg.id,
      });
    }
  } catch {
    // Microsoft Graph API error
  }

  return emails;
}

// =============================================
// Reply Detection Logic
// =============================================

async function processReply(
  email: IncomingEmail,
  userId: string,
  investorId: string | null
): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if this email was already processed
  const { data: existing } = await supabase
    .from("email_messages")
    .select("id")
    .eq("message_id", email.messageId)
    .limit(1);

  if (existing && existing.length > 0) return false;

  // Find thread by In-Reply-To or subject
  let threadId: string | null = null;
  let resolvedInvestorId = investorId;

  if (email.inReplyTo) {
    const { data: original } = await supabase
      .from("email_messages")
      .select("thread_id, investor_id")
      .eq("message_id", email.inReplyTo)
      .single();

    if (original) {
      threadId = original.thread_id;
      if (!resolvedInvestorId) resolvedInvestorId = original.investor_id;
    }
  }

  // Fallback: match by subject
  if (!threadId) {
    const cleanSubject = email.subject.replace(/^(re:|fwd?:|fw:)\s*/i, "").trim();
    const { data: threads } = await supabase
      .from("email_threads")
      .select("id, investor_id")
      .ilike("subject", `%${cleanSubject}%`)
      .order("created_at", { ascending: false })
      .limit(3);

    if (threads && threads.length > 0) {
      threadId = threads[0].id;
      if (!resolvedInvestorId) resolvedInvestorId = threads[0].investor_id;
    }
  }

  // If no thread found, this might be a new conversation — skip
  if (!threadId) return false;

  // Analyze sentiment
  const sentiment = analyzeSentiment(email.subject, email.bodyPreview);

  // Store the inbound email
  await supabase.from("email_messages").insert({
    user_id: userId,
    investor_id: resolvedInvestorId,
    thread_id: threadId,
    message_id: email.messageId,
    direction: "inbound",
    from_address: email.from,
    subject: email.subject,
    body_text: email.bodyPreview,
    status: sentiment === "meeting_requested" ? "replied" : sentiment === "not_interested" ? "bounced" : "replied",
    replied_at: new Date().toISOString(),
  });

  // Update thread
  const { count: msgCount } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  await supabase
    .from("email_threads")
    .update({
      message_count: (msgCount || 0) + 1,
      last_message_at: new Date().toISOString(),
      last_message_preview: email.bodyPreview.slice(0, 200),
      status: sentiment === "meeting_requested" ? "meeting_requested" : "replied",
    })
    .eq("id", threadId);

  // Update investor status
  if (resolvedInvestorId) {
    const readinessMap: Record<string, string> = {
      meeting_requested: "ready",
      positive: "contacted",
      negative: "do_not_contact",
      not_interested: "do_not_contact",
      neutral: "contacted",
    };

    await supabase
      .from("investors")
      .update({ outreach_readiness: readinessMap[sentiment] || "contacted" })
      .eq("id", resolvedInvestorId);
  }

  return true;
}

// =============================================
// Main Poll Function
// =============================================

export async function pollEmailAccounts(
  userId?: string
): Promise<PollResult[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get active email accounts
  let query = supabase
    .from("email_accounts")
    .select("*")
    .eq("is_active", true);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: accounts } = await query;
  if (!accounts || accounts.length === 0) return [];

  const results: PollResult[] = [];

  for (const account of accounts) {
    const result: PollResult = {
      accountId: account.id,
      provider: account.provider,
      emailsChecked: 0,
      repliesDetected: 0,
      errors: [],
    };

    try {
      // Decrypt access token
      let accessToken: string;
      try {
        accessToken = decryptToken(account.access_token);
      } catch {
        result.errors.push("Failed to decrypt access token");
        results.push(result);
        continue;
      }

      // Check if token needs refresh
      const expiresAt = new Date(account.token_expires_at).getTime();
      if (expiresAt <= Date.now() + 300_000) {
        // Token expired — try refresh
        const refreshToken = decryptToken(account.refresh_token);
        const refreshed = await refreshTokenFlow(account.provider, refreshToken);

        if (!refreshed) {
          result.errors.push("Token refresh failed — reconnect email account");
          results.push(result);
          continue;
        }

        accessToken = refreshed.accessToken;

        // Update stored token
        await supabase
          .from("email_accounts")
          .update({
            access_token: accessToken, // Will be encrypted by trigger
            token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          })
          .eq("id", account.id);
      }

      // Fetch recent emails (last 24 hours)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const emails = account.provider === "google"
        ? await fetchGmailMessages(accessToken, since)
        : await fetchMicrosoftMessages(accessToken, since);

      result.emailsChecked = emails.length;

      // Process each email
      for (const email of emails) {
        const wasReply = await processReply(email, account.user_id, null);
        if (wasReply) result.repliesDetected++;
      }

      // Update last_synced_at
      await supabase
        .from("email_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account.id);
    } catch (err) {
      result.errors.push(String(err));
    }

    results.push(result);
  }

  return results;
}

// =============================================
// Token Refresh Helper
// =============================================

async function refreshTokenFlow(
  provider: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
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
      const resp = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID || "",
            client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
            refresh_token: refreshToken,
            grant_type: "refresh_token",
            scope: "Mail.Send Mail.Read offline_access",
          }),
        }
      );

      if (!resp.ok) return null;
      const data = await resp.json();
      return { accessToken: data.access_token, expiresIn: data.expires_in };
    }

    return null;
  } catch {
    return null;
  }
}
