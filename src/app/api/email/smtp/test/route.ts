import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import nodemailer from "nodemailer";

/**
 * Test a custom SMTP connection
 * POST /api/email/smtp/test
 * Body: { host, port, user, pass, secure, fromName, fromEmail }
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { host, port, user: smtpUser, pass, secure, fromEmail } = body;

    if (!host || !smtpUser || !pass) {
      return NextResponse.json(
        { error: "SMTP host, username, and password are required" },
        { status: 400 }
      );
    }

    // Create test transporter
    const testTransporter = nodemailer.createTransport({
      host,
      port: parseInt(port || "587"),
      secure: secure === true || secure === "true",
      auth: {
        user: smtpUser,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });

    // Verify connection
    await testTransporter.verify();

    // Send test email to the user
    const testResult = await testTransporter.sendMail({
      from: `"Capital OS" <${fromEmail || smtpUser}>`,
      to: user.email,
      subject: "Capital OS — SMTP Connection Test ✅",
      html: `
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
    .details { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .details p { margin: 4px 0; font-size: 13px; color: #666; }
    .details strong { color: #333; }
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
      <h2>🎉 SMTP Connected!</h2>
      <p>Your custom email server is connected and working. You can now send personalized outreach emails to investors from your own domain.</p>
      <p><span class="badge">✅ SMTP Verified</span></p>
      <div class="details">
        <p><strong>Server:</strong> ${host}:${port}</p>
        <p><strong>From:</strong> ${fromEmail || smtpUser}</p>
        <p><strong>Security:</strong> ${secure ? "TLS/SSL" : "STARTTLS"}</p>
      </div>
      <p>You're ready to start your fundraising outreach campaign!</p>
    </div>
    <div class="footer">
      <p>Sent from Capital OS • ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
  </div>
</body>
</html>`,
      text: `Capital OS — SMTP Connected! Your email server is working.`,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${user.email}`,
      messageId: testResult.messageId,
    });
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    let friendlyMessage = "Connection failed";

    if (errorMsg.includes("EAUTH")) {
      friendlyMessage = "Authentication failed — check your username and password";
    } else if (errorMsg.includes("ECONNREFUSED")) {
      friendlyMessage = "Connection refused — check the SMTP host and port";
    } else if (errorMsg.includes("ETIMEDOUT")) {
      friendlyMessage = "Connection timed out — check the SMTP host";
    } else if (errorMsg.includes("ESOCKET")) {
      friendlyMessage = "Socket error — check host, port, and TLS settings";
    }

    return NextResponse.json(
      { error: friendlyMessage, details: errorMsg },
      { status: 400 }
    );
  }
}
