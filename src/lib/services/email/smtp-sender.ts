// =============================================
// Email Sender — OAuth2 (XOAUTH2) + Global + Per-User SMTP
// =============================================
// Auth strategy, in preference order:
//   1. Per-user Google OAuth2 (XOAUTH2): the user connected Gmail via
//      /api/auth/google — send from THEIR address with their tokens
//      (email_accounts.provider='google', refresh_token encrypted at rest).
//   2. Per-user custom SMTP: their own host/user/password.
//   3. Global OAuth2: GOOGLE_CLIENT_ID/SECRET + GOOGLE_REFRESH_TOKEN env.
//   4. Global legacy: SMTP_USER/SMTP_PASS Gmail app password.
//
// OAuth2 is Google's current protocol; app passwords are legacy and get
// rejected with 535 5.7.8 when app-password access is revoked on the account.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/services/email/crypto";

// =============================================
// Types
// =============================================

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromName?: string;
  fromEmail: string;
}

/** XOAUTH2 credentials — preferred over SmtpConfig when present. */
interface OAuth2Config {
  user: string;
  accessToken: string;
}

interface SmtpSendParams {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string[];
  replyTo?: string;
  attachments?: {
    filename: string;
    content: string; // base64-encoded file contents
    contentType?: string;
    encoding?: string;
  }[];
  /** User-specific SMTP config. If null, uses global env config. */
  smtpConfig?: SmtpConfig;
  /** XOAUTH2 credentials — win over smtpConfig when present. */
  oauth2?: OAuth2Config;
}

interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================
// Google OAuth2 — access token exchange (cached per refresh token)
// =============================================

const oauth2TokenCache = new Map<string, { token: string; expiresAt: number }>();

function refreshCacheKey(refreshToken: string): string {
  return Buffer.from(refreshToken).toString("base64").slice(0, 48);
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const key = refreshCacheKey(refreshToken);
  const cached = oauth2TokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) {
      console.error(`[smtp-sender] OAuth2 refresh failed: ${resp.status} ${(await resp.text()).slice(0, 120)}`);
      return null;
    }
    const data = await resp.json();
    const token = String(data.access_token);
    oauth2TokenCache.set(key, { token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 });
    return token;
  } catch (err) {
    console.error("[smtp-sender] OAuth2 refresh error:", err);
    return null;
  }
}

/** Global OAuth2 token from env (service account refresh token). */
async function getGlobalOAuth2AccessToken(): Promise<OAuth2Config | null> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken || !process.env.GOOGLE_CLIENT_ID) return null;
  const token = await refreshGoogleAccessToken(refreshToken);
  if (!token) return null;
  return { user: process.env.SMTP_USER || process.env.EMAIL_FROM || "", accessToken: token };
}

// =============================================
// Transport selection
// =============================================

const transportCache = new Map<string, Transporter>();

async function getTransporter(
  config?: SmtpConfig,
  oauth2?: OAuth2Config
): Promise<Transporter> {
  // 1) XOAUTH2 transports are NOT cached: their embedded access token
  //    expires (~1h) and a pooled transport would keep sending with a stale
  //    token. The token itself is cached above with a 60s safety margin, so
  //    rebuilding is cheap.
  if (oauth2) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        type: "OAuth2",
        user: oauth2.user,
        accessToken: oauth2.accessToken,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  const cacheKey = config ? `${config.host}:${config.port}:${config.user}` : "global";
  if (transportCache.has(cacheKey)) {
    return transportCache.get(cacheKey)!;
  }

  let transport: Transporter;

  if (config) {
    // 2) Per-user custom SMTP (password auth — user's own server)
    transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });
  } else {
    // 3) Global OAuth2 from env, else 4) global app password (legacy)
    const globalOAuth2 = await getGlobalOAuth2AccessToken();
    if (globalOAuth2 && globalOAuth2.user) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          type: "OAuth2",
          user: globalOAuth2.user,
          accessToken: globalOAuth2.accessToken,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("No email credentials configured");
    }
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  transportCache.set(cacheKey, transport);
  return transport;
}

// =============================================
// Send Email
// =============================================

const SMTP_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const SMTP_COMPANY_ADDRESS = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";

function injectSmtpCompliance(html: string, text: string, toEmail: string): { html: string; text: string } {
  const unsubUrl = `${SMTP_APP_URL}/api/unsubscribe?email=${encodeURIComponent(toEmail)}`;
  
  const htmlFooter = `
    <div style="background: #fafafa; padding: 16px 32px; text-align: center; border-top: 1px solid #eeeeee; margin-top: 24px;">
      <p style="color: #999999; font-size: 11px; margin: 0 0 4px; font-style: italic;">This is a commercial email sent via Capital OS.</p>
      <p style="color: #999999; font-size: 11px; margin: 0 0 4px;">${SMTP_COMPANY_ADDRESS}</p>
      <p style="color: #999999; font-size: 11px; margin: 0 0 4px;">
        <a href="${unsubUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe from all emails</a>
      </p>
      <p style="color: #999999; font-size: 11px; margin: 0;">
        <a href="${SMTP_APP_URL}/privacy" style="color: #999999;">Privacy Policy</a> • 
        <a href="${SMTP_APP_URL}/terms" style="color: #999999;">Terms of Service</a>
      </p>
    </div>`;
  
  const compliantHtml = html.includes("Unsubscribe from all emails")
    ? html
    : html.replace(/<\/body>/i, `${htmlFooter}\n</body>`);
  
  const textFooter = `

---
This is a commercial email sent via Capital OS.
${SMTP_COMPANY_ADDRESS}
Unsubscribe: ${unsubUrl}`;
  
  const compliantText = text.includes("Unsubscribe:") ? text : text + textFooter;
  
  return { html: compliantHtml, text: compliantText };
}

export async function sendEmailViaSmtp(
  params: SmtpSendParams
): Promise<SmtpSendResult> {
  try {
    const transport = await getTransporter(params.smtpConfig, params.oauth2);
    const config = params.smtpConfig;

    const fromAddress = params.oauth2
      ? `"Capital OS" <${params.oauth2.user}>`
      : config
      ? `"${config.fromName || "Capital OS"}" <${config.fromEmail}>`
      : `"Capital OS" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`;

    const bodyText = params.bodyText || params.bodyHtml.replace(/<[^>]*>/g, "");
    const compliant = injectSmtpCompliance(params.bodyHtml, bodyText, params.to);

    const mailOptions: any = {
      from: fromAddress,
      to: params.to,
      cc: params.cc?.join(", "),
      subject: params.subject,
      text: compliant.text,
      html: compliant.html,
      replyTo: params.replyTo,
    };

    // Add attachments if provided (content is base64 — decode for nodemailer)
    if (params.attachments && params.attachments.length > 0) {
      mailOptions.attachments = params.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.contentType,
      }));
    }

    const info = await transport.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

// =============================================
// Send with User's Connected Account (from DB)
// =============================================

export async function sendEmailWithUserSmtp(
  userId: string,
  params: SmtpSendParams
): Promise<SmtpSendResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's active email account
    const { data: account } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!account) {
      // Fallback to global SMTP
      return sendEmailViaSmtp(params);
    }

    // Check daily send limit
    const now = new Date();
    const lastReset = account.last_send_reset_at
      ? new Date(account.last_send_reset_at)
      : new Date(0);
    const hoursSinceReset =
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      // Reset daily counter
      await supabase
        .from("email_accounts")
        .update({
          sends_today: 0,
          last_send_reset_at: now.toISOString(),
        })
        .eq("id", account.id);
    } else if (
      account.sends_today >= (account.daily_send_limit || 50)
    ) {
      return {
        success: false,
        error: `Daily send limit reached (${account.daily_send_limit || 50}/day). Try again tomorrow.`,
      };
    }

    // ── Google OAuth2 account: send from the user's own Gmail via XOAUTH2 ──
    if (account.provider === "google" && account.refresh_token) {
      let refreshToken: string;
      try {
        refreshToken = decryptToken(account.refresh_token);
      } catch {
        return {
          success: false,
          error: "Stored Google tokens could not be decrypted — reconnect your Gmail account in Settings.",
        };
      }
      const accessToken = await refreshGoogleAccessToken(refreshToken);
      if (!accessToken) {
        return {
          success: false,
          error: "Google token refresh failed — reconnect your Gmail account in Settings.",
        };
      }
      const result = await sendEmailViaSmtp({
        ...params,
        oauth2: { user: account.email_address, accessToken },
      });
      if (result.success) {
        await supabase
          .from("email_accounts")
          .update({ sends_today: (account.sends_today || 0) + 1, last_synced_at: new Date().toISOString() })
          .eq("id", account.id);
      }
      return result;
    }

    // ── Custom SMTP account (password auth) ──
    let smtpConfig: SmtpConfig | undefined;

    if (account.smtp_host && account.smtp_user && account.smtp_pass_encrypted) {
      // Passwords are stored AES-256-GCM encrypted (iv:tag:ciphertext). Legacy
      // rows saved before encryption are detected by format and still work.
      let smtpPass = account.smtp_pass_encrypted;
      if (/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(account.smtp_pass_encrypted)) {
        try {
          smtpPass = decryptToken(account.smtp_pass_encrypted);
        } catch {
          return {
            success: false,
            error: "Stored SMTP credentials could not be decrypted — re-save your email account in Settings.",
          };
        }
      }
      smtpConfig = {
        host: account.smtp_host,
        port: account.smtp_port || 587,
        user: account.smtp_user,
        pass: smtpPass,
        secure: account.smtp_secure ?? true,
        fromName: account.display_name,
        fromEmail: account.email_address,
      };
    }

    // Send email
    const result = await sendEmailViaSmtp({
      ...params,
      smtpConfig,
    });

    // Update send count
    if (result.success) {
      await supabase
        .from("email_accounts")
        .update({ sends_today: (account.sends_today || 0) + 1 })
        .eq("id", account.id);
    }

    return result;
  } catch (err: any) {
    // Fallback to global SMTP
    return sendEmailViaSmtp(params);
  }
}

// =============================================
// Verify Connection
// =============================================

export async function verifySmtpConnection(
  config?: SmtpConfig
): Promise<boolean> {
  try {
    const transport = await getTransporter(config);
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}
