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

function mkHeader(b, accent, accentDark) {
  const ini = initials(b.brandName);
  return `<div style="padding:40px 32px 32px;text-align:center;"><div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:linear-gradient(135deg,${accent} 0%,${accentDark} 100%);border-radius:10px;margin-bottom:12px;"><span style="color:#ffffff;font-size:18px;font-weight:700;">${ini}</span></div><h1 style="color:#0f172a;margin:0 0 2px;font-size:20px;font-weight:600;letter-spacing:-0.3px;font-family:${font};">${b.brandName}</h1><p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:0.5px;font-family:${font};">${b.tagline}</p></div>`;
}

function mkFooter(b, accent) {
  const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;
  return `<div style="margin:0 32px;"><div style="height:1px;background:#f1f5f9;"></div></div><div style="padding:24px 32px 28px;text-align:center;"><p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Sent by ${b.brandName} via Capital OS</p><p style="color:#cbd5e1;font-size:11px;margin:0 0 10px;">${ADDR}</p><p style="color:#cbd5e1;font-size:11px;margin:0;"><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/privacy" style="color:#94a3b8;">Privacy</a> <span style="color:#e2e8f0;margin:0 6px;">·</span> <a href="${APP_URL}/terms" style="color:#94a3b8;">Terms</a></p></div>`;
}

function mkBody(html) { return `<div class="eb" style="padding:0 36px 36px;">${html}</div>`; }

function wrap(b, accent, accentDark, bodyHtml) {
  return `${HEAD}<body style="font-family:${font};background:#f8fafc;margin:0;padding:0;"><div style="padding:32px 16px;"><div class="ec" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);"><div class="as" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>${mkHeader(b,accent,accentDark)}${mkBody(bodyHtml)}${mkFooter(b,accent)}</div></div></body></html>`;
}

function p(text) { return text.split(/\n\n+/).map(t=>`<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;font-family:${font};">${t.trim().replace(/\n/g,'<br>')}</p>`).join('\n'); }

function contextBox(accent, accentDark, text) {
  return `<div style="margin:24px 0 28px;"><div style="height:2px;background:linear-gradient(to right,${accent},transparent);margin:0 0 16px;border-radius:1px;"></div><p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">Why We're Reaching Out</p><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">${text}</p></div>`;
}

function sig(name, title, company, email) {
  return `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">${name}<br>${title}${company ? `, ${company}` : ""}${email ? `<br>${email}` : ""}</p></div>`;
}

function cta(accent, text, url) {
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";
  return `<div style="margin-top:28px;"><a href="${url || APP_URL}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">${text} &rarr;</a></div>`;
}

function pill(accent, accentDark, text) {
  return `<span style="display:inline-block;background:${withAlpha(accent,0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">${text}</span>`;
}

// =============================================
// 5 SCENARIOS
// =============================================

const scenarios = [
  // 1. WARM INTRO TO VC (Outreach template, Lime)
  {
    label: "1. Warm Intro to VC (Outreach)",
    subject: "Your focus on enterprise SaaS caught our attention",
    subjectLine: "[NovaCraft] Your focus on enterprise SaaS caught our attention",
    branding: { brandName: "NovaCraft", tagline: "Intelligent Workflow Automation", accentColor: "#2563eb", ctaText: "Schedule a Call", ctaUrl: "https://calendly.com/joshua-novacraft" },
    body(b, accent, accentDark) {
      return wrap(b, accent, accentDark,
        p("Hi Roelof,") +
        p("I noticed your work with Sequoia's enterprise SaaS portfolio. You've backed several companies in the workflow automation space, and that's exactly where we sit.") +
        contextBox(accent, accentDark, "We matched you based on: 92% fit score, Venture Capital type, focus on Enterprise, SaaS, AI. Your investment thesis and portfolio align directly with what we are building.") +
        p("We're building a platform that helps startup founders raise capital by intelligently matching them with the right investors. We've hit $2M ARR with 140% net retention, and we're now raising a $12M Series A.") +
        p("Given your thesis on AI-powered B2B tools, I thought this might be worth a quick look. Would you be open to a 15-minute call this week?") +
        sig("Joshua Onyekachukwu", "Founder & CEO", "NovaCraft", "joshua@novacraft.io") +
        cta(accent, "Schedule a Call", "https://calendly.com/joshua-novacraft")
      );
    },
  },

  // 2. COLD OUTREACH TO ANGEL (Outreach template, Amber)
  {
    label: "2. Cold Outreach to Angel (Outreach)",
    subject: "Built something I think you'd find interesting",
    subjectLine: "[FundMatch AI] Built something I think you'd find interesting",
    branding: { brandName: "FundMatch AI", tagline: "Smart Capital Raising", accentColor: "#f59e0b", ctaText: "Send Me the One-Pager" },
    body(b, accent, accentDark) {
      return wrap(b, accent, accentDark,
        p("Hi Jason,") +
        p("I've been following your angel portfolio and the types of early-stage bets you take. You seem to have a good eye for founder-market fit over fancy decks.") +
        contextBox(accent, accentDark, "We matched you based on: 89% fit score, Angel Investor type, focus on Consumer Tech, SaaS, AI. Your track record of backing founder-led startups aligns perfectly with our early stage.") +
        p("We're a 4-person team building an AI-powered fundraising platform. Think of it as a smart assistant that finds and qualifies the right investors for your startup. No more cold-emailing 500 people hoping for a response.") +
        p("We're pre-revenue but have strong early traction: 200+ waitlist signups in the first week, and two pilot customers who've agreed to pay. I'm raising a $500K pre-seed round.") +
        sig("Joshua Onyekachukwu", "Founder", "FundMatch AI", "joshua@fundmatch.ai") +
        cta(accent, "Send Me the One-Paper")
      );
    },
  },

  // 3. INVESTOR INTRO (Investor Intro template, Purple)
  {
    label: "3. Investor Intro (Introduction)",
    subject: "Introduction: NeuralDeploy × Andreessen Horowitz",
    subjectLine: "[Capital OS] Introduction: NeuralDeploy × a16z",
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#7c3aed", ctaText: "View Profile" },
    body(b, accent, accentDark) {
      return wrap(b, accent, accentDark,
        p("Hi Renée,") +
        p("I'd like to introduce you to NeuralDeploy, a late-stage startup in the AI infrastructure space. They help companies deploy and manage machine learning models in production, processing 50M+ inference requests per month for 200+ enterprise customers.") +
        contextBox(accent, accentDark, "95% fit score. a16z's track record with companies like Weights & Biases and Scale AI makes this a strong match. NeuralDeploy is raising a $40M Series C to expand internationally.") +
        p("They're exactly the kind of infrastructure play that a16z has backed successfully before. Would you be open to a brief introduction?") +
        sig("Joshua Onyekachukwu", "Founder & CEO", "Capital OS", "joshua@capital-os.com") +
        cta(accent, "View Profile", `${APP_URL}/dashboard/investors`)
      );
    },
  },

  // 4. EVENT INVITATION (Event template, Lime)
  {
    label: "4. Event Invitation (Demo Day)",
    subject: "You're invited: Capital OS Launch Demo Day",
    subjectLine: "[Capital OS] You're Invited: Launch Demo Day",
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", ctaText: "Register Now" },
    body(b, accent, accentDark) {
      return `<div style="text-align:center;margin:0 0 24px;padding:20px 24px;background:linear-gradient(135deg,${withAlpha(accent,0.06)} 0%,${withAlpha(accent,0.02)} 100%);border-radius:10px;"><p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">You're Invited</p><h2 style="color:#0f172a;margin:0 0 12px;font-size:18px;font-weight:600;">Capital OS Launch Demo Day</h2><div>${pill(accent,accentDark,"Sept 15, 2026")}${pill(accent,accentDark,"2:00 PM EST")}${pill(accent,accentDark,"Virtual (Zoom)")}</div></div>` +
        p("We're hosting our first live demo day to show how Capital OS is changing the way founders raise capital.") +
        p("You'll see a live walkthrough of the platform, hear from early users, and get a chance to ask questions directly to the founding team.") +
        p("Seats are limited to 100 attendees. If you're interested in what we're building, I'd love to have you there.") +
        `<div style="text-align:center;margin:28px 0 0;"><a href="${APP_URL}" style="display:inline-block;background:${accent};color:#0f172a;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">Register Now &rarr;</a></div>` +
        sig("The Capital OS Team", "", "", "");
    },
  },

  // 5. NEWSLETTER (Newsletter template, Dark)
  {
    label: "5. Newsletter (Weekly Update)",
    subject: "Capital OS Weekly: What's New",
    subjectLine: "[Capital OS] Weekly Update",
    branding: { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#0f172a", ctaText: "Visit Dashboard", ctaUrl: APP_URL + "/dashboard" },
    body(b, accent, accentDark) {
      return `<h2 style="color:#0f172a;margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:-0.3px;line-height:1.3;font-family:${font};">This Week at Capital OS</h2>` +
        `<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9;"><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">83,000+ Investors Now in Database</h3><p style="color:#64748b;margin:0 0 8px;font-size:14px;line-height:1.6;">We've crossed a major milestone. Our investor database now includes profiles from SEC filings, venture directories, and web scraping.</p><a href="${APP_URL}/dashboard/investors" style="color:${accent === '#0f172a' ? '#84cc16' : accent};font-size:13px;font-weight:600;text-decoration:none;">Browse investors &rarr;</a></div>` +
        `<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9;"><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">AI Copilot Now Available</h3><p style="color:#64748b;margin:0 0 8px;font-size:14px;line-height:1.6;">Ask your AI copilot anything about your investor database, pipeline, or fundraising strategy.</p><a href="${APP_URL}/dashboard/copilot" style="color:${accent === '#0f172a' ? '#84cc16' : accent};font-size:13px;font-weight:600;text-decoration:none;">Try it now &rarr;</a></div>` +
        `<div><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">Branded Email Templates</h3><p style="color:#64748b;margin:0;font-size:14px;line-height:1.6;">Every email you send through Capital OS now includes your company branding and a professional HTML template.</p></div>` +
        `<div style="text-align:center;margin:28px 0 0;"><a href="${APP_URL}/dashboard" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Visit Dashboard &rarr;</a></div>`;
    },
  },
];

async function send() {
  if (!SMTP_USER || !SMTP_PASS) { console.error("No SMTP"); process.exit(1); }
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  console.log(`\n📧 Sending 5 sample emails to ${TO}\n`);

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const b = { brandName: "Capital OS", tagline: "AI-Powered Fundraising", accentColor: "#84cc16", ctaText: "Let's Connect", ctaUrl: null, signature: null, ...s.branding };
    const accent = b.accentColor;
    const accentDark = darken(accent, 0.2);
    const html = s.body(b, accent, accentDark);
    try {
      await transport.sendMail({ from: `"${b.brandName}" <${EMAIL_FROM}>`, to: TO, subject: s.subjectLine, html });
      console.log(`   ✅ ${i+1}/5 — ${s.label}`);
      fs.writeFileSync(`scripts/sample-${i+1}.html`, html);
    } catch (err) { console.log(`   ❌ ${i+1}/5 — ${err.message}`); }
    if (i < scenarios.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`\n💾 Saved: scripts/sample-1.html through sample-5.html\n`);
  process.exit(0);
}

send();
