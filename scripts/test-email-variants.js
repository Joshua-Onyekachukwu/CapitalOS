#!/usr/bin/env node
require("dotenv").config({ path: ".env.local" });
const nodemailer = require("nodemailer");
const fs = require("fs");

const TO = "onyekachukwujoshua39@gmail.com";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const ADDR = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";
const font = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;

function hexToRgb(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null}
function withAlpha(h,a){const rgb=hexToRgb(h);return rgb?`rgba(${rgb.r},${rgb.g},${rgb.b},${a})`:h}
function isLight(h){const rgb=hexToRgb(h);return rgb?(rgb.r*299+rgb.g*587+rgb.b*114)/1000>128:true}
function darken(h,a=.15){const rgb=hexToRgb(h);if(!rgb)return h;const r=Math.max(0,Math.round(rgb.r*(1-a)));const g=Math.max(0,Math.round(rgb.g*(1-a)));const b=Math.max(0,Math.round(rgb.b*(1-a)));return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`}
function initials(n){return n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')}

const HEAD=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body,table,td,p,a,li{-webkit-text-size-adjust:100%}body{margin:0;padding:0;width:100%!important}@media only screen and (max-width:600px){.ec{width:100%!important}.eb{padding:28px 24px!important}.as{height:4px!important}}</style></head>`;

function header(b, accent, accentDark) {
  const ini = initials(b.brandName);
  return `<div style="padding:40px 32px 32px;text-align:center;"><div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:linear-gradient(135deg,${accent} 0%,${accentDark} 100%);border-radius:10px;margin-bottom:12px;"><span style="color:#ffffff;font-size:18px;font-weight:700;">${ini}</span></div><h1 style="color:#0f172a;margin:0 0 2px;font-size:20px;font-weight:600;letter-spacing:-0.3px;font-family:${font};">${b.brandName}</h1><p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:0.5px;font-family:${font};">${b.tagline}</p></div>`;
}

function footer(b, accent, unsubUrl) {
  return `<div style="margin:0 32px;"><div style="height:1px;background:#f1f5f9;"></div></div><div style="padding:24px 32px 28px;text-align:center;"><p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Sent by ${b.brandName} via Capital OS</p><p style="color:#cbd5e1;font-size:11px;margin:0 0 10px;">${ADDR}</p><p style="color:#cbd5e1;font-size:11px;margin:0;"><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/privacy" style="color:#94a3b8;">Privacy</a></p></div>`;
}

function bodyP(text) { return text.split(/\n\n+/).map(p=>`<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">${p.trim().replace(/\n/g,'<br>')}</p>`).join('\n'); }

function wrap(b, accent, accentDark, content) {
  const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;
  return `${HEAD}<body style="font-family:${font};background:#f8fafc;margin:0;padding:0;"><div style="padding:32px 16px;"><div class="ec" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);"><div class="as" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>${header(b,accent,accentDark)}<div class="eb" style="padding:0 36px 36px;">${content}</div>${footer(b,accent,unsubUrl)}</div></div></body></html>`;
}

const scenarios = [
  // 1. INVESTOR INTRO
  {
    label: "1. Investor Intro",
    variant: "investor_intro",
    subject: "Introduction: NovaCraft × Sequoia Capital",
    subjectLine: `[Capital OS] Introduction: NovaCraft × Sequoia Capital`,
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", ctaText: "View Profile", signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS" },
    generate(b, accent, accentDark) {
      const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;
      const content = `
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">Hi Roelof,</p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">I'd like to introduce you to NovaCraft, a B2B SaaS platform that helps remote teams reduce operational overhead by 30%. They're currently raising a $12M Series A and have hit $2M ARR with 140% net retention.</p>
        <div style="margin:24px 0 28px;"><div style="height:2px;background:linear-gradient(to right,${accent},transparent);margin:0 0 16px;border-radius:1px;"></div><p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">The Match</p><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">92% fit score. Sequoia's focus on Enterprise SaaS and AI-powered workflow tools aligns directly with NovaCraft's product category and stage.</p></div>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">I think there could be strong alignment here. Would you be open to a brief introduction?</p>
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">Joshua Onyekachukwu<br>Founder & CEO, Capital OS</p></div>
        <div style="margin-top:28px;"><a href="${APP_URL}" style="display:inline-block;background:${accent};color:#0f172a;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">View Profile &rarr;</a></div>`;
      return wrap(b, accent, accentDark, content);
    },
  },

  // 2. PARTNERSHIP PROPOSAL
  {
    label: "2. Partnership Proposal",
    variant: "partnership",
    subject: "Partnership opportunity: Capital OS × TechStars",
    subjectLine: `[Capital OS] Partnership: Capital OS × TechStars`,
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#6366f1", ctaText: "Discuss Partnership", signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS\njoshua@capital-os.com" },
    generate(b, accent, accentDark) {
      const content = `
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">Hi Brad,</p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">I'm reaching out because I believe Capital OS could add real value to the TechStars portfolio experience. We've built an AI-powered investor matching platform that helps founders raise capital faster — and I think this could complement what you're already doing.</p>
        <div style="margin:24px 0 28px;padding:20px 24px;background:#f8fafc;border-radius:10px;border-left:3px solid ${accent};"><p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">Proposal Summary</p><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">Integrate Capital OS into the TechStars post-program experience. Every graduating cohort gets access to our 83K+ investor database, AI matching, and outreach tools — reducing the average time-to-first-close by 40%.</p></div>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">We're open to a revenue-share model, a flat licensing fee, or a custom arrangement that makes sense for both sides.</p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">Would you have 20 minutes this week to explore this?</p>
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">Joshua Onyekachukwu<br>Founder & CEO, Capital OS<br>joshua@capital-os.com</p></div>
        <div style="margin-top:28px;"><a href="${APP_URL}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Discuss Partnership &rarr;</a></div>`;
      return wrap(b, accent, accentDark, content);
    },
  },

  // 3. EVENT INVITATION
  {
    label: "3. Event Invitation",
    variant: "event_invite",
    subject: "You're invited: Capital OS Launch Demo Day",
    subjectLine: `[Capital OS] You're Invited: Launch Demo Day`,
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#f59e0b", ctaText: "Register Now", signature: "The Capital OS Team" },
    generate(b, accent, accentDark) {
      const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;
      const pills = [`<span style="display:inline-block;background:${withAlpha(accent,0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">Sept 15, 2026</span>`, `<span style="display:inline-block;background:${withAlpha(accent,0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">2:00 PM EST</span>`, `<span style="display:inline-block;background:${withAlpha(accent,0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">Virtual (Zoom)</span>`];
      const content = `
        <div style="text-align:center;margin:0 0 24px;padding:20px 24px;background:linear-gradient(135deg,${withAlpha(accent,0.06)} 0%,${withAlpha(accent,0.02)} 100%);border-radius:10px;"><p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">You're Invited</p><h2 style="color:#0f172a;margin:0 0 12px;font-size:18px;font-weight:600;">Capital OS Launch Demo Day</h2><div>${pills.join('')}</div></div>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">We're hosting our first live demo day to show how Capital OS is changing the way founders raise capital.</p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">You'll see a live walkthrough of the platform, hear from early users, and get a chance to ask questions directly to the founding team.</p>
        <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">Seats are limited to 100 attendees. If you're interested in what we're building, I'd love to have you there.</p>
        <div style="text-align:center;margin:28px 0 0;"><a href="${APP_URL}" style="display:inline-block;background:${accent};color:#0f172a;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">Register Now &rarr;</a></div>
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">The Capital OS Team</p></div>`;
      return wrap(b, accent, accentDark, content);
    },
  },

  // 4. NEWSLETTER
  {
    label: "4. Newsletter",
    variant: "newsletter",
    subject: "Capital OS Weekly: What's New",
    subjectLine: `[Capital OS] Weekly Update`,
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", ctaText: "Visit Dashboard", ctaUrl: APP_URL + "/dashboard", signature: "" },
    generate(b, accent, accentDark) {
      const content = `
        <h2 style="color:#0f172a;margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:-0.3px;line-height:1.3;font-family:${font};">This Week at Capital OS</h2>
        <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9;"><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">83,000+ Investors Now in Database</h3><p style="color:#64748b;margin:0 0 8px;font-size:14px;line-height:1.6;">We've crossed a major milestone. Our investor database now includes profiles from SEC filings, venture directories, and web scraping.</p><a href="${APP_URL}/dashboard/investors" style="color:${accent};font-size:13px;font-weight:600;text-decoration:none;">Browse investors &rarr;</a></div>
        <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9;"><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">AI Copilot Now Available</h3><p style="color:#64748b;margin:0 0 8px;font-size:14px;line-height:1.6;">Ask your AI copilot anything about your investor database, pipeline, or fundraising strategy. It has full context on your startup.</p><a href="${APP_URL}/dashboard/copilot" style="color:${accent};font-size:13px;font-weight:600;text-decoration:none;">Try it now &rarr;</a></div>
        <div style="margin-bottom:0;"><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">Branded Email Templates</h3><p style="color:#64748b;margin:0 0 0;font-size:14px;line-height:1.6;">Every email you send through Capital OS now includes your company branding, logo, and a professional HTML template.</p></div>
        <div style="text-align:center;margin:28px 0 0;"><a href="${APP_URL}/dashboard" style="display:inline-block;background:${accent};color:#0f172a;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Visit Dashboard &rarr;</a></div>`;
      return wrap(b, accent, accentDark, content);
    },
  },
];

async function send() {
  if (!SMTP_USER || !SMTP_PASS) { console.error("No SMTP"); process.exit(1); }
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  console.log(`\n📧 Sending ${scenarios.length} email variants to ${TO}\n`);

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const b = { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", ctaText: "Let's Connect", ctaUrl: null, signature: null, ...s.branding };
    const accent = b.accentColor;
    const accentDark = darken(accent, 0.2);
    const html = s.generate(b, accent, accentDark);

    try {
      await transport.sendMail({ from: `"${b.brandName}" <${EMAIL_FROM}>`, to: TO, subject: s.subjectLine, html });
      console.log(`   ✅ ${i+1}/${scenarios.length} — ${s.label}`);
      fs.writeFileSync(`scripts/variant-${s.variant}.html`, html);
    } catch (err) { console.log(`   ❌ ${i+1}/${scenarios.length} — ${err.message}`); }
    if (i < scenarios.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`\n💾 Saved: scripts/variant-investor_intro.html, variant-partnership.html, variant-event_invite.html, variant-newsletter.html\n`);
  process.exit(0);
}

send();
