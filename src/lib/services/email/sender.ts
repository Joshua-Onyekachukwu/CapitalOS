// =============================================
// Email Sender Service
// =============================================
// Sends emails via Google Gmail API or Microsoft Graph API.
// Uses OAuth tokens stored in email_accounts table (CockroachDB).

import { query } from "@/lib/db";
import { encryptToken, decryptToken } from "./crypto";
import { generateTrackingId, injectTracking } from "./tracking";

// =============================================
// Types
// =============================================

interface SendEmailParams {
  userId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string[];
  attachments?: Array<{ name: string; content: string; mimeType: string }>;
  enableTracking?: boolean; // default: true
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================
// Google Gmail API
// =============================================

async function sendViaGmail(
  accessToken: string,
  params: SendEmailParams
): Promise<SendResult> {
  const boundary = `boundary_${Date.now()}`;
  let mimeMessage = "";

  mimeMessage += `To: ${params.to}\r\n`;
  if (params.cc?.length) {
    mimeMessage += `Cc: ${params.cc.join(", ")}\r\n`;
  }
  mimeMessage += `Subject: ${params.subject}\r\n`;
  mimeMessage += `MIME-Version: 1.0\r\n`;
  mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
  mimeMessage += `${params.bodyText || params.bodyHtml.replace(/<[^>]*>/g, "")}\r\n\r\n`;

  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
  mimeMessage += `${params.bodyHtml}\r\n\r\n`;

  mimeMessage += `--${boundary}--`;

  const encodedMessage = Buffer.from(mimeMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedMessage }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Gmail API error: ${error}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =============================================
// Microsoft Graph API
// =============================================

async function sendViaMicrosoft(
  accessToken: string,
  params: SendEmailParams
): Promise<SendResult> {
  const message = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.bodyHtml,
    },
    toRecipients: [
      { emailAddress: { address: params.to } },
    ],
    ccRecipients: params.cc?.map((addr) => ({
      emailAddress: { address: addr },
    })),
  };

  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Microsoft Graph error: ${error}` };
    }

    return { success: true, messageId: `microsoft-${Date.now()}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =============================================
// Token Refresh
// =============================================

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch {
    return null;
  }
}

async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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

    if (!response.ok) return null;

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch {
    return null;
  }
}

// =============================================
// Main Send Function
// =============================================

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  // Get user's email account from CockroachDB
  const accounts = await query<any>(
    `SELECT * FROM email_accounts WHERE user_id = $1 AND is_active = true LIMIT 1`,
    [params.userId]
  );

  if (!accounts.length) {
    return { success: false, error: "No email account connected. Please connect one in Settings." };
  }

  const account = accounts[0];

  // Check if token needs refresh
  let accessToken = decryptToken(account.access_token);
  const expiresAt = new Date(account.token_expires_at).getTime();

  if (expiresAt <= Date.now() + 300_000) {
    const refreshToken = decryptToken(account.refresh_token);

    if (account.provider === "google") {
      const refreshed = await refreshGoogleToken(refreshToken);
      if (!refreshed) return { success: false, error: "Failed to refresh Google token. Please reconnect." };
      accessToken = refreshed.accessToken;

      await query(
        `UPDATE email_accounts SET access_token = $1, token_expires_at = $2 WHERE id = $3`,
        [encryptToken(refreshed.accessToken), new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(), account.id]
      );
    } else if (account.provider === "microsoft") {
      const refreshed = await refreshMicrosoftToken(refreshToken);
      if (!refreshed) return { success: false, error: "Failed to refresh Microsoft token. Please reconnect." };
      accessToken = refreshed.accessToken;

      await query(
        `UPDATE email_accounts SET access_token = $1, token_expires_at = $2 WHERE id = $3`,
        [encryptToken(refreshed.accessToken), new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(), account.id]
      );
    }
  }

  // Generate tracking ID and inject pixel/rewrite links
  const trackingEnabled = params.enableTracking !== false;
  const trackingId = trackingEnabled ? generateTrackingId() : null;
  let trackedHtml = params.bodyHtml;

  if (trackingEnabled && trackingId) {
    trackedHtml = injectTracking(params.bodyHtml, trackingId, true);
  }

  // Send via provider (use tracked HTML)
  const sendParams = { ...params, bodyHtml: trackedHtml };
  let result: SendResult;

  if (account.provider === "google") {
    result = await sendViaGmail(accessToken, sendParams);
  } else if (account.provider === "microsoft") {
    result = await sendViaMicrosoft(accessToken, sendParams);
  } else {
    return { success: false, error: `Unsupported provider: ${account.provider}` };
  }

  // Log the email with tracking ID in CockroachDB
  if (result.success) {
    await query(
      `INSERT INTO email_messages (user_id, investor_id, direction, subject, body_html, body_text, from_address, to_address, cc_addresses, status, sent_at, message_id, tracking_id, tracking_enabled, open_count, click_count)
       VALUES ($1, NULL, 'outbound', $2, $3, $4, $5, $6, $7, 'sent', NOW(), $8, $9, $10, 0, 0)`,
      [
        params.userId,
        params.subject,
        trackedHtml,
        params.bodyText,
        account.email_address,
        params.to,
        params.cc || [],
        result.messageId,
        trackingId,
        trackingEnabled,
      ]
    );
  }

  return result;
}
