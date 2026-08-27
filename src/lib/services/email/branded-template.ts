// =============================================
// Capital OS — Branded Email Templates
// =============================================
// Wraps AI-generated email content in a beautiful,
// user-branded HTML template for investor outreach.

export interface UserBranding {
  brandName?: string | null;
  tagline?: string;
  accentColor?: string;
  logoUrl?: string | null;
  website?: string | null;
  footerText?: string | null;
  ctaText?: string;
  ctaUrl?: string | null;
  signature?: string | null;
}

const DEFAULT_BRANDING: UserBranding = {
  brandName: "Capital OS",
  tagline: "AI-Powered Fundraising",
  accentColor: "#84cc16",
  logoUrl: null,
  website: "https://capital-os-nine.vercel.app",
  footerText: null,
  ctaText: "Let's Connect",
  ctaUrl: null,
  signature: null,
};

const COMPANY_ADDRESS = "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";
const UNSUBSCRIBE_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";

// =============================================
// Color Utilities
// =============================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128;
}

function darken(hex: string, amount: number = 0.15): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// =============================================
// Initials from brand name
// =============================================

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

// =============================================
// Branded Outreach Template
// =============================================

export function brandedOutreachEmail({
  emailBody,
  subject,
  investorName,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  investorName: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.15);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const initials = getInitials(brandName);
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;

  // Format the email body: convert newlines to <br> and wrap paragraphs
  const formattedBody = emailBody
    .split(/\n\n+/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      return `<p style="color: #374151; line-height: 1.75; margin: 0 0 16px; font-size: 15px;">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; min-width: 100% !important; }
      .email-body { padding: 24px 20px !important; }
      .brand-header { padding: 28px 20px !important; }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 16px;">
  <div class="email-container" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Brand Header -->
    <div class="brand-header" style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); padding: 36px 32px; text-align: center; position: relative;">
      ${b.logoUrl ? `
        <img src="${b.logoUrl}" alt="${brandName}" style="height: 40px; margin-bottom: 8px;" />
      ` : `
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: ${withAlpha(textColor, 0.2)}; border-radius: 14px; margin-bottom: 12px;">
          <span style="color: ${textColor}; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${initials}</span>
        </div>
      `}
      <h1 style="color: ${textColor}; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">
        ${brandName}
      </h1>
      <p style="color: ${withAlpha(textColor, 0.75)}; margin: 4px 0 0; font-size: 13px; font-weight: 400;">
        ${b.tagline}
      </p>
    </div>

    <!-- Email Body -->
    <div class="email-body" style="padding: 36px 32px;">
      ${formattedBody}

      ${b.signature ? `
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">${b.signature.replace(/\n/g, "<br>")}</p>
        </div>
      ` : ""}

      ${b.ctaText && b.ctaUrl ? `
        <div style="text-align: center; margin: 28px 0 0;">
          <a href="${b.ctaUrl}" style="display: inline-block; background: ${accent}; color: ${textColor}; padding: 14px 36px; border-radius: 10px; font-weight: 600; font-size: 15px; text-decoration: none; letter-spacing: 0.2px;">
            ${b.ctaText} →
          </a>
        </div>
      ` : ""}
    </div>

    <!-- Subtle divider -->
    <div style="height: 1px; background: linear-gradient(to right, transparent, ${withAlpha(accent, 0.3)}, transparent); margin: 0 32px;"></div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 24px 32px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 6px;">
        ${b.footerText || `Sent by ${brandName} via Capital OS`}
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0 0 8px;">
        ${COMPANY_ADDRESS}
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        <a href="${unsubUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${UNSUBSCRIBE_BASE}/privacy" style="color: #9ca3af;">Privacy</a>
        &nbsp;·&nbsp;
        <a href="${UNSUBSCRIBE_BASE}/terms" style="color: #9ca3af;">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  // Plain text version
  const text = emailBody + `\n\n—\n${brandName} | ${b.tagline}\n${b.website || ""}\n\n---\nSent via Capital OS · ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;

  return { html, text };
}

// =============================================
// Branded Follow-up Template
// =============================================

export function brandedFollowUpEmail({
  emailBody,
  subject,
  investorName,
  originalSubject,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  investorName: string;
  originalSubject?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  // Follow-up uses the same template with a "Re:" indicator
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.15);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const initials = getInitials(brandName);
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;

  const formattedBody = emailBody
    .split(/\n\n+/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      return `<p style="color: #374151; line-height: 1.75; margin: 0 0 16px; font-size: 15px;">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .email-body { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 16px;">
  <div class="email-container" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Compact Brand Header -->
    <div style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); padding: 24px 32px; display: flex; align-items: center; gap: 12px;">
      ${b.logoUrl ? `
        <img src="${b.logoUrl}" alt="${brandName}" style="height: 28px;" />
      ` : `
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${withAlpha(textColor, 0.2)}; border-radius: 8px; flex-shrink: 0;">
          <span style="color: ${textColor}; font-size: 14px; font-weight: 700;">${initials}</span>
        </div>
      `}
      <div>
        <span style="color: ${textColor}; font-size: 16px; font-weight: 600;">${brandName}</span>
        <span style="color: ${withAlpha(textColor, 0.6)}; font-size: 12px; margin-left: 8px;">Follow-up</span>
      </div>
    </div>

    <div class="email-body" style="padding: 32px;">
      ${originalSubject ? `
        <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; border-left: 3px solid ${accent};">
          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Re: ${originalSubject}</p>
        </div>
      ` : ""}

      ${formattedBody}

      ${b.signature ? `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">${b.signature.replace(/\n/g, "<br>")}</p>
        </div>
      ` : ""}
    </div>

    <div style="height: 1px; background: linear-gradient(to right, transparent, ${withAlpha(accent, 0.3)}, transparent); margin: 0 32px;"></div>

    <div style="background: #fafafa; padding: 20px 32px; text-align: center;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        ${b.footerText || `Sent by ${brandName} via Capital OS`}
        &nbsp;·&nbsp;
        <a href="${unsubUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const textContent = emailBody + `\n\n—\n${brandName} | ${b.tagline}\n${b.website || ""}\n\n---\nUnsubscribe: ${unsubUrl}`;

  return { html, text: textContent };
}
