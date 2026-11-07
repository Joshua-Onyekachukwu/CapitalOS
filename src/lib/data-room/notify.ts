// =============================================
// Data room owner notifications
// =============================================
// The access log is passive: the owner has to open it to learn anything. These
// notifications are the active signal. The table's (share_id, kind, bucket)
// uniqueness does the throttling, so concurrent requests cannot produce a
// duplicate alert, and the owner's mailbox is only touched when they have
// actually connected one.

import { after } from "next/server";
import {
  chooseAlertChannel,
  platformEmailConfigured,
  sendPlatformEmail,
} from "@/lib/services/email/platform";

// The data room route builds an untyped service-role client (the generated
// database types do not cover the tables added here), so pinning this helper to
// a specific client generic would reject the only caller for no type benefit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
type NotificationKind = "opened" | "blocked";

const WINDOW_MS: Record<NotificationKind, number> = {
  // One open alert per share per hour; a burst of blocked attempts is worth at
  // most one alert per six hours.
  opened: 60 * 60 * 1000,
  blocked: 6 * 60 * 60 * 1000,
};

export function notificationBucket(kind: NotificationKind, now = Date.now()): string {
  return String(Math.floor(now / WINDOW_MS[kind]));
}

async function markEmailStatus(sp: Admin, id: string, status: string) {
  const { error } = await sp
    .from("data_room_notifications")
    .update({ email_status: status })
    .eq("id", id);
  if (error) console.error("[data-room] notification email status failed:", error.message);
}

async function emailOwner(
  sp: Admin,
  params: {
    notificationId: string;
    userId: string;
    title: string;
    summary: string;
  }
) {
  try {
    const { data: userData } = await sp.auth.admin.getUserById(params.userId);
    const to = userData?.user?.email;
    if (!to) {
      await markEmailStatus(sp, params.notificationId, "skipped_no_account");
      return;
    }

    const { data: accounts } = await sp
      .from("email_accounts")
      .select("id")
      .eq("user_id", params.userId)
      .eq("is_active", true)
      .limit(1);

    // Owner's own mailbox first, then the platform sender, so an owner who has
    // not connected anything still hears about activity on their link.
    const channel = chooseAlertChannel({
      hasMailbox: !!accounts?.length,
      hasPlatformProvider: platformEmailConfigured(),
    });

    if (channel === "none") {
      await markEmailStatus(sp, params.notificationId, "skipped_no_provider");
      return;
    }

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#06201b;line-height:1.5">
        <h2 style="margin:0 0 8px;font-size:18px">${params.title}</h2>
        <p style="margin:0 0 12px;color:#4b5563">${params.summary}</p>
        <p style="margin:0;color:#6b7280;font-size:13px">
          Open your Documents page to see every recorded attempt.
        </p>
      </div>`;

    let sent: boolean;
    if (channel === "mailbox") {
      const { sendEmail } = await import("@/lib/services/email/sender");
      const result = await sendEmail({
        userId: params.userId,
        to,
        subject: params.title,
        bodyHtml: html,
        bodyText: params.summary,
        enableTracking: false,
      });
      sent = result.success;
    } else {
      const result = await sendPlatformEmail({
        to,
        subject: params.title,
        html,
        text: params.summary,
      });
      sent = result.sent;
    }

    await markEmailStatus(sp, params.notificationId, sent ? "sent" : "failed");
  } catch (err) {
    console.error("[data-room] owner notification email failed:", err);
  }
}

/**
 * Records an owner alert, at most once per window per share and kind. The email
 * is sent after the response so an investor's data room open is not delayed by
 * the owner's mail provider.
 */
export async function notifyDataRoomOwner(
  sp: Admin,
  params: {
    userId: string;
    shareId: string;
    kind: NotificationKind;
    title: string;
    summary: string;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  const { data, error } = await sp
    .from("data_room_notifications")
    .upsert(
      {
        user_id: params.userId,
        share_id: params.shareId,
        kind: params.kind,
        bucket: notificationBucket(params.kind),
        title: params.title,
        detail: { summary: params.summary, ...(params.detail ?? {}) },
      },
      { onConflict: "share_id,kind,bucket", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    // A missed alert must not break the data room response, but it must be loud:
    // otherwise the owner's alerts silently stop.
    console.error("[data-room] owner notification failed:", error.message);
    return;
  }

  const notificationId = data?.[0]?.id;
  if (!notificationId) return; // already notified in this window

  after(async () => {
    await emailOwner(sp, {
      notificationId,
      userId: params.userId,
      title: params.title,
      summary: params.summary,
    });
  });
}
