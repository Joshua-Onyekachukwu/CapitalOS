#!/usr/bin/env node
// =============================================
// Test Branded Emails V2 — Context in the MIDDLE
// =============================================

require("dotenv").config({ path: ".env.local" });
const nodemailer = require("nodemailer");
const fs = require("fs");

const TO = "onyekachukwujoshua39@gmail.com";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const COMPANY_ADDRESS = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";

// Color utilities
function hexToRgb(hex) { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null; }
function withAlpha(hex, a) { const rgb = hexToRgb(hex); return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${a})` : hex; }
function isLight(hex) { const rgb = hexToRgb(hex); return rgb ? (rgb.r*299+rgb.g*587+rgb.b*114)/1000 > 128 : true; }
function darken(hex, amt=0.15) { const rgb = hexToRgb(hex); if(!rgb) return hex; const r=Math.max(0,Math.round(rgb.r*(1-amt))); const g=Math.max(0,Math.round(rgb.g*(1-amt))); const b=Math.max(0,Math.round(rgb.b*(1-amt))); return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`; }
function getInitials(name) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''); }

const EMAIL_HEAD = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body,table,td,p,a,li{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}body{margin:0;padding:0;width:100%!important}@media only screen and (max-width:600px){.email-container{width:100%!important}.email-body{padding:24px 20px!important}}</style></head>`;

function generate({ subject, emailBody, context, branding = {} }) {
  const b = { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", logoUrl: null, ctaText: "Let's Connect", ctaUrl: null, signature: null, ...branding };
  const accent = b.accentColor;
  const accentDark = darken(accent);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const initials = getInitials(b.brandName);
  const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;

  // Split body: first 2 paragraphs = opening, rest = closing
  const paras = emailBody.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const opening = paras.slice(0, 2).map(p => `<p style="color:#374151;line-height:1.75;margin:0 0 16px;font-size:15px;">${p.replace(/\n/g,'<br>')}</p>`).join('\n');
  const closing = paras.slice(2).map(p => `<p style="color:#374151;line-height:1.75;margin:0 0 16px;font-size:15px;">${p.replace(/\n/g,'<br>')}</p>`).join('\n');

  // Context box — in the MIDDLE
  const contextHtml = context ? `
    <div style="background:${withAlpha(accent,0.06)};border:1px solid ${withAlpha(accent,0.15)};border-radius:12px;padding:20px 24px;margin:0 0 28px;">
      <p style="color:${accentDark};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 6px;">Why We're Reaching Out</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${context}</p>
    </div>` : '';

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f3f4f6;margin:0;padding:40px 16px;">
  <div class="email-container" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${accent} 0%,${accentDark} 100%);padding:36px 32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:${withAlpha(textColor,0.2)};border-radius:14px;margin-bottom:12px;">
        <span style="color:${textColor};font-size:22px;font-weight:700;letter-spacing:-0.5px;">${initials}</span>
      </div>
      <h1 style="color:${textColor};margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px;">${b.brandName}</h1>
      <p style="color:${withAlpha(textColor,0.75)};margin:4px 0 0;font-size:13px;">${b.tagline}</p>
    </div>
    <div class="email-body" style="padding:36px 32px;">
      ${opening}
      ${contextHtml}
      ${closing}
      ${b.signature ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #f0f0f0;"><p style="color:#374151;line-height:1.6;margin:0;font-size:14px;">${b.signature.replace(/\n/g,'<br>')}</p></div>` : ''}
      ${b.ctaText ? `<div style="text-align:center;margin:28px 0 0;"><a href="${b.ctaUrl||APP_URL}" style="display:inline-block;background:${accent};color:${textColor};padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none;">${b.ctaText} &rarr;</a></div>` : ''}
    </div>
    <div style="height:1px;background:linear-gradient(to right,transparent,${withAlpha(accent,0.3)},transparent);margin:0 32px;"></div>
    <div style="background:#fafafa;padding:24px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">Sent by ${b.brandName} via Capital OS</p>
      <p style="color:#9ca3af;font-size:11px;margin:0 0 8px;">${COMPANY_ADDRESS}</p>
      <p style="color:#9ca3af;font-size:11px;margin:0;"><a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot; <a href="${APP_URL}/privacy" style="color:#9ca3af;">Privacy</a> &middot; <a href="${APP_URL}/terms" style="color:#9ca3af;">Terms</a></p>
    </div>
  </div>
</body></html>`;

  // Plain text
  const openingText = paras.slice(0,2).join('\n\n');
  const closingText = paras.slice(2).join('\n\n');
  const text = `${openingText}\n\n${context ? `[Why We're Reaching Out]\n${context}\n\n` : ''}${closingText}\n\n---\n${b.brandName} | ${b.tagline}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;

  return { html, text };
}

// =============================================
// Test Scenarios
// =============================================

const scenarios = [
  {
    label: "Startup Founder → VC (Warm, Middle Context)",
    subject: "Your focus on enterprise SaaS caught our attention",
    context: "We matched Sequoia Capital based on: 92% fit score, Venture Capital type, focus on Enterprise, SaaS, AI, invests at Series A & B stage, typical check: $5M-$20M. Their investment thesis and portfolio align with what we are building.",
    body: `Hi Roelof,

I noticed your work with Sequoia's enterprise SaaS portfolio. You've backed several companies in the workflow automation space, and that's exactly where we sit.

We're building a platform that helps startup founders raise capital by intelligently matching them with the right investors. We've hit $2M ARR with 140% net retention, and we're now raising a $12M Series A.

Given your thesis on AI-powered B2B tools, I thought this might be worth a quick look.

Would you be open to a 15-minute call this week? Happy to send our deck ahead of time.`,
    branding: {
      brandName: "NovaCraft",
      tagline: "Intelligent Workflow Automation",
      accentColor: "#2563eb",
      ctaText: "Schedule a Call",
      signature: "Joshua Onyekachukwu\nFounder & CEO, NovaCraft\njoshua@novacraft.io",
    },
  },
  {
    label: "Startup Founder → Angel (Casual, Middle Context)",
    subject: "Built something I think you'd find interesting",
    context: "We matched Jason Calacanis based on: 89% fit score, Angel Investor type, focus on Consumer Tech, SaaS, AI, invests at Pre-Seed & Seed stage, typical check: $25K-$100K. His track record of backing founder-led startups aligns with our early stage.",
    body: `Hi Jason,

I've been following your angel portfolio and the types of early-stage bets you take. You seem to have a good eye for founder-market fit over fancy decks.

We're a 4-person team building an AI-powered fundraising platform. Think of it as a smart assistant that finds and qualifies the right investors for your startup. No more cold-emailing 500 people hoping for a response.

We're pre-revenue but have strong early traction: 200+ waitlist signups in the first week, and two pilot customers who've agreed to pay.

I'm raising a $500K pre-seed round. If that's in your wheelhouse, I'd love to send you a one-pager.`,
    branding: {
      brandName: "FundMatch AI",
      tagline: "Smart Capital Raising",
      accentColor: "#f59e0b",
      ctaText: "Send Me the One-Pager",
      signature: "Joshua Onyekachukwu\nFounder, FundMatch AI",
    },
  },
  {
    label: "Investor Outreach → Seed Round (Professional, Middle Context)",
    subject: "AI matching 200+ investors to your portfolio thesis",
    context: "We matched Founders Fund based on: 85% fit score, Venture Capital type, focus on Deep Tech, AI, Infrastructure, invests at Series A & B stage. Our platform directly addresses how their team sources and evaluates deal flow.",
    body: `Hi Keith,

I wanted to share something we're building that I think could reshape how your fund sources deal flow.

Capital OS is an AI-powered platform that automatically matches startups with investors based on investment thesis, stage, sector, and check size. We've built a database of 83,000+ investor profiles sourced from SEC filings, venture databases, and web scraping.

We're raising a $3M seed round to scale the platform. Given Founders Fund's focus on deep tech infrastructure, I think this could be relevant both as an investment and as a tool your team might want to use.

Worth a quick conversation?`,
    branding: {
      brandName: "Capital OS",
      tagline: "AI-Powered Fundraising",
      accentColor: "#84cc16",
      ctaText: "Let's Connect",
      signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS",
    },
  },
  {
    label: "Investor Outreach → Bold Pitch (Dark Theme, Middle Context)",
    subject: "50K qualified investors — we built the matching engine",
    context: "We matched Benchmark based on: 88% fit score, Venture Capital type, focus on Consumer, Enterprise Software, invests at Seed & Series A stage. Their high-conviction, early-stage approach matches exactly who our platform serves best.",
    body: `Hi Eric,

50,000+ investors. 83,000+ profiles. Real data from SEC filings and venture databases. One platform that matches them to the right founders automatically.

That's what Capital OS does. We've built an AI-powered investor matching and outreach system that turns the 6-month fundraising grind into a 6-week targeted campaign.

We're raising a $3M seed round. I believe this is the kind of infrastructure play Benchmark backs — not another SaaS tool, but a category-defining platform.

If you're interested, I can have the full deck and financial model in your inbox in 10 minutes.`,
    branding: {
      brandName: "Capital OS",
      tagline: "AI-Powered Fundraising",
      accentColor: "#1a1a1a",
      ctaText: "Send Me the Deck",
      signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS",
    },
  },
];

// =============================================
// Send
// =============================================

async function send() {
  if (!SMTP_USER || !SMTP_PASS) { console.error("❌ No SMTP credentials"); process.exit(1); }

  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, auth: { user: SMTP_USER, pass: SMTP_PASS } });

  console.log(`\n📧 Sending ${scenarios.length} branded emails (V2 — context in middle) to ${TO}\n`);

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const { html, text } = generate({ subject: s.subject, emailBody: s.body, context: s.context, branding: s.branding });
    try {
      const info = await transport.sendMail({ from: `"${s.branding.brandName}" <${EMAIL_FROM}>`, to: TO, subject: `[${s.branding.brandName}] ${s.subject}`, text, html });
      console.log(`   ✅ ${i+1}/${scenarios.length} — ${s.label}`);
      console.log(`      Brand: ${s.branding.brandName} (${s.branding.accentColor})\n`);
    } catch (err) {
      console.log(`   ❌ ${i+1}/${scenarios.length} — ${err.message}\n`);
    }
    if (i < scenarios.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Save HTML previews
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const { html } = generate({ subject: s.subject, emailBody: s.body, context: s.context, branding: s.branding });
    fs.writeFileSync(`scripts/test-email-v2-${i+1}.html`, html);
  }
  console.log(`💾 Saved 4 HTML previews: scripts/test-email-v2-1.html through test-email-v2-4.html\n`);

  process.exit(0);
}

send();
