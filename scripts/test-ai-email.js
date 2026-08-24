#!/usr/bin/env node
/**
 * Capital OS — AI Email Drafting + Send Test
 * ===========================================
 * End-to-end test: NVIDIA AI drafts a personalized email → Gmail SMTP sends it.
 * Tests the full pipeline: AI key rotation → prompt → response → SMTP → deliver.
 *
 * Usage:
 *   node scripts/test-ai-email.js                                    # Draft + send to self
 *   node scripts/test-ai-email.js --to investor@example.com          # Send to specific email
 *   node scripts/test-ai-email.js --investor "John Smith" --company "Sequoia Capital"
 *   node scripts/test-ai-email.js --dry-run                          # Draft only, don't send
 *   node scripts/test-ai-email.js --task email_drafting              # Use specific AI task
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const nodemailer = require("nodemailer");

// ─── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const toIdx = args.indexOf("--to");
const nameIdx = args.indexOf("--investor");
const companyIdx = args.indexOf("--company");
const stageIdx = args.indexOf("--stage");
const sectorIdx = args.indexOf("--sector");

const toEmail = toIdx >= 0 ? args[toIdx + 1] : process.env.SMTP_USER;
const investorName = nameIdx >= 0 ? args[nameIdx + 1] : "Sarah Chen";
const companyName = companyIdx >= 0 ? args[companyIdx + 1] : "Sequoia Capital";
const stage = stageIdx >= 0 ? args[stageIdx + 1] : "Seed";
const sector = sectorIdx >= 0 ? args[sectorIdx + 1] : "AI/SaaS";

// ─── NVIDIA AI Key Pool ──────────────────────────────────────────────────────
const BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1";

function getKeyPool() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`NVIDIA_API_KEY_${i}`];
    if (key && key.startsWith("nvapi-")) keys.push(key);
  }
  return keys;
}

let currentKeyIndex = 0;
function getNextKey() {
  const keys = getKeyPool();
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

// ─── AI Draft Function ───────────────────────────────────────────────────────
async function draftEmail({ investorName, companyName, stage, sector }) {
  const systemPrompt = `You are Capital OS AI — an expert fundraising strategist and copywriter.
You write personalized investor outreach emails that are:
- Short and respectful (under 150 words)
- Specific to the investor's portfolio and thesis
- Value-proposition driven (not generic)
- Professional but warm
- Include a clear call-to-action

Output ONLY the email body in clean HTML. No markdown, no code fences.
Use professional inline styles suitable for email rendering.`;

  const userPrompt = `Draft a personalized investor outreach email from Joshua Semek, founder of Capital OS.

Investor: ${investorName} at ${companyName}
Stage: ${stage}
Sector: ${sector}
Platform: Capital OS — AI-powered fundraising operating system with 32,000+ investor profiles

Key points to include:
- We've built an AI-powered platform that helps startups connect with the right investors
- We have 32,000+ verified investor profiles with AI scoring
- Personalized outreach that gets 5x higher response rates
- Ask for a 15-minute introductory call
- Mention the specific sector/stage alignment

Keep it under 150 words. Make it feel personal, not templated.`;

  const apiKey = getNextKey();
  const keyMasked = apiKey.slice(0, 12) + "..." + apiKey.slice(-6);

  console.log(`🤖 Drafting with NVIDIA AI (key ${keyMasked})...`);
  const start = Date.now();

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const aiContent = data.choices?.[0]?.message?.content?.trim();
  const elapsed = Date.now() - start;

  if (!aiContent) throw new Error("Empty AI response");

  console.log(`✅ AI draft complete (${elapsed}ms, ${data.usage?.total_tokens || "?"} tokens)\n`);

  return {
    html: aiContent,
    model: data.model || MODEL,
    tokens: data.usage?.total_tokens || 0,
    latency: elapsed,
    keyUsed: keyMasked,
  };
}

// ─── Wrap in email template ──────────────────────────────────────────────────
function wrapInTemplate(aiHtml) {
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
    .header { background: linear-gradient(135deg, #065f46, #059669, #10b981); padding: 28px 32px; text-align: center; }
    .logo { font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .body { padding: 32px; }
    .body p { font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 14px; }
    .body p:first-child { margin-top: 0; }
    .footer { background: #fafafa; padding: 16px 32px; text-align: center; border-top: 1px solid #eee; }
    .footer p { color: #aaa; font-size: 11px; margin: 0; }
    .footer a { color: #059669; text-decoration: none; }
    .meta { background: #f0fdf4; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #065f46; }
    .meta strong { color: #047857; }
    @media (max-width: 600px) { .body, .header, .footer { padding: 24px 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">CapitalOS</div>
      </div>
      <div class="body">
        <div class="meta">
          <strong>🤖 AI-Drafted</strong> — Generated by Capital OS AI using NVIDIA Nemotron
        </div>
        ${aiHtml}
      </div>
      <div class="footer">
        <p>
          Drafted by <a href="https://capital-os-nine.vercel.app">Capital OS</a> AI • 
          ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}<br>
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
  console.log("  Capital OS — AI Email Drafting + Send Test");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📋 Configuration:");
  console.log(`   NVIDIA API:    ${getKeyPool().length} keys available`);
  console.log(`   AI Model:      ${MODEL}`);
  console.log(`   SMTP Host:     ${process.env.SMTP_HOST || "NOT SET"}`);
  console.log(`   SMTP User:     ${process.env.SMTP_USER || "❌ NOT SET"}`);
  console.log(`   SMTP Pass:     ${process.env.SMTP_PASS ? "✅ Set" : "❌ NOT SET"}`);
  console.log(`   To:            ${toEmail}`);
  console.log(`   Investor:      ${investorName}`);
  console.log(`   Company:       ${companyName}`);
  console.log(`   Stage:         ${stage}`);
  console.log(`   Sector:        ${sector}`);
  console.log(`   Mode:          ${dryRun ? "DRY RUN (AI draft only)" : "FULL SEND (AI + Email)"}`);
  console.log();

  // Step 1: AI Draft
  console.log("━━━ Step 1: AI Drafting ━━━");
  let draft;
  try {
    draft = await draftEmail({ investorName, companyName, stage, sector });
  } catch (e) {
    console.error("❌ AI draft failed:", e.message);
    process.exit(1);
  }

  console.log("📝 AI-Generated Email Draft:");
  console.log("─────────────────────────────");
  // Strip HTML tags for console display
  const plainText = draft.html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  console.log(plainText.slice(0, 500) + (plainText.length > 500 ? "..." : ""));
  console.log("─────────────────────────────\n");

  console.log(`   Model:   ${draft.model}`);
  console.log(`   Tokens:  ${draft.tokens}`);
  console.log(`   Latency: ${draft.latency}ms`);
  console.log(`   Key:     ${draft.keyUsed}\n`);

  // Step 2: Send email (unless dry-run)
  if (dryRun) {
    console.log("🔍 DRY RUN — AI draft complete, no email sent.");
    console.log("   To send for real, remove --dry-run flag.");
    console.log("\n═══════════════════════════════════════════════════════════");
    return;
  }

  console.log("━━━ Step 2: Sending via Gmail SMTP ━━━");

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("❌ SMTP credentials not configured. Skipping email send.");
    console.log("   Set SMTP_USER and SMTP_PASS in .env.local");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log("✅ SMTP verified");
  } catch (e) {
    console.error("❌ SMTP connection failed:", e.message.split("\n")[0]);
    process.exit(1);
  }

  const html = wrapInTemplate(draft.html);
  const subject = `Partnership Opportunity — Capital OS x ${investorName}`;
  const plainFallback = draft.html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  console.log(`📤 Sending to: ${toEmail}`);
  console.log(`   Subject: ${subject}\n`);

  try {
    const start = Date.now();
    const info = await transporter.sendMail({
      from: `"Capital OS AI" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      text: plainFallback,
      html,
    });
    const elapsed = Date.now() - start;

    console.log("✅ Email sent successfully!");
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Time:       ${elapsed}ms`);
    console.log(`   Accepted:   ${info.accepted?.length || 0}`);
    console.log(`\n   📬 Check your inbox at: ${toEmail}`);
  } catch (e) {
    console.error("❌ Failed to send:", e.message.split("\n")[0]);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Pipeline Complete: NVIDIA AI → Gmail SMTP → Delivered");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("💥 Error:", err.message);
  process.exit(1);
});
