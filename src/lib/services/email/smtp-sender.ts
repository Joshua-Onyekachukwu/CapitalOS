// =============================================
// Gmail SMTP Email Sender
// =============================================
// Sends emails via Gmail SMTP using app password.
// Simpler than OAuth — no token refresh needed.

import nodemailer from "nodemailer";

// =============================================
// Types
// =============================================

interface SmtpSendParams {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string[];
  replyTo?: string;
}

interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================
// Transporter (singleton)
// =============================================

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // TLS on port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporter;
}

// =============================================
// Send Email
// =============================================

export async function sendEmailViaSmtp(
  params: SmtpSendParams
): Promise<SmtpSendResult> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return {
      success: false,
      error: "SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in .env.local",
    };
  }

  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from: `"Capital OS" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: params.to,
      cc: params.cc?.join(", "),
      subject: params.subject,
      text: params.bodyText || params.bodyHtml.replace(/<[^>]*>/g, ""),
      html: params.bodyHtml,
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
// Verify Connection
// =============================================

export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}
