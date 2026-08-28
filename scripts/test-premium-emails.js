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

function hexToRgb(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null}
function withAlpha(h,a){const rgb=hexToRgb(h);return rgb?`rgba(${rgb.r},${rgb.g},${rgb.b},${a})`:h}
function isLight(h){const rgb=hexToRgb(h);return rgb?(rgb.r*299+rgb.g*587+rgb.b*114)/1000>128:true}
function darken(h,a=.15){const rgb=hexToRgb(h);if(!rgb)return h;const r=Math.max(0,Math.round(rgb.r*(1-a)));const g=Math.max(0,Math.round(rgb.g*(1-a)));const b=Math.max(0,Math.round(rgb.b*(1-a)));return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`}
function initials(n){return n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')}

const HEAD=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body,table,td,p,a,li{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}body{margin:0;padding:0;width:100%!important}@media only screen and (max-width:600px){.ec{width:100%!important}.eb{padding:28px 24px!important}.as{height:4px!important}}</style></head>`;

function generate({ subject, body: emailBody, context, branding = {} }) {
  const b = { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", ctaText: "Let's Connect", ctaUrl: null, signature: null, ...branding };
  const accent = b.accentColor;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";
  const ini = initials(b.brandName);
  const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;
  const font = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;

  const paras = emailBody.split(/\n\n+/).map(p=>p.trim()).filter(Boolean);
  const opening = paras.slice(0,2).map(p=>`<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;letter-spacing:-0.01em;font-family:${font};">${p.replace(/\n/g,'<br>')}</p>`).join('\n');
  const closing = paras.slice(2).map(p=>`<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;letter-spacing:-0.01em;font-family:${font};">${p.replace(/\n/g,'<br>')}</p>`).join('\n');

  const contextHtml = context ? `
    <div style="margin:28px 0 32px;padding:0;">
      <div style="height:2px;background:linear-gradient(to right,${accent},transparent);margin:0 0 16px;border-radius:1px;"></div>
      <p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-family:${font};">Why We're Reaching Out</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;font-family:${font};">${context}</p>
    </div>` : '';

  const html = `${HEAD}
<body style="font-family:${font};background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="ec" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      <div class="as" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>
      <div style="padding:40px 32px 32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:linear-gradient(135deg,${accent} 0%,${accentDark} 100%);border-radius:10px;margin-bottom:12px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">${ini}</span>
        </div>
        <h1 style="color:#0f172a;margin:0 0 2px;font-size:20px;font-weight:600;letter-spacing:-0.3px;font-family:${font};">${b.brandName}</h1>
        <p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:0.5px;font-family:${font};">${b.tagline}</p>
      </div>
      <div class="eb" style="padding:0 36px 36px;">
        ${opening}
        ${contextHtml}
        ${closing}
        ${b.signature ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;font-family:${font};">${b.signature.replace(/\n/g,'<br>')}</p></div>` : ''}
        ${b.ctaText ? `<div style="margin-top:28px;"><a href="${b.ctaUrl||APP_URL}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:0.2px;font-family:${font};">${b.ctaText} &rarr;</a></div>` : ''}
      </div>
      <div style="margin:0 32px;"><div style="height:1px;background:#f1f5f9;"></div></div>
      <div style="padding:24px 32px 28px;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;font-family:${font};">Sent by ${b.brandName} via Capital OS</p>
        <p style="color:#cbd5e1;font-size:11px;margin:0 0 10px;font-family:${font};">${ADDR}</p>
        <p style="color:#cbd5e1;font-size:11px;margin:0;font-family:${font};"><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/privacy" style="color:#94a3b8;">Privacy</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/terms" style="color:#94a3b8;">Terms</a></p>
      </div>
    </div>
  </div>
</body></html>`;

  const openingText = paras.slice(0,2).join('\n\n');
  const closingText = paras.slice(2).join('\n\n');
  const text = `${openingText}\n\n${context ? `[Why We're Reaching Out]\n${context}\n\n` : ''}${closingText}\n\n---\n${b.brandName} | ${b.tagline}\n\nSent via Capital OS | ${ADDR}\nUnsubscribe: ${unsubUrl}`;

  return { html, text };
}

const scenarios = [
  {
    label: "Premium — Warm Intro (Lime)",
    subject: "Your focus on enterprise SaaS caught our attention",
    context: "We matched Sequoia Capital based on: 92% fit score, Venture Capital type, focus on Enterprise, SaaS, AI. Their investment thesis and portfolio align directly with what we are building.",
    body: `Hi Roelof,

I noticed your work with Sequoia's enterprise SaaS portfolio. You've backed several companies in the workflow automation space, and that's exactly where we sit.

We're building a platform that helps startup founders raise capital by intelligently matching them with the right investors. We've hit $2M ARR with 140% net retention, and we're now raising a $12M Series A.

Given your thesis on AI-powered B2B tools, I thought this might be worth a quick look.

Would you be open to a 15-minute call this week? Happy to send our deck ahead of time.`,
    branding: { brandName: "NovaCraft", tagline: "Intelligent Workflow Automation", accentColor: "#2563eb", ctaText: "Schedule a Call", signature: "Joshua Onyekachukwu\nFounder & CEO, NovaCraft\njoshua@novacraft.io" },
  },
  {
    label: "Premium — Cold Outreach (Amber)",
    subject: "Built something I think you'd find interesting",
    context: "We matched Jason Calacanis based on: 89% fit score, Angel Investor type, focus on Consumer Tech, SaaS, AI. His track record of backing founder-led startups aligns perfectly with our early stage.",
    body: `Hi Jason,

I've been following your angel portfolio and the types of early-stage bets you take. You seem to have a good eye for founder-market fit over fancy decks.

We're a 4-person team building an AI-powered fundraising platform. Think of it as a smart assistant that finds and qualifies the right investors for your startup. No more cold-emailing 500 people hoping for a response.

We're pre-revenue but have strong early traction: 200+ waitlist signups in the first week, and two pilot customers who've agreed to pay.

I'm raising a $500K pre-seed round. If that's in your wheelhouse, I'd love to send you a one-paper.`,
    branding: { brandName: "FundMatch AI", tagline: "Smart Capital Raising", accentColor: "#f59e0b", ctaText: "Send Me the One-Pager", signature: "Joshua Onyekachukwu\nFounder, FundMatch AI" },
  },
  {
    label: "Premium — Bold Pitch (Dark)",
    subject: "50K qualified investors — we built the matching engine",
    context: "We matched Benchmark based on: 88% fit score, Venture Capital type, focus on Consumer, Enterprise Software. Their high-conviction, early-stage approach matches exactly who our platform serves best.",
    body: `Hi Eric,

50,000+ investors. 83,000+ profiles. Real data from SEC filings and venture databases. One platform that matches them to the right founders automatically.

That's what Capital OS does. We've built an AI-powered investor matching and outreach system that turns the 6-month fundraising grind into a 6-week targeted campaign.

We're raising a $3M seed round. I believe this is the kind of infrastructure play Benchmark backs — not another SaaS tool, but a category-defining platform.

If you're interested, I can have the full deck and financial model in your inbox in 10 minutes.`,
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#0f172a", ctaText: "Send Me the Deck", signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS" },
  },
];

async function send() {
  if (!SMTP_USER || !SMTP_PASS) { console.error("No SMTP"); process.exit(1); }
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  console.log(`\n📧 Sending ${scenarios.length} PREMIUM emails to ${TO}\n`);

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const { html, text } = generate(s);
    try {
      await transport.sendMail({ from: `"${s.branding.brandName}" <${EMAIL_FROM}>`, to: TO, subject: `[${s.branding.brandName}] ${s.subject}`, text, html });
      console.log(`   ✅ ${i+1}/${scenarios.length} — ${s.label}`);
      fs.writeFileSync(`scripts/premium-email-${i+1}.html`, html);
    } catch (err) { console.log(`   ❌ ${i+1}/${scenarios.length} — ${err.message}`); }
    if (i < scenarios.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`\n💾 Saved: scripts/premium-email-1.html, premium-email-2.html, premium-email-3.html\n`);
  process.exit(0);
}

send();
