// =============================================
// Email Sender Service (Supabase)
// =============================================

import { createClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "./crypto";
import { generateTrackingId, injectTracking } from "./tracking";
import { isSuppressed } from "./suppression";
import { logSend, logEvent } from "./events";
import { checkBeforeSend } from "./sending-guard"

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SendEmailParams {
  userId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string[];
  attachments?: Array<{ name: string; content: string; mimeType: string }>;
  enableTracking?: boolean;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

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
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch { return null; }
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
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch { return null; }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const COMPANY_ADDRESS = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";

function injectComplianceFooter(html: string, text: string, toEmail: string): { html: string; text: string } {
  const unsubUrl = `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(toEmail)}`;
  
  // HTML footer — injected before closing </body>
  const htmlFooter = `
    <div style="background: #fafafa; padding: 16px 32px; text-align: center; border-top: 1px solid #eeeeee; margin-top: 24px;">
      <p style="color: #999999; font-size: 11px; margin: 0 0 4px; font-style: italic;">This is a commercial email sent via Capital OS.</p>
      <p style="color: #999999; font-size: 11px; margin: 0 0 4px;">${COMPANY_ADDRESS}</p>
      <p style="color: #999999; font-size: 11px; margin: 0 0 4px;">
        <a href="${unsubUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe from all emails</a>
      </p>
      <p style="color: #999999; font-size: 11px; margin: 0;">
        <a href="${APP_URL}/privacy" style="color: #999999;">Privacy Policy</a> • 
        <a href="${APP_URL}/terms" style="color: #999999;">Terms of Service</a>
      </p>
    </div>`;
  
  const compliantHtml = html.includes("Unsubscribe from all emails")
    ? html // Already has compliance footer (from template)
    : html.replace(/<\/body>/i, `${htmlFooter}\n</body>`);
  
  const textFooter = `

---
This is a commercial email sent via Capital OS.
${COMPANY_ADDRESS}
Unsubscribe: ${unsubUrl}`;
  
  const compliantText = text.includes("Unsubscribe:")
    ? text // Already has compliance footer
    : text + textFooter;
  
  return { html: compliantHtml, text: compliantText };
}

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const sp = getSp();

  const { data: accounts } = await sp
    .from("email_accounts")
    .select("*")
    .eq("user_id", params.userId)
    .eq("is_active", true)
    .limit(1);

  if (!accounts?.length) {
    return { success: false, error: "No email account connected. Please connect one in Settings." };
  }

  const account = accounts[0];

  // Pre-send health check
  const preSendCheck = await checkBeforeSend(params.userId, account.id, params.to);
  if (!preSendCheck.allowed) {
    return { success: false, error: preSendCheck.reason };
  }

  // Check suppression list
  const suppressed = await isSuppressed(params.userId, params.to);
  if (suppressed) {
    return { success: false, error: `This email address is on your suppression list and cannot receive emails.` };
  }

  let accessToken = decryptToken(account.access_token);
  const expiresAt = new Date(account.token_expires_at).getTime();

  if (expiresAt <= Date.now() + 300_000) {
    const refreshToken = decryptToken(account.refresh_token);

    if (account.provider === "google") {
      const refreshed = await refreshGoogleToken(refreshToken);
      if (!refreshed) return { success: false, error: "Failed to refresh Google token." };
      accessToken = refreshed.accessToken;
      await sp
        .from("email_accounts")
        .update({
          access_token: encryptToken(refreshed.accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        })
        .eq("id", account.id);
    } else if (account.provider === "microsoft") {
      const refreshed = await refreshMicrosoftToken(refreshToken);
      if (!refreshed) return { success: false, error: "Failed to refresh Microsoft token." };
      accessToken = refreshed.accessToken;
      await sp
        .from("email_accounts")
        .update({
          access_token: encryptToken(refreshed.accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        })
        .eq("id", account.id);
    }
  }

  // Inject CAN-SPAM compliance footer into every outbound email
  const compliant = injectComplianceFooter(params.bodyHtml, params.bodyText || params.bodyHtml.replace(/<[^>]*>/g, ""), params.to);

  const trackingEnabled = params.enableTracking !== false;
  const trackingId = trackingEnabled ? generateTrackingId() : null;
  let trackedHtml = compliant.html;

  if (trackingEnabled && trackingId) {
    trackedHtml = injectTracking(compliant.html, trackingId, true);
  }

  const sendParams = { ...params, bodyHtml: trackedHtml, bodyText: compliant.text };
  let result: SendResult;

  if (account.provider === "google") {
    result = await sendViaGmail(accessToken, sendParams);
  } else if (account.provider === "microsoft") {
    result = await sendViaMicrosoft(accessToken, sendParams);
  } else {
    return { success: false, error: `Unsupported provider: ${account.provider}` };
  }

  if (result.success) {
    try {
      const { data: msgRecord } = await sp.from("email_messages").insert({
        user_id: params.userId,
        direction: "outbound",
        subject: params.subject,
        body_html: trackedHtml,
        body_text: params.bodyText,
        from_address: account.email_address,
        to_address: params.to,
        cc_addresses: params.cc || [],
        account_id: account.id,
        status: "sent",
        sent_at: new Date().toISOString(),
        message_id: result.messageId,
        tracking_id: trackingId,
        tracking_enabled: trackingEnabled,
        open_count: 0,
        click_count: 0,
      }).select("id").single();

      // Log to sending_log and health events
      await logSend({
        userId: params.userId,
        accountId: account.id,
        emailMessageId: msgRecord?.id,
        provider: account.provider,
        toAddress: params.to,
        subject: params.subject,
        trackingId: trackingId || undefined,
      });
    } catch {
      // Non-critical
    }
  } else {
    // Log failed send
    await logEvent({
      userId: params.userId,
      accountId: account.id,
      eventType: "sent",
      severity: "warning",
      details: { to: params.to, error: result.error },
    }).catch(() => {});
  }

  return result;
}
