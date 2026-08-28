#!/usr/bin/env node
// =============================================
// Test Live Outreach — Full Flow
// =============================================
// Simulates: investor selection → AI draft → branded template → tracking → send

require("dotenv").config({ path: ".env.local" });
const nodemailer = require("nodemailer");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
const TO = "onyekachukwujoshua39@gmail.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const ADDR = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";
const font = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;

// Color utilities
function hexToRgb(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null}
function withAlpha(h,a){const rgb=hexToRgb(h);return rgb?`rgba(${rgb.r},${rgb.g},${rgb.b},${a})`:h}
function isLight(h){const rgb=hexToRgb(h);return rgb?(rgb.r*299+rgb.g*587+rgb.b*114)/1000>128:true}
function darken(h,a=.15){const rgb=hexToRgb(h);if(!rgb)return h;const r=Math.max(0,Math.round(rgb.r*(1-a)));const g=Math.max(0,Math.round(rgb.g*(1-a)));const b=Math.max(0,Math.round(rgb.b*(1-a)));return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`}
function initials(n){return n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')}
function generateTrackingId(){const c='abcdefghijklmnopqrstuvwxyz0123456789';let id='';for(let i=0;i<16;i++)id+=c[Math.floor(Math.random()*c.length)];return id}

const HEAD=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body,table,td,p,a,li{-webkit-text-size-adjust:100%}body{margin:0;padding:0;width:100%!important}@media only screen and (max-width:600px){.ec{width:100%!important}.eb{padding:28px 24px!important}.as{height:4px!important}}</style></head>`;

function mkHeader(b, accent, accentDark) {
  const ini = initials(b.brandName);
  return `<div style="padding:40px 32px 32px;text-align:center;"><div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:linear-gradient(135deg,${accent} 0%,${accentDark} 100%);border-radius:10px;margin-bottom:12px;"><span style="color:#ffffff;font-size:18px;font-weight:700;">${ini}</span></div><h1 style="color:#0f172a;margin:0 0 2px;font-size:20px;font-weight:600;letter-spacing:-0.3px;font-family:${font};">${b.brandName}</h1><p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:0.5px;font-family:${font};">${b.tagline}</p></div>`;
}

function mkFooter(b, accent) {
  const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;
  return `<div style="margin:0 32px;"><div style="height:1px;background:#f1f5f9;"></div></div><div style="padding:24px 32px 28px;text-align:center;"><p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Sent by ${b.brandName} via Capital OS</p><p style="color:#cbd5e1;font-size:11px;margin:0 0 10px;">${ADDR}</p><p style="color:#cbd5e1;font-size:11px;margin:0;"><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/privacy" style="color:#94a3b8;">Privacy</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/terms" style="color:#94a3b8;">Terms</a></p></div>`;
}

function injectTracking(html, trackingId) {
  const pixelUrl = `${APP_URL}/api/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none!important;visibility:hidden!important;position:absolute!important;left:-9999px!important;" alt="" />`;
  let tracked = html.replace(/<\/body>/i, `${pixel}</body>`);
  // Rewrite links for click tracking
  tracked = tracked.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url) => {
    if (url.includes("/api/track/")) return match;
    if (url.startsWith("mailto:") || url.startsWith("tel:")) return match;
    const encodedUrl = encodeURIComponent(url);
    return `href="${APP_URL}/api/track/click/${trackingId}?url=${encodedUrl}"`;
  });
  return tracked;
}

function generateEmail(investor, subject, body, context, b) {
  const accent = b.accentColor;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";

  const paras = body.split(/\n\n+/).map(p=>p.trim()).filter(Boolean);
  const opening = paras.slice(0,2).map(p=>`<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">${p.replace(/\n/g,'<br>')}</p>`).join('\n');
  const closing = paras.slice(2).map(p=>`<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">${p.replace(/\n/g,'<br>')}</p>`).join('\n');

  const contextHtml = context ? `
    <div style="margin:24px 0 28px;"><div style="height:2px;background:linear-gradient(to right,${accent},transparent);margin:0 0 16px;border-radius:1px;"></div><p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">Why We're Reaching Out</p><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">${context}</p></div>` : '';

  return `${HEAD}<body style="font-family:${font};background:#f8fafc;margin:0;padding:0;"><div style="padding:32px 16px;"><div class="ec" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);"><div class="as" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>${mkHeader(b,accent,accentDark)}<div class="eb" style="padding:0 36px 36px;">${opening}${contextHtml}${closing}<div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">${b.signature.replace(/\n/g,'<br>')}</p></div><div style="margin-top:28px;"><a href="${b.ctaUrl||APP_URL}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">${b.ctaText} &rarr;</a></div></div>${mkFooter(b,accent)}</div></div></body></html>`;
}

// =============================================
// Main Test
// =============================================

async function test() {
  if (!SMTP_USER || !SMTP_PASS) { console.error("No SMTP"); process.exit(1); }

  const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch a real investor
  console.log("\n📧 Testing Full Outreach Flow\n");

  const { data: investor } = await sp
    .from("investors")
    .select("id,full_name,first_name,last_name,investor_type,fit_score,email,job_title,company_name")
    .eq("id", "8dd83c5a-6b2f-426c-8889-99e91235d30f")
    .single();

  if (!investor) { console.error("Investor not found"); process.exit(1); }
  console.log(`   1. Selected investor: ${investor.full_name} (${investor.investor_type}, ${investor.fit_score}% fit)`);

  // 2. Generate branded email content
  const subject = "Capital OS — matching founders with investors like you";
  const body = `Hi ${investor.first_name},\n\nI came across your profile and thought Capital OS might be worth a look. We help startups like yours raise faster by matching them with the right investors using AI.\n\nWe maintain a database of 83,000+ investor profiles sourced from SEC filings, venture databases, and web scraping. Our platform handles the entire fundraising workflow from investor discovery to deal close.\n\nWould you be open to a quick 15-minute call to see if this fits your current focus?`;

  const context = `We matched ${investor.full_name} based on: ${investor.fit_score}% fit score, ${investor.investor_type.replace(/_/g, ' ')} type. Their investment thesis and portfolio align with what we are building.`;

  console.log(`   2. Generated email content for ${investor.full_name}`);

  // 3. Build branded template
  const b = {
    brandName: "Capital OS",
    tagline: "AI-Powered Fundraising",
    accentColor: "#84cc16",
    ctaText: "Schedule a Call",
    ctaUrl: "https://calendly.com/joshua-capitalos",
    signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS\njoshua@capitalos.io",
  };

  const html = generateEmail(investor, subject, body, context, b);
  console.log(`   3. Built branded HTML template (${html.length} bytes)`);

  // 4. Generate tracking ID and inject tracking
  const trackingId = generateTrackingId();
  const trackedHtml = injectTracking(html, trackingId);
  console.log(`   4. Injected tracking (ID: ${trackingId})`);

  // 5. Save HTML preview
  fs.writeFileSync("scripts/live-outreach-preview.html", trackedHtml);
  console.log(`   5. Saved preview: scripts/live-outreach-preview.html`);

  // 6. Send email
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, auth: { user: SMTP_USER, pass: SMTP_PASS } });

  try {
    const info = await transport.sendMail({
      from: `"${b.brandName}" <${EMAIL_FROM}>`,
      to: TO,
      subject: `[${b.brandName}] ${subject}`,
      html: trackedHtml,
    });
    console.log(`   6. ✅ Email sent successfully!`);
    console.log(`      Message ID: ${info.messageId}`);

    // 7. Log to Supabase
    const { error } = await sp.from("email_messages").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      investor_id: investor.id,
      direction: "outbound",
      subject: `[${b.brandName}] ${subject}`,
      body_html: html,
      body_text: body,
      to_address: TO,
      status: "sent",
      sent_at: new Date().toISOString(),
      ai_generated: true,
      tracking_id: trackingId,
      open_count: 0,
      click_count: 0,
    });

    if (error) {
      console.log(`   7. ⚠️  Could not log to Supabase: ${error.message}`);
      console.log(`      (Run supabase-email-tracking.sql first)`);
    } else {
      console.log(`   7. ✅ Logged to Supabase email_messages`);
      console.log(`      Tracking ID: ${trackingId}`);
      console.log(`      Open pixel: ${APP_URL}/api/track/open/${trackingId}`);
      console.log(`      Click tracker: ${APP_URL}/api/track/click/${trackingId}?url=...`);
    }
  } catch (err) {
    console.log(`   6. ❌ Send failed: ${err.message}`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Investor: ${investor.full_name} (${investor.email})`);
  console.log(`   Fit Score: ${investor.fit_score}%`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Template: Branded (Capital OS, lime green)`);
  console.log(`   Tracking: Open pixel + click redirect`);
  console.log(`   CTA: Schedule a Call → calendly.com`);
  console.log(`\n   Check your Gmail for the email!\n`);

  process.exit(0);
}

test();
