// =============================================
// Email Tracking Service
// =============================================
// Uses CockroachDB for data.

import { query } from "@/lib/db";

export interface TrackingEvent {
  emailId: string;
  eventType: "open" | "click";
  url?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface EmailStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  avgOpens: number;
}

export function generateTrackingId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function getTrackingBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function injectTracking(html: string, trackingId: string, trackingEnabled: boolean): string {
  if (!trackingEnabled || !trackingId) return html;

  const baseUrl = getTrackingBaseUrl();

  const pixelUrl = `${baseUrl}/api/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;" alt="" />`;

  let tracked = html;
  if (tracked.toLowerCase().includes("</body>")) {
    tracked = tracked.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
  tracked = tracked.replace(linkRegex, (match, url) => {
    if (url.includes("/api/track/")) return match;
    if (url.startsWith("mailto:") || url.startsWith("tel:")) return match;
    if (url.startsWith("#")) return match;

    const encodedUrl = encodeURIComponent(url);
    const clickUrl = `${baseUrl}/api/track/click/${trackingId}?url=${encodedUrl}`;
    return `href="${clickUrl}"`;
  });

  return tracked;
}

export async function recordOpen(trackingId: string, userAgent?: string, ipAddress?: string): Promise<void> {
  const emails = await query<any>(
    `SELECT id, user_id, investor_id, opened_at, open_count FROM email_messages WHERE tracking_id = $1`,
    [trackingId]
  );

  if (!emails.length) return;
  const email = emails[0];

  const now = new Date().toISOString();
  const isFirstOpen = !email.opened_at;

  await query(
    `UPDATE email_messages SET opened_at = $1, open_count = $2, status = 'opened'${isFirstOpen && ipAddress ? ", first_open_ip = '" + ipAddress + "'" : ""} WHERE id = $3`,
    [email.opened_at || now, (email.open_count || 0) + 1, email.id]
  );

  const deviceType = parseDeviceType(userAgent);
  const emailClient = parseEmailClient(userAgent);

  await query(
    `INSERT INTO email_tracking_events (email_id, user_id, investor_id, event_type, user_agent, ip_address, device_type, email_client)
     VALUES ($1, $2, $3, 'open', $4, $5, $6, $7)`,
    [email.id, email.user_id, email.investor_id, userAgent || null, ipAddress || null, deviceType, emailClient]
  );
}

export async function recordClick(trackingId: string, url: string, userAgent?: string, ipAddress?: string): Promise<void> {
  const emails = await query<any>(
    `SELECT id, user_id, investor_id, clicked_at, click_count FROM email_messages WHERE tracking_id = $1`,
    [trackingId]
  );

  if (!emails.length) return;
  const email = emails[0];

  const now = new Date().toISOString();
  const isFirstClick = !email.clicked_at;

  await query(
    `UPDATE email_messages SET clicked_at = $1, click_count = $2, status = 'clicked'${isFirstClick && ipAddress ? ", first_click_ip = '" + ipAddress + "'" : ""} WHERE id = $3`,
    [email.clicked_at || now, (email.click_count || 0) + 1, email.id]
  );

  const deviceType = parseDeviceType(userAgent);
  const emailClient = parseEmailClient(userAgent);

  await query(
    `INSERT INTO email_tracking_events (email_id, user_id, investor_id, event_type, url, user_agent, ip_address, device_type, email_client)
     VALUES ($1, $2, $3, 'click', $4, $5, $6, $7, $8)`,
    [email.id, email.user_id, email.investor_id, url, userAgent || null, ipAddress || null, deviceType, emailClient]
  );
}

export async function getEmailStats(userId: string, investorId?: string): Promise<EmailStats> {
  let sql = `SELECT id, status, open_count, click_count, opened_at, clicked_at FROM email_messages WHERE user_id = $1 AND direction = 'outbound'`;
  const params: any[] = [userId];

  if (investorId) {
    params.push(investorId);
    sql += ` AND investor_id = $${params.length}`;
  }

  const emails = await query<any>(sql, params);

  if (!emails.length) {
    return { totalSent: 0, totalOpened: 0, totalClicked: 0, openRate: 0, clickRate: 0, avgOpens: 0 };
  }

  const totalSent = emails.length;
  const totalOpened = emails.filter((e) => e.opened_at).length;
  const totalClicked = emails.filter((e) => e.clicked_at).length;
  const totalOpenCount = emails.reduce((sum, e) => sum + (e.open_count || 0), 0);

  return {
    totalSent,
    totalOpened,
    totalClicked,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
    avgOpens: totalSent > 0 ? Math.round((totalOpenCount / totalSent) * 10) / 10 : 0,
  };
}

export async function getTrackingEvents(emailId: string): Promise<Array<{
  event_type: string;
  url?: string;
  device_type?: string;
  email_client?: string;
  country?: string;
  created_at: string;
}>> {
  return query<any>(
    `SELECT event_type, url, device_type, email_client, country, created_at
     FROM email_tracking_events WHERE email_id = $1 ORDER BY created_at DESC`,
    [emailId]
  );
}

function parseDeviceType(userAgent?: string): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/i.test(ua)) return "mobile";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return "desktop";
}

function parseEmailClient(userAgent?: string): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/gmail|google/i.test(ua)) return "gmail";
  if (/outlook|Microsoft/i.test(ua)) return "outlook";
  if (/apple.*mail|applemail/i.test(ua)) return "apple_mail";
  if (/yahoo/i.test(ua)) return "yahoo";
  if (/thunderbird/i.test(ua)) return "thunderbird";
  if (/proton/i.test(ua)) return "protonmail";
  if (/android/i.test(ua)) return "android_mail";
  if (/windows.*mail/i.test(ua)) return "windows_mail";
  return "other";
}
