// =============================================
// Email Sender — Supports Global + Per-User SMTP
// =============================================
// 1. Global: uses SMTP_USER/SMTP_PASS from env (Gmail app password)
// 2. Per-User: uses custom SMTP settings from email_accounts table

import nodemailer from "nodemailer";

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

interface SmtpSendParams {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string[];
  replyTo?: string;
  /** User-specific SMTP config. If null, uses global env config. */
  smtpConfig?: SmtpConfig;
}

interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================
// Transport Cache
// =============================================

const transportCache = new Map<string, nodemailer.Transporter>();

function getTransporter(config?: SmtpConfig): nodemailer.Transporter {
  const cacheKey = config
    ? `${config.host}:${config.port}:${config.user}`
    : "global";

  if (transportCache.has(cacheKey)) {
    return transportCache.get(cacheKey)!;
  }

  let transport: nodemailer.Transporter;

  if (config) {
    // Per-user custom SMTP
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
    // Global env SMTP (Gmail app password fallback)
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
    const transport = getTransporter(params.smtpConfig);
    const config = params.smtpConfig;

    const fromAddress = config
      ? `"${config.fromName || "Capital OS"}" <${config.fromEmail}>`
      : `"Capital OS" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`;

    const bodyText = params.bodyText || params.bodyHtml.replace(/<[^>]*>/g, "");
    const compliant = injectSmtpCompliance(params.bodyHtml, bodyText, params.to);

    const info = await transport.sendMail({
      from: fromAddress,
      to: params.to,
      cc: params.cc?.join(", "),
      subject: params.subject,
      text: compliant.text,
      html: compliant.html,
      replyTo: params.replyTo,
    });

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
// Send with User's Custom SMTP (from DB)
// =============================================

export async function sendEmailWithUserSmtp(
  userId: string,
  params: SmtpSendParams
): Promise<SmtpSendResult> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
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

    // Build SMTP config from account
    let smtpConfig: SmtpConfig | undefined;

    if (account.smtp_host && account.smtp_user && account.smtp_pass_encrypted) {
      smtpConfig = {
        host: account.smtp_host,
        port: account.smtp_port || 587,
        user: account.smtp_user,
        pass: account.smtp_pass_encrypted,
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
    const transport = getTransporter(config);
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}
