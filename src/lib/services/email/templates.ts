// =============================================
// Capital OS — Email Templates
// =============================================
// Maintains the lime/green design standard you love.
// All templates are responsive and work in all email clients.

const BRAND = {
  primary: "#84cc16",
  primaryDark: "#65a30d",
  bg: "#f5f5f5",
  card: "#ffffff",
  text: "#1a1a1a",
  textMuted: "#555555",
  textLight: "#999999",
  border: "#eeeeee",
  success: "#16a34a",
  successBg: "#f0fdf4",
  warning: "#d97706",
  warningBg: "#fffbeb",
};

// CAN-SPAM compliance constants
const COMPANY_NAME = "Capital OS";
const COMPANY_ADDRESS = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";
const UNSUBSCRIBE_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";

// =============================================
// Base Layout
// =============================================

function baseLayout(content: string, options?: { preheader?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${options?.preheader ? `<meta name="x-apple-disable-message-reformatting">${options.preheader}` : ""}
  <style>
    /* Reset */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .card { width: 100% !important; min-width: 100% !important; }
      .card-body { padding: 24px !important; }
      .btn { display: block !important; width: 100% !important; }
      .stats-grid { display: block !important; }
      .stat-item { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: ${BRAND.bg}; margin: 0; padding: 40px 20px;">
  ${content}
</body>
</html>`;
}

function header(title: string, subtitle?: string): string {
  return `
  <div class="card" style="max-width: 600px; margin: 0 auto; background: ${BRAND.card}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">
    <div style="background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark}); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Capital<span style="font-weight: 300;">OS</span></h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">AI-Powered Fundraising Operating System</p>
    </div>`;
}

function textComplianceFooter(unsubscribeUrl?: string): string {
  const unsubUrl = unsubscribeUrl || `${UNSUBSCRIBE_BASE_URL}/unsubscribe`;
  return `\n\n---\nThis is a commercial email sent via ${COMPANY_NAME}.\n${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;
}

function footer(date?: string, unsubscribeUrl?: string): string {
  const displayDate = date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const unsubUrl = unsubscribeUrl || `${UNSUBSCRIBE_BASE_URL}/unsubscribe`;
  return `
    <div style="background: #fafafa; padding: 20px 32px; text-align: center; border-top: 1px solid ${BRAND.border};">
      <p style="color: ${BRAND.textLight}; font-size: 11px; margin: 0 0 4px; font-style: italic;">This is a commercial email sent via ${COMPANY_NAME}.</p>
      <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0 0 4px;">${COMPANY_NAME} • ${COMPANY_ADDRESS}</p>
      <p style="color: ${BRAND.textLight}; font-size: 11px; margin: 0 0 4px;">
        <a href="${unsubUrl}" style="color: ${BRAND.textLight}; text-decoration: underline;">Unsubscribe from all emails</a>
      </p>
      <p style="color: ${BRAND.textLight}; font-size: 11px; margin: 0;">
        <a href="${UNSUBSCRIBE_BASE_URL}/privacy" style="color: ${BRAND.textLight};">Privacy Policy</a> • 
        <a href="${UNSUBSCRIBE_BASE_URL}/terms" style="color: ${BRAND.textLight};">Terms of Service</a>
      </p>
    </div>
  </div>`;
}

// =============================================
// Investor Outreach — First Touch
// =============================================

export function investorOutreachTemplate({
  investorName,
  founderName,
  companyName,
  companyDescription,
  customMessage,
  meetingLink,
  ctaText = "Let's Connect",
  unsubscribeUrl,
}: {
  investorName: string;
  founderName: string;
  companyName: string;
  companyDescription: string;
  customMessage?: string;
  meetingLink?: string;
  ctaText?: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const html = baseLayout(
    `${header("Investor Outreach")}
    <div style="padding: 32px;" class="card-body">
      <h2 style="color: ${BRAND.text}; margin: 0 0 8px; font-size: 20px;">Hi ${investorName},</h2>
      
      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 0 0 20px;">
        I'm ${founderName}, founder of <strong>${companyName}</strong>. ${companyDescription}
      </p>

      ${customMessage ? `
      <div style="background: ${BRAND.successBg}; border-left: 3px solid ${BRAND.primary}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <p style="color: ${BRAND.textMuted}; line-height: 1.6; margin: 0; font-style: italic;">${customMessage}</p>
      </div>
      ` : ""}

      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 0 0 24px;">
        I'd love to share how we're building something that aligns with your investment thesis. Would you have 15 minutes for a quick chat this week?
      </p>

      ${meetingLink ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${meetingLink}" class="btn" style="display: inline-block; background: ${BRAND.primary}; color: ${BRAND.text}; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; transition: background 0.2s;">
          ${ctaText} →
        </a>
      </div>
      ` : ""}

      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 20px 0 0;">
        Best regards,<br>
        <strong>${founderName}</strong><br>
        <span style="color: ${BRAND.textLight}; font-size: 13px;">Founder, ${companyName}</span>
      </p>
    </div>
    ${footer(undefined, unsubscribeUrl)}`,
    { preheader: `Hi ${investorName}, I'm ${founderName} from ${companyName}. I'd love to share...` }
  );

  const text = `Hi ${investorName},

I'm ${founderName}, founder of ${companyName}. ${companyDescription}

${customMessage ? `${customMessage}\n\n` : ""}I'd love to share how we're building something that aligns with your investment thesis. Would you have 15 minutes for a quick chat this week?

Best regards,
${founderName}
Founder, ${companyName}`;

  return { html, text: text + textComplianceFooter(unsubscribeUrl) };
}

// =============================================
// Investor Outreach — Follow-up
// =============================================

export function followUpTemplate({
  investorName,
  founderName,
  companyName,
  originalSubject,
  followUpMessage,
  meetingLink,
  unsubscribeUrl,
}: {
  investorName: string;
  founderName: string;
  companyName: string;
  originalSubject: string;
  followUpMessage?: string;
  meetingLink?: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const html = baseLayout(
    `${header("Follow Up")}
    <div style="padding: 32px;" class="card-body">
      <h2 style="color: ${BRAND.text}; margin: 0 0 8px; font-size: 20px;">Hi ${investorName},</h2>
      
      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 0 0 20px;">
        I wanted to follow up on my previous email regarding ${companyName}.
        ${followUpMessage || "I understand you're busy, so I'll keep this brief."}
      </p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Re: ${originalSubject}</p>
      </div>

      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 0 0 24px;">
        If the timing isn't right, no worries at all. But if you're open to a quick 15-minute conversation, I'd love to share our progress and see if there's a fit.
      </p>

      ${meetingLink ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${meetingLink}" class="btn" style="display: inline-block; background: ${BRAND.primary}; color: ${BRAND.text}; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">
          Schedule a Quick Chat →
        </a>
      </div>
      ` : ""}

      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 20px 0 0;">
        Thanks for your time,<br>
        <strong>${founderName}</strong><br>
        <span style="color: ${BRAND.textLight}; font-size: 13px;">Founder, ${companyName}</span>
      </p>
    </div>
    ${footer(undefined, unsubscribeUrl)}`,
    { preheader: `Following up on my previous email about ${companyName}...` }
  );

  const text = `Hi ${investorName},

I wanted to follow up on my previous email regarding ${companyName}.
${followUpMessage || "I understand you're busy, so I'll keep this brief."}

If the timing isn't right, no worries at all. But if you're open to a quick 15-minute conversation, I'd love to share our progress and see if there's a fit.

Thanks for your time,
${founderName}
Founder, ${companyName}`;

  return { html, text: text + textComplianceFooter(unsubscribeUrl) };
}

// =============================================
// Welcome / Onboarding Email
// =============================================

export function welcomeTemplate({
  userName,
  companyName,
  unsubscribeUrl,
}: {
  userName: string;
  companyName: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const html = baseLayout(
    `${header("Welcome to Capital OS")}
    <div style="padding: 32px;" class="card-body">
      <h2 style="color: ${BRAND.text}; margin: 0 0 8px; font-size: 20px;">Welcome aboard, ${userName}! 🎉</h2>
      
      <p style="color: ${BRAND.textMuted}; line-height: 1.7; margin: 0 0 20px;">
        Your account for <strong>${companyName}</strong> is set up and ready to go. Here's what you can do right away:
      </p>

      <div style="margin: 24px 0;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
          <div style="background: ${BRAND.successBg}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="color: ${BRAND.success}; font-size: 16px;">✓</span>
          </div>
          <div>
            <p style="color: ${BRAND.text}; margin: 0; font-weight: 600; font-size: 14px;">Browse 120K+ investors</p>
            <p style="color: ${BRAND.textLight}; margin: 2px 0 0; font-size: 13px;">Search and filter by sector, stage, geography</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
          <div style="background: ${BRAND.successBg}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="color: ${BRAND.success}; font-size: 16px;">✓</span>
          </div>
          <div>
            <p style="color: ${BRAND.text}; margin: 0; font-weight: 600; font-size: 14px;">AI-powered fit scoring</p>
            <p style="color: ${BRAND.textLight}; margin: 2px 0 0; font-size: 13px;">Auto-rank investors by relevance to your startup</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
          <div style="background: ${BRAND.successBg}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="color: ${BRAND.success}; font-size: 16px;">✓</span>
          </div>
          <div>
            <p style="color: ${BRAND.text}; margin: 0; font-weight: 600; font-size: 14px;">Smart outreach campaigns</p>
            <p style="color: ${BRAND.textLight}; margin: 2px 0 0; font-size: 13px;">AI-drafted emails with tracking and follow-ups</p>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="https://capital-os.com/dashboard" class="btn" style="display: inline-block; background: ${BRAND.primary}; color: ${BRAND.text}; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">
          Go to Dashboard →
        </a>
      </div>
    </div>
    ${footer(undefined, unsubscribeUrl)}`
  );

  const text = `Welcome aboard, ${userName}!

Your account for ${companyName} is set up and ready to go.

Here's what you can do right now:
- Browse 120K+ investors
- AI-powered fit scoring
- Smart outreach campaigns

Go to your dashboard: https://capital-os.com/dashboard

— The Capital OS Team`;

  return { html, text: text + textComplianceFooter(unsubscribeUrl) };
}
