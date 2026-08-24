#!/usr/bin/env node
/**
 * Capital OS — Email Test Script
 * ===============================
 * Tests Gmail SMTP connection and sends a test email.
 * 
 * Usage:
 *   node scripts/test-email.js                    # Test connection only
 *   node scripts/test-email.js --send             # Send test email
 *   node scripts/test-email.js --send --to email  # Send to specific email
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const nodemailer = require("nodemailer");

async function main() {
  const args = process.argv.slice(2);
  const doSend = args.includes("--send");
  const toIdx = args.indexOf("--to");
  const toEmail = toIdx >= 0 ? args[toIdx + 1] : process.env.SMTP_USER;
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Email Test");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  // Check credentials
  console.log("📋 Configuration:");
  console.log(`   SMTP Host: ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
  console.log(`   SMTP Port: ${process.env.SMTP_PORT || "587"}`);
  console.log(`   SMTP User: ${process.env.SMTP_USER || "NOT SET"}`);
  console.log(`   SMTP Pass: ${process.env.SMTP_PASS ? "✅ Set" : "❌ NOT SET"}`);
  console.log(`   Email From: ${process.env.EMAIL_FROM || process.env.SMTP_USER || "NOT SET"}`);
  console.log();
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("❌ Missing SMTP credentials in .env.local");
    console.error("   Set SMTP_USER and SMTP_PASS");
    process.exit(1);
  }
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  
  // Test connection
  console.log("📧 Testing SMTP connection...");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified!\n");
  } catch (e) {
    console.error("❌ SMTP connection failed:", e.message.split("\n")[0]);
    process.exit(1);
  }
  
  // Send test email
  if (doSend) {
    console.log(`📤 Sending test email to: ${toEmail}\n`);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .card { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #84cc16, #65a30d); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .body h2 { color: #1a1a1a; margin: 0 0 16px; font-size: 20px; }
    .body p { color: #555; line-height: 1.6; margin: 0 0 16px; }
    .badge { display: inline-block; background: #f0fdf4; color: #16a34a; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .footer { background: #fafafa; padding: 20px 32px; text-align: center; border-top: 1px solid #eee; }
    .footer p { color: #999; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CapitalOS</h1>
      <p>AI-Powered Fundraising Operating System</p>
    </div>
    <div class="body">
      <h2>🎉 Email System Working!</h2>
      <p>This is a test email from Capital OS. If you're reading this, your Gmail SMTP integration is working perfectly.</p>
      <p><span class="badge">✅ Gmail SMTP Connected</span></p>
      <p>You can now send personalized outreach emails to investors directly from the Capital OS dashboard.</p>
      <p>Next steps:</p>
      <ul style="color: #555; line-height: 1.8;">
        <li>Connect Google OAuth for sign-in</li>
        <li>Import investors from EDGAR</li>
        <li>Create your first outreach campaign</li>
      </ul>
    </div>
    <div class="footer">
      <p>Sent from Capital OS • ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
  </div>
</body>
</html>`;
    
    try {
      const info = await transporter.sendMail({
        from: `"Capital OS" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: toEmail,
        subject: "Capital OS — Email System Test ✅",
        text: "Email system working! This is a test from Capital OS.",
        html: html,
      });
      
      console.log("✅ Test email sent successfully!");
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   To: ${toEmail}`);
      console.log(`   From: ${process.env.EMAIL_FROM || process.env.SMTP_USER}`);
      console.log(`   Subject: Capital OS — Email System Test ✅`);
    } catch (e) {
      console.error("❌ Failed to send:", e.message.split("\n")[0]);
    }
  } else {
    console.log("💡 To send a test email, run:");
    console.log("   node scripts/test-email.js --send");
    console.log("   node scripts/test-email.js --send --to investor@example.com");
  }
  
  console.log("\n═══════════════════════════════════════════════════════════");
}

main().catch(err => {
  console.error("💥 Error:", err.message);
  process.exit(1);
});
