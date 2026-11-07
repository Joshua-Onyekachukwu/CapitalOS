// =============================================
// Platform alert email
// =============================================
// Data room alerts cannot depend on the owner having connected a mailbox — a
// founder who has not finished onboarding still needs to know their link is
// being hammered. This sends from the platform's own sender instead.
//
// Two providers, in order: Resend when its key and sender are configured, else
// the platform SMTP account the auth mail already uses. No SDK for Resend (one
// HTTPS call), and no fallback that pretends to send: when neither provider is
// configured the caller is told so and records that, rather than marking an
// alert delivered.

import nodemailer from "nodemailer";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type AlertChannel = "mailbox" | "platform" | "none";
export type PlatformProvider = "resend" | "smtp" | "none";

/**
 * Which sender an alert should use. The owner's connected mailbox wins because
 * replies land somewhere they read; the platform sender is the fallback.
 */
export function chooseAlertChannel(options: {
  hasMailbox: boolean;
  hasPlatformProvider: boolean;
}): AlertChannel {
  if (options.hasMailbox) return "mailbox";
  if (options.hasPlatformProvider) return "platform";
  return "none";
}

function resendFrom(): string | undefined {
  return process.env.ALERT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
}

/** Resend if it is fully configured, else the platform SMTP account. */
export function platformProvider(): PlatformProvider {
  if (process.env.RESEND_API_KEY && resendFrom()) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

export function platformEmailConfigured(): boolean {
  return platformProvider() !== "none";
}

export interface PlatformEmailResult {
  sent: boolean;
  provider?: Exclude<PlatformProvider, "none">;
  reason?: "skipped_no_provider" | "failed";
}

interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendViaResend(params: OutgoingEmail, from: string): Promise<PlatformEmailResult> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    // Never log the key or the full response body.
    const detail = (await response.text()).slice(0, 300);
    console.error(`[platform-email] resend failed (${response.status}):`, detail);
    return { sent: false, provider: "resend", reason: "failed" };
  }

  return { sent: true, provider: "resend" };
}

/**
 * Sends through the platform SMTP account (the same credentials the auth mail
 * uses). Deliberately transactional: no marketing footer and no unsubscribe
 * link, both of which are wrong on a security notice.
 */
async function sendViaSmtp(params: OutgoingEmail): Promise<PlatformEmailResult> {
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER as string,
      pass: process.env.SMTP_PASS as string,
    },
    connectionTimeout: 10_000,
  });

  try {
    await transport.sendMail({
      from: process.env.ALERT_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { sent: true, provider: "smtp" };
  } finally {
    transport.close();
  }
}

export async function sendPlatformEmail(params: OutgoingEmail): Promise<PlatformEmailResult> {
  const provider = platformProvider();
  if (provider === "none") return { sent: false, reason: "skipped_no_provider" };

  try {
    if (provider === "resend") return await sendViaResend(params, resendFrom() as string);
    return await sendViaSmtp(params);
  } catch (err) {
    console.error("[platform-email] send threw:", err);
    return { sent: false, provider, reason: "failed" };
  }
}
