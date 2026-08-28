// =============================================
// Email Tracking Service (Supabase)
// =============================================
// Tracks opens, clicks, and replies for branded emails.
// Uses Supabase instead of CockroachDB.

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getTrackingBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
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
// Inject Tracking into HTML
// =============================================

export function injectTracking(
  html: string,
  trackingId: string,
  trackingEnabled: boolean
): string {
  if (!trackingEnabled || !trackingId) return html;

  const baseUrl = getTrackingBaseUrl();

  // Inject open pixel before </body>
  const pixelUrl = `${baseUrl}/api/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;" alt="" />`;

  let tracked = html;
  if (tracked.toLowerCase().includes("</body>")) {
    tracked = tracked.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  // Rewrite links to go through click tracker
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

// =============================================
// Record Open
// =============================================

export async function recordOpen(
  trackingId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const sp = getSp();

  const { data: email } = await sp
    .from("email_messages")
    .select("id, user_id, investor_id, opened_at, open_count")
    .eq("tracking_id", trackingId)
    .single();

  if (!email) return;

  const now = new Date().toISOString();
  const isFirstOpen = !email.opened_at;

  await sp
    .from("email_messages")
    .update({
      opened_at: email.opened_at || now,
      open_count: (email.open_count || 0) + 1,
      status: "opened",
    })
    .eq("id", email.id);

  // Record event
  const deviceType = parseDeviceType(userAgent);
  const emailClient = parseEmailClient(userAgent);

  await sp.from("email_tracking_events").insert({
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
// Record Click
// =============================================

export async function recordClick(
  trackingId: string,
  url: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const sp = getSp();

  const { data: email } = await sp
    .from("email_messages")
    .select("id, user_id, investor_id, clicked_at, click_count")
    .eq("tracking_id", trackingId)
    .single();

  if (!email) return;

  const now = new Date().toISOString();

  await sp
    .from("email_messages")
    .update({
      clicked_at: email.clicked_at || now,
      click_count: (email.click_count || 0) + 1,
      status: "clicked",
    })
    .eq("id", email.id);

  const deviceType = parseDeviceType(userAgent);
  const emailClient = parseEmailClient(userAgent);

  await sp.from("email_tracking_events").insert({
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
// Record Reply
// =============================================

export async function recordReply(
  userId: string,
  investorId: string,
  subject: string,
  bodyText: string
): Promise<void> {
  const sp = getSp();

  // Find the most recent outbound email to this investor
  const { data: lastEmail } = await sp
    .from("email_messages")
    .select("id")
    .eq("user_id", userId)
    .eq("investor_id", investorId)
    .eq("direction", "outbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .single();

  if (lastEmail) {
    // Mark the original email as replied
    await sp
      .from("email_messages")
      .update({
        status: "replied",
        reply_detected_at: new Date().toISOString(),
      })
      .eq("id", lastEmail.id);
  }

  // Insert the reply as an inbound email
  await sp.from("email_messages").insert({
    user_id: userId,
    investor_id: investorId,
    direction: "inbound",
    subject,
    body_text: bodyText,
    status: "replied",
    sent_at: new Date().toISOString(),
    ai_generated: false,
  });
}

// =============================================
// Get Email Stats
// =============================================

export interface EmailStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  avgOpens: number;
  avgClicks: number;
}

export async function getEmailStats(
  userId: string,
  investorId?: string
): Promise<EmailStats> {
  const sp = getSp();

  let query = sp
    .from("email_messages")
    .select("id, status, open_count, click_count, opened_at, clicked_at, reply_detected_at, bounced_at")
    .eq("user_id", userId)
    .eq("direction", "outbound");

  if (investorId) {
    query = query.eq("investor_id", investorId);
  }

  const { data: emails } = await query;

  if (!emails || emails.length === 0) {
    return {
      totalSent: 0, totalOpened: 0, totalClicked: 0, totalReplied: 0,
      totalBounced: 0, openRate: 0, clickRate: 0, replyRate: 0,
      bounceRate: 0, avgOpens: 0, avgClicks: 0,
    };
  }

  const totalSent = emails.length;
  const totalOpened = emails.filter((e) => e.opened_at).length;
  const totalClicked = emails.filter((e) => e.clicked_at).length;
  const totalReplied = emails.filter((e) => e.reply_detected_at).length;
  const totalBounced = emails.filter((e) => e.bounced_at).length;
  const totalOpenCount = emails.reduce((sum, e) => sum + (e.open_count || 0), 0);
  const totalClickCount = emails.reduce((sum, e) => sum + (e.click_count || 0), 0);

  return {
    totalSent,
    totalOpened,
    totalClicked,
    totalReplied,
    totalBounced,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
    replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
    bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0,
    avgOpens: totalSent > 0 ? Math.round((totalOpenCount / totalSent) * 10) / 10 : 0,
    avgClicks: totalSent > 0 ? Math.round((totalClickCount / totalSent) * 10) / 10 : 0,
  };
}

// =============================================
// Get Tracking Events
// =============================================

export async function getTrackingEvents(emailId: string) {
  const sp = getSp();

  const { data } = await sp
    .from("email_tracking_events")
    .select("event_type, url, device_type, email_client, country, created_at")
    .eq("email_id", emailId)
    .order("created_at", { ascending: false });

  return data || [];
}

// =============================================
// Get Per-Investor Stats
// =============================================

export async function getInvestorEmailStats(userId: string) {
  const sp = getSp();

  const { data: emails } = await sp
    .from("email_messages")
    .select("investor_id, status, open_count, click_count, opened_at, clicked_at, reply_detected_at")
    .eq("user_id", userId)
    .eq("direction", "outbound");

  if (!emails || emails.length === 0) return [];

  // Group by investor
  const byInvestor = new Map<string, any[]>();
  for (const e of emails) {
    if (!e.investor_id) continue;
    if (!byInvestor.has(e.investor_id)) byInvestor.set(e.investor_id, []);
    byInvestor.get(e.investor_id)!.push(e);
  }

  const investorIds = [...byInvestor.keys()];
  if (investorIds.length === 0) return [];

  // Fetch investor names
  const { data: investors } = await sp
    .from("investors")
    .select("id, first_name, last_name, fit_score")
    .in("id", investorIds);

  const invMap = new Map((investors || []).map((i) => [i.id, i]));

  return [...byInvestor.entries()].map(([id, emails]) => {
    const inv = invMap.get(id);
    const sent = emails.length;
    const opened = emails.filter((e) => e.opened_at).length;
    const clicked = emails.filter((e) => e.clicked_at).length;
    const replied = emails.filter((e) => e.reply_detected_at).length;

    return {
      investorId: id,
      name: inv ? `${inv.first_name} ${inv.last_name}` : "Unknown",
      fitScore: inv?.fit_score || 0,
      sent,
      opened,
      clicked,
      replied,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      lastActivity: emails.sort((a, b) =>
        (b.opened_at || b.clicked_at || "").localeCompare(a.opened_at || a.clicked_at || "")
      )[0]?.opened_at || emails[0]?.clicked_at || null,
    };
  }).sort((a, b) => b.sent - a.sent);
}

// =============================================
// Helpers
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
  if (/outlook|microsoft/i.test(ua)) return "outlook";
  if (/apple.*mail|applemail/i.test(ua)) return "apple_mail";
  if (/yahoo/i.test(ua)) return "yahoo";
  if (/thunderbird/i.test(ua)) return "thunderbird";
  if (/proton/i.test(ua)) return "protonmail";
  if (/android/i.test(ua)) return "android_mail";
  return "other";
}
