#!/usr/bin/env node
/**
 * Capital OS — Outreach Email Test
 * ================================
 * Sends a real investor outreach email via Gmail SMTP.
 * Tests the full pipeline: SMTP connection → HTML rendering → Send → Verify.
 *
 * Usage:
 *   node scripts/test-outreach-email.js                          # Send to configured user
 *   node scripts/test-outreach-email.js --to investor@email.com  # Send to specific email
 *   node scripts/test-outreach-email.js --dry-run                # Preview without sending
 *   node scripts/test-outreach-email.js --investor "John Smith"  # Personalize with investor name
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const nodemailer = require("nodemailer");

// ─── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const toIdx = args.indexOf("--to");
const nameIdx = args.indexOf("--investor");
const toEmail = toIdx >= 0 ? args[toIdx + 1] : process.env.SMTP_USER;
const investorName = nameIdx >= 0 ? args[nameIdx + 1] : "Sarah Chen";

// ─── Build the outreach email HTML ───────────────────────────────────────────
function buildOutreachHtml(name) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8faf8; margin: 0; padding: 40px 20px; color: #1a1a1a; }
    .container { max-width: 580px; margin: 0 auto; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background: linear-gradient(135deg, #065f46, #059669, #10b981); padding: 36px 32px; text-align: center; }
    .logo { font-size: 24px; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .tagline { color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; color: #1a1a1a; margin: 0 0 20px; line-height: 1.6; }
    .greeting strong { color: #059669; }
    .para { font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px; }
    .highlight-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .highlight-box p { margin: 0; font-size: 14px; color: #065f46; line-height: 1.6; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 20px 0; }
    .sig { font-size: 14px; color: #555; margin-top: 24px; line-height: 1.6; }
    .sig strong { color: #1a1a1a; }
    .footer { background: #fafafa; padding: 20px 32px; text-align: center; border-top: 1px solid #eee; }
    .footer p { color: #aaa; font-size: 11px; margin: 0; line-height: 1.6; }
    .footer a { color: #059669; text-decoration: none; }
    @media (max-width: 600px) { .body, .header, .footer { padding: 24px 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">CapitalOS</div>
        <div class="tagline">AI-Powered Fundraising Operating System</div>
      </div>

      <div class="body">
        <p class="greeting">Hi <strong>${name}</strong>,</p>

        <p class="para">
          I came across your work in venture investing and wanted to reach out. We're building
          Capital OS — an AI-powered platform that helps startups connect with the right investors
          and streamline their fundraising process.
        </p>

        <div class="highlight-box">
          <p>
            <strong>Why I'm reaching out to you specifically:</strong><br>
            Your investment focus and portfolio align closely with early-stage SaaS companies
            like ours. We believe there could be strong synergy between what we're building
            and your investment thesis.
          </p>
        </div>

        <p class="para">
          Our platform is live with 32,000+ investor profiles, AI-powered matching, and
          personalized outreach — all designed to help founders spend less time fundraising
          and more time building.
        </p>

        <p class="para">
          Would you be open to a quick 15-minute call to explore how we might work together?
          No pressure at all — just a conversation.
        </p>

        <a href="https://capital-os-nine.vercel.app" class="cta-btn">Learn More About Capital OS →</a>

        <div class="sig">
          Best regards,<br>
          <strong>Joshua Semek</strong><br>
          Founder, Capital OS<br>
          <a href="mailto:onyekachukwujoshua39@gmail.com" style="color:#059669">onyekachukwujoshua39@gmail.com</a>
        </div>
      </div>

      <div class="footer">
        <p>
          Sent via <a href="https://capital-os-nine.vercel.app">Capital OS</a> — AI-Powered Fundraising<br>
          You received this because we believe you'd be a great fit for our portfolio companies.<br>
          <a href="#">Unsubscribe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Outreach Email Test");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Check credentials
  console.log("📋 Configuration:");
  console.log(`   SMTP Host:     ${process.env.SMTP_HOST || "NOT SET"}`);
  console.log(`   SMTP Port:     ${process.env.SMTP_PORT || "NOT SET"}`);
  console.log(`   SMTP User:     ${process.env.SMTP_USER || "❌ NOT SET"}`);
  console.log(`   SMTP Pass:     ${process.env.SMTP_PASS ? "✅ Set" : "❌ NOT SET"}`);
  console.log(`   Email From:    ${process.env.EMAIL_FROM || "NOT SET"}`);
  console.log(`   To:            ${toEmail}`);
  console.log(`   Investor:      ${investorName}`);
  console.log(`   Mode:          ${dryRun ? "DRY RUN (no email sent)" : "LIVE SEND"}`);
  console.log();

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("❌ Missing SMTP credentials in .env.local");
    console.error("   Set SMTP_USER and SMTP_PASS (Gmail app password)");
    process.exit(1);
  }

  // 2. Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // 3. Test SMTP connection
  console.log("🔌 Testing SMTP connection...");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified!\n");
  } catch (e) {
    console.error("❌ SMTP connection failed:", e.message.split("\n")[0]);
    process.exit(1);
  }

  // 4. Build email
  const html = buildOutreachHtml(investorName);

  const mailOptions = {
    from: `"Capital OS" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Partnership Opportunity — Capital OS x ${investorName}`,
    text: `Hi ${investorName},\n\nI came across your work in venture investing and wanted to reach out. We're building Capital OS — an AI-powered platform that helps startups connect with the right investors.\n\nWould you be open to a quick 15-minute call to explore how we might work together?\n\nBest regards,\nJoshua Semek\nFounder, Capital OS`,
    html: html,
  };

  // 5. Send or preview
  if (dryRun) {
    console.log("🔍 DRY RUN — Email preview:");
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   To:   ${mailOptions.to}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    console.log(`   HTML length: ${html.length} characters`);
    console.log("\n💡 To send for real, remove --dry-run flag");
    console.log("\n═══════════════════════════════════════════════════════════");
    return;
  }

  console.log(`📤 Sending outreach email to: ${toEmail}`);
  console.log(`   Subject: ${mailOptions.subject}\n`);

  try {
    const startTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const elapsed = Date.now() - startTime;

    console.log("✅ Outreach email sent successfully!");
    console.log(`   Message ID:  ${info.messageId}`);
    console.log(`   Response:    ${info.response}`);
    console.log(`   Time:        ${elapsed}ms`);
    console.log(`   Accepted:    ${info.accepted?.length || 0}`);
    console.log(`   Rejected:    ${info.rejected?.length || 0}`);
    console.log(`\n   📬 Check your inbox at: ${toEmail}`);
  } catch (e) {
    console.error("❌ Failed to send:", e.message.split("\n")[0]);
    if (e.code === "EAUTH") {
      console.error("\n   💡 Authentication failed. Check:");
      console.error("   - Is the app password correct?");
      console.error("   - Is 2-Step Verification enabled?");
      console.error("   - Did you generate a new app password?");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("💥 Error:", err.message);
  process.exit(1);
});
