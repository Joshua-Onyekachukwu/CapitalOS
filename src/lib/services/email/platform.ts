// =============================================
// Platform alert email
// =============================================
// Data room alerts cannot depend on the owner having connected a mailbox — a
// founder who has not finished onboarding still needs to know their link is
// being hammered. This sends from the platform's own verified sender instead.
//
// Deliberately provider-specific and tiny: a single HTTPS call, no SDK, and no
// fallback that pretends to send. When the key or sender is absent the caller is
// told so and records that, rather than marking an alert delivered.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type AlertChannel = "mailbox" | "platform" | "none";

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

export function platformEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
      (process.env.ALERT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL)
  );
}

export interface PlatformEmailResult {
  sent: boolean;
  reason?: "skipped_no_provider" | "failed";
}

export async function sendPlatformEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<PlatformEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;

  if (!key || !from) return { sent: false, reason: "skipped_no_provider" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
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
      console.error(`[platform-email] send failed (${response.status}):`, detail);
      return { sent: false, reason: "failed" };
    }

    return { sent: true };
  } catch (err) {
    console.error("[platform-email] send threw:", err);
    return { sent: false, reason: "failed" };
  }
}
