// =============================================
// Email Tracking Service
// =============================================
// Generates tracking IDs, injects pixels/links,
// and records open/click events.

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

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

// =============================================
// Generate Tracking ID
// =============================================

export function generateTrackingId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// =============================================
// Get Tracking Base URL
// =============================================

function getTrackingBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// =============================================
// Inject Tracking into HTML
// =============================================

export function injectTracking(
  html: string,
  trackingId: string,
  trackingEnabled: boolean
): string {
  if (!trackingEnabled || !trackingId) return html;

  const baseUrl = getTrackingBaseUrl();

  // 1. Inject tracking pixel (1x1 transparent GIF)
  const pixelUrl = `${baseUrl}/api/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;" alt="" />`;

  // Insert pixel before </body> or at end
  let tracked = html;
  if (tracked.toLowerCase().includes("</body>")) {
    tracked = tracked.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  // 2. Rewrite links to go through click tracker
  const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
  tracked = tracked.replace(linkRegex, (match, url) => {
    // Skip tracking pixel and already-tracked links
    if (url.includes("/api/track/")) return match;
    // Skip mailto: and tel: links
    if (url.startsWith("mailto:") || url.startsWith("tel:")) return match;
    // Skip anchor links
    if (url.startsWith("#")) return match;

    const encodedUrl = encodeURIComponent(url);
    const clickUrl = `${baseUrl}/api/track/click/${trackingId}?url=${encodedUrl}`;
    return `href="${clickUrl}"`;
  });

  return tracked;
}

// =============================================
// Record Open Event
// =============================================

export async function recordOpen(
  trackingId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the email by tracking_id
  const { data: email } = await supabase
    .from("email_messages")
    .select("id, user_id, investor_id, opened_at, open_count")
    .eq("tracking_id", trackingId)
    .single();

  if (!email) return;

  // Update email_messages
  const now = new Date().toISOString();
  const isFirstOpen = !email.opened_at;

  await supabase
    .from("email_messages")
    .update({
      opened_at: email.opened_at || now,
      open_count: (email.open_count || 0) + 1,
      status: "opened",
      ...(isFirstOpen && ipAddress ? { first_open_ip: ipAddress } : {}),
    })
    .eq("id", email.id);

  // Parse user agent for device/client info
  const deviceType = parseDeviceType(userAgent);
  const emailClient = parseEmailClient(userAgent);

  // Log the event
  await supabase.from("email_tracking_events").insert({
    email_id: email.id,
    user_id: email.user_id,
    investor_id: email.investor_id,
    event_type: "open",
    user_agent: userAgent || null,
    ip_address: ipAddress || null,
    device_type: deviceType,
    email_client: emailClient,
  });
}

// =============================================
// Record Click Event
// =============================================

export async function recordClick(
  trackingId: string,
  url: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: email } = await supabase
    .from("email_messages")
    .select("id, user_id, investor_id, clicked_at, click_count")
    .eq("tracking_id", trackingId)
    .single();

  if (!email) return;

  const now = new Date().toISOString();
  const isFirstClick = !email.clicked_at;

  await supabase
    .from("email_messages")
    .update({
      clicked_at: email.clicked_at || now,
      click_count: (email.click_count || 0) + 1,
      status: "clicked",
      ...(isFirstClick && ipAddress ? { first_click_ip: ipAddress } : {}),
    })
    .eq("id", email.id);

  const deviceType = parseDeviceType(userAgent);
  const emailClient = parseEmailClient(userAgent);

  await supabase.from("email_tracking_events").insert({
    email_id: email.id,
    user_id: email.user_id,
    investor_id: email.investor_id,
    event_type: "click",
    url,
    user_agent: userAgent || null,
    ip_address: ipAddress || null,
    device_type: deviceType,
    email_client: emailClient,
  });
}

// =============================================
// Get Email Stats
// =============================================

export async function getEmailStats(
  userId: string,
  investorId?: string
): Promise<EmailStats> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from("email_messages")
    .select("id, status, open_count, click_count, opened_at, clicked_at")
    .eq("user_id", userId)
    .eq("direction", "outbound");

  if (investorId) {
    query = query.eq("investor_id", investorId);
  }

  const { data: emails } = await query;

  if (!emails || emails.length === 0) {
    return { totalSent: 0, totalOpened: 0, totalClicked: 0, openRate: 0, clickRate: 0, avgOpens: 0 };
  }

  const totalSent = emails.length;
  const totalOpened = emails.filter((e) => e.opened_at).length;
  const totalClicked = emails.filter((e) => (e as any).clicked_at).length;
  const totalOpenCount = emails.reduce((sum, e) => sum + ((e as any).open_count || 0), 0);

  return {
    totalSent,
    totalOpened,
    totalClicked,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
    avgOpens: totalSent > 0 ? Math.round((totalOpenCount / totalSent) * 10) / 10 : 0,
  };
}

// =============================================
// Get Tracking Events
// =============================================

export async function getTrackingEvents(
  emailId: string
): Promise<Array<{
  event_type: string;
  url?: string;
  device_type?: string;
  email_client?: string;
  country?: string;
  created_at: string;
}>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: events } = await supabase
    .from("email_tracking_events")
    .select("event_type, url, device_type, email_client, country, created_at")
    .eq("email_id", emailId)
    .order("created_at", { ascending: false });

  return events || [];
}

// =============================================
// Device/Client Detection
// =============================================

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
