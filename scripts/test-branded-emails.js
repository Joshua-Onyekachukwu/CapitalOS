#!/usr/bin/env node
// =============================================
// Test Branded Email Templates
// =============================================
// Sends multiple branded emails with different scenarios, tones, and branding.

require("dotenv").config({ path: ".env.local" });

const nodemailer = require("nodemailer");

const TO = "onyekachukwujoshua39@gmail.com";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const COMPANY_ADDRESS = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";

// =============================================
// Email Template Generator (inline for testing)
// =============================================

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isLight(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128;
}

function darken(hex, amount = 0.15) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

function formatBody(emailBody) {
  return emailBody
    .split(/\n\n+/)
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      return `<p style="color: #374151; line-height: 1.75; margin: 0 0 16px; font-size: 15px;">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

const EMAIL_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .email-body { padding: 24px 20px !important; }
    }
  </style>
</head>`;

function generateBrandedEmail({ subject, emailBody, context, branding = {}, ctaButton = true }) {
  const b = {
    brandName: "Capital OS",
    tagline: "AI-Powered Fundraising",
    accentColor: "#84cc16",
    logoUrl: null,
    website: APP_URL,
    ctaText: "Let's Connect",
    ctaUrl: null,
    signature: null,
    ...branding,
  };

  const accent = b.accentColor;
  const accentDark = darken(accent, 0.15);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const initials = getInitials(b.brandName);
  const unsubUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TO)}`;

  const formattedBody = formatBody(emailBody);

  const html = `${EMAIL_HEAD}
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 16px;">
  <div class="email-container" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Brand Header -->
    <div style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); padding: 36px 32px; text-align: center;">
      ${b.logoUrl ? `<img src="${b.logoUrl}" alt="${b.brandName}" style="height: 40px; margin-bottom: 8px;" />` : `
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: ${withAlpha(textColor, 0.2)}; border-radius: 14px; margin-bottom: 12px;">
          <span style="color: ${textColor}; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${initials}</span>
        </div>
      `}
      <h1 style="color: ${textColor}; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">
        ${b.brandName}
      </h1>
      <p style="color: ${withAlpha(textColor, 0.75)}; margin: 4px 0 0; font-size: 13px;">
        ${b.tagline}
      </p>
    </div>

    <div class="email-body" style="padding: 36px 32px;">

      ${context ? `
      <!-- Why We're Reaching Out -->
      <div style="background: ${withAlpha(accent, 0.06)}; border: 1px solid ${withAlpha(accent, 0.2)}; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px;">
        <p style="color: ${accentDark}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin: 0 0 8px;">
          Why We're Reaching Out
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
          ${context}
        </p>
      </div>
      ` : ""}

      ${formattedBody}

      ${b.signature ? `
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">${b.signature.replace(/\n/g, "<br>")}</p>
        </div>
      ` : ""}

      ${ctaButton && b.ctaText ? `
        <div style="text-align: center; margin: 28px 0 0;">
          <a href="${b.ctaUrl || APP_URL}" style="display: inline-block; background: ${accent}; color: ${textColor}; padding: 14px 36px; border-radius: 10px; font-weight: 600; font-size: 15px; text-decoration: none; letter-spacing: 0.2px;">
            ${b.ctaText} &rarr;
          </a>
        </div>
      ` : ""}
    </div>

    <!-- Footer -->
    <div style="height: 1px; background: linear-gradient(to right, transparent, ${withAlpha(accent, 0.3)}, transparent); margin: 0 32px;"></div>
    <div style="background: #fafafa; padding: 24px 32px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 6px;">
        Sent by ${b.brandName} via Capital OS
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0 0 8px;">
        ${COMPANY_ADDRESS}
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        <a href="${unsubUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
        &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/privacy" style="color: #9ca3af;">Privacy</a>
        &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/terms" style="color: #9ca3af;">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `${context ? `[Why We're Reaching Out]\n${context}\n\n` : ""}${emailBody}\n\n---\n${b.brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;

  return { html, text };
}

// =============================================
// Test Email Scenarios
// =============================================

const scenarios = [
  // ===== STARTUP FOUNDER SCENARIOS =====
  {
    label: "Startup Founder — Warm Intro to VC",
    subject: "Quick intro: B2B SaaS with $2M ARR seeking Series A",
    context: "Sequoia Capital is a Series A-focused venture firm with a strong portfolio in enterprise SaaS. Their recent investments in AI-powered workflow tools align directly with our product category.",
    body: `Hi Roelof,

I noticed your work with Sequoia's enterprise SaaS portfolio — particularly the investments you've led in workflow automation tools.

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
    label: "Startup Founder — Cold Email to Angel",
    subject: "Built something I think you'd find interesting",
    context: "Jason Calacanis is an active angel investor known for backing early-stage startups, particularly in consumer tech and SaaS. He invests at pre-seed and seed stages with typical checks of $25K-$100K.",
    body: `Hi Jason,

I've been following your angel portfolio and the types of early-stage bets you take — you seem to have a good eye for founder-market fit over fancy decks.

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
    label: "Startup Founder — Referral-Style to PE Firm",
    subject: "Introduction from Capital OS — growth-stage opportunity",
    context: "Andreessen Horowitz (a16z) is a growth-stage investment firm known for backing category-defining technology companies. They invest across AI, fintech, and enterprise software at Series B+ stages.",
    body: `Hi Renée,

Your work caught our attention through Capital OS's investor matching system — specifically your focus on scaling AI-native companies from Series B onward.

We're a late-stage startup in the AI infrastructure space. We help companies deploy and manage machine learning models in production, and we're processing 50M+ inference requests per month for 200+ enterprise customers.

We're raising a $40M Series C to expand internationally. Given a16z's track record with companies like Weights & Biases and Scale AI, I think there could be strong alignment.

Would a 20-minute introductory call make sense?`,
    branding: {
      brandName: "NeuralDeploy",
      tagline: "ML Infrastructure at Scale",
      accentColor: "#7c3aed",
      ctaText: "Book a Meeting",
      ctaUrl: "https://calendly.com/joshua-neuraldeploy",
      signature: "Joshua Onyekachukwu\nCEO & Co-Founder, NeuralDeploy\njoshua@neuraldeploy.com",
    },
  },

  // ===== INVESTOR OUTREACH SCENARIOS =====
  {
    label: "Investor Outreach — Seed Round Pitch",
    subject: "AI matching 200+ investors to your portfolio thesis",
    context: "Founders Fund is a venture capital firm known for investing in transformative technology companies. They focus on deep tech, defense, AI, and infrastructure with typical investments at Series A-B.",
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
    label: "Investor Outreach — Follow-Up Email",
    subject: "Re: Capital OS — quick follow-up",
    context: "This is a follow-up to a previous outreach about Capital OS's seed round. The investor showed initial interest but hasn't responded to the first email.",
    body: `Hi Sarah,

Just wanted to follow up on my note from last week about Capital OS.

I know your inbox is probably overwhelming, so I'll keep this brief: we've helped founders identify and connect with over 2,000 qualified investors through our AI matching system. The platform is live and we're seeing strong engagement.

If the timing isn't right, no worries at all. But if you'd like a quick demo or want to see the deck, I'm happy to share.

Either way, thanks for your time.`,
    branding: {
      brandName: "Capital OS",
      tagline: "AI-Powered Fundraising",
      accentColor: "#84cc16",
      ctaText: "See the Deck",
      signature: "Joshua Onyekachukwu\nFounder & CEO, Capital OS",
    },
  },
  {
    label: "Investor Outreach — Bold Direct Pitch",
    subject: "50K qualified investors — we built the matching engine",
    context: "Benchmark is known for early-stage, high-conviction bets in consumer and enterprise software. They invest at seed and Series A with a small, focused fund.",
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
// Send Emails
// =============================================

async function sendTestEmails() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error("❌ SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in .env.local");
    console.log("   Using Gmail: set SMTP_USER=your@gmail.com and SMTP_PASS=your-app-password");
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  console.log(`\n📧 Sending ${scenarios.length} branded test emails to ${TO}\n`);
  console.log(`   SMTP: ${SMTP_USER} via ${SMTP_HOST}:${SMTP_PORT}\n`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const { html, text } = generateBrandedEmail({
      subject: s.subject,
      emailBody: s.body,
      context: s.context,
      branding: s.branding,
    });

    try {
      const info = await transport.sendMail({
        from: `"${s.branding.brandName}" <${EMAIL_FROM}>`,
        to: TO,
        subject: `[${s.branding.brandName}] ${s.subject}`,
        text,
        html,
      });
      sent++;
      console.log(`   ✅ ${i + 1}/${scenarios.length} — ${s.label}`);
      console.log(`      Subject: ${s.subject}`);
      console.log(`      Brand: ${s.branding.brandName} (${s.branding.accentColor})`);
      console.log(`      Message ID: ${info.messageId}\n`);
    } catch (err) {
      failed++;
      console.log(`   ❌ ${i + 1}/${scenarios.length} — ${s.label}`);
      console.log(`      Error: ${err.message}\n`);
    }

    // Small delay between sends
    if (i < scenarios.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n📊 Results: ${sent} sent, ${failed} failed out of ${scenarios.length} total\n`);
  
  // Also save one as HTML for preview
  const { html } = generateBrandedEmail({
    subject: scenarios[0].subject,
    emailBody: scenarios[0].body,
    context: scenarios[0].context,
    branding: scenarios[0].branding,
  });
  const fs = require("fs");
  fs.writeFileSync("scripts/test-email-preview.html", html);
  console.log("💾 Saved preview: scripts/test-email-preview.html\n");

  process.exit(0);
}

sendTestEmails();
