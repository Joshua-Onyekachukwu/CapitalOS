// =============================================
// Capital OS — Branded Email Templates (Premium)
// =============================================
// Premium, refined HTML email templates for investor outreach.
// Pure HTML/CSS — works in all email clients.
//
// DESIGN:
//   Top accent stripe (brand color)
//   White card with refined typography
//   ├── Header (logo + name + tagline)
//   ├── Opening paragraphs
//   ├── "Why We're Reaching Out" context box
//   ├── Closing paragraphs
//   ├── Signature
//   └── Footer (CAN-SPAM)

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

const COMPANY_ADDRESS =
  "Capital OS, 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA";
const UNSUBSCRIBE_BASE =
  process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";

// =============================================
// Color Utilities
// =============================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
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
// Split body into opening and closing
// =============================================

function splitBody(emailBody: string): { opening: string; closing: string } {
  const paragraphs = emailBody
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 2) {
    return {
      opening: paragraphs
        .map(
          (p) =>
            `<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;letter-spacing:-0.01em;">${p.replace(/\n/g, "<br>")}</p>`
        )
        .join("\n"),
      closing: "",
    };
  }

  const opening = paragraphs
    .slice(0, 2)
    .map(
      (p) =>
        `<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;letter-spacing:-0.01em;">${p.replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");

  const closing = paragraphs
    .slice(2)
    .map(
      (p) =>
        `<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;letter-spacing:-0.01em;">${p.replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");

  return { opening, closing };
}

// =============================================
// Context Box (premium style)
// =============================================

function contextBox(
  context: string,
  accent: string,
  accentDark: string
): string {
  return `
      <div style="margin:28px 0 32px;padding:0;">
        <!-- Thin accent line above context -->
        <div style="height:2px;background:linear-gradient(to right,${accent},transparent);margin:0 0 16px;border-radius:1px;"></div>
        <p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          Why We're Reaching Out
        </p>
        <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${context}
        </p>
      </div>`;
}

// =============================================
// Brand Header (premium style)
// =============================================

function brandHeader(
  b: UserBranding,
  accent: string,
  accentDark: string,
  textColor: string,
  compact: boolean = false
): string {
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const initials = getInitials(brandName);
  const iconSize = compact ? 32 : 44;
  const iconFontSize = compact ? 13 : 18;

  return `
    <div style="padding:${compact ? "28px 32px 24px" : "40px 32px 32px"};text-align:center;">
      ${b.logoUrl ? `<img src="${b.logoUrl}" alt="${brandName}" style="height:${compact ? 24 : 32}px;margin-bottom:10px;" />` : `
        <div style="display:inline-flex;align-items:center;justify-content:center;width:${iconSize}px;height:${iconSize}px;background:linear-gradient(135deg,${accent} 0%,${accentDark} 100%);border-radius:10px;margin-bottom:12px;">
          <span style="color:#ffffff;font-size:${iconFontSize}px;font-weight:700;letter-spacing:-0.5px;">${initials}</span>
        </div>
      `}
      <h1 style="color:#0f172a;margin:0 0 2px;font-size:${compact ? 16 : 20}px;font-weight:600;letter-spacing:-0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${brandName}
      </h1>
      <p style="color:#94a3b8;margin:0;font-size:12px;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${b.tagline}
      </p>
    </div>`;
}

// =============================================
// Footer (premium style)
// =============================================

function emailFooter(
  b: UserBranding,
  accent: string,
  unsubUrl: string
): string {
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  return `
    <div style="margin:0 32px;"><div style="height:1px;background:#f1f5f9;"></div></div>
    <div style="padding:24px 32px 28px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${b.footerText || `${brandName} via Capital OS`}
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${COMPANY_ADDRESS}
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
        <span style="color:#e2e8f0;margin:0 6px;">·</span>
        <a href="${UNSUBSCRIBE_BASE}/privacy" style="color:#94a3b8;text-decoration:none;">Privacy</a>
        <span style="color:#e2e8f0;margin:0 6px;">·</span>
        <a href="${UNSUBSCRIBE_BASE}/terms" style="color:#94a3b8;text-decoration:none;">Terms</a>
      </p>
    </div>`;
}

// =============================================
// Email Head
// =============================================

const EMAIL_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <style>
    body,table,td,p,a,li{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0;padding:0;width:100%!important}
    img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    @media only screen and (max-width:600px){
      .email-container{width:100%!important;min-width:100%!important}
      .email-body{padding:28px 24px!important}
      .accent-stripe{height:4px!important}
    }
  </style>
</head>`;

// =============================================
// Branded Outreach Template (Premium)
// =============================================

export function brandedOutreachEmail({
  emailBody,
  subject,
  investorName,
  context,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  investorName: string;
  context?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;

  const { opening, closing } = splitBody(emailBody);

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      
      <!-- Top Accent Stripe -->
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>

      ${brandHeader(b, accent, accentDark, textColor)}

      <div class="email-body" style="padding:0 36px 36px;">

        ${opening}

        ${context ? contextBox(context, accent, accentDark) : ""}

        ${closing}

        ${b.signature ? `
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;">
            <p style="color:#334155;line-height:1.7;margin:0;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${b.signature.replace(/\n/g, "<br>")}</p>
          </div>
        ` : ""}

        ${b.ctaText && b.ctaUrl ? `
          <div style="margin-top:28px;">
            <a href="${b.ctaUrl}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              ${b.ctaText} &rarr;
            </a>
          </div>
        ` : ""}
      </div>

      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body>
</html>`;

  // Plain text version
  const plainParas = emailBody.split(/\n\n+/).filter(Boolean);
  const openingText = plainParas.slice(0, 2).join("\n\n");
  const closingText = plainParas.slice(2).join("\n\n");
  const text = `${openingText}\n\n${context ? `[Why We're Reaching Out]\n${context}\n\n` : ""}${closingText}\n\n---\n${brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;

  return { html, text };
}

// =============================================
// Branded Follow-up Template (Premium)
// =============================================

export function brandedFollowUpEmail({
  emailBody,
  subject,
  investorName,
  originalSubject,
  context,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  investorName: string;
  originalSubject?: string;
  context?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;

  const { opening, closing } = splitBody(emailBody);

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>

      ${brandHeader(b, accent, accentDark, textColor, true)}

      <div class="email-body" style="padding:0 36px 32px;">
        ${originalSubject ? `
          <div style="background:#f8fafc;border-radius:8px;padding:10px 16px;margin-bottom:20px;border-left:3px solid ${accent};">
            <p style="color:#64748b;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Re: ${originalSubject}</p>
          </div>
        ` : ""}

        ${opening}

        ${context ? contextBox(context, accent, accentDark) : ""}

        ${closing}

        ${b.signature ? `
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;">
            <p style="color:#334155;line-height:1.7;margin:0;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${b.signature.replace(/\n/g, "<br>")}</p>
          </div>
        ` : ""}
      </div>

      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body>
</html>`;

  const plainParas = emailBody.split(/\n\n+/).filter(Boolean);
  const openingText = plainParas.slice(0, 2).join("\n\n");
  const closingText = plainParas.slice(2).join("\n\n");
  const textContent = `${openingText}\n\n${context ? `[Why We're Reaching Out]\n${context}\n\n` : ""}${closingText}\n\n---\n${brandName} | ${b.tagline}\nUnsubscribe: ${unsubUrl}`;

  return { html, text: textContent };
}

// =============================================
// Branded Cold Intro Template (Premium)
// =============================================

export function brandedColdIntroEmail({
  emailBody,
  subject,
  investorName,
  context,
  socialProof,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  investorName: string;
  context?: string;
  socialProof?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#1a1a1a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;

  const { opening, closing } = splitBody(emailBody);

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>

      ${brandHeader(b, accent, accentDark, textColor)}

      <div class="email-body" style="padding:0 36px 36px;">

        ${opening}

        ${context ? contextBox(context, accent, accentDark) : ""}

        ${closing}

        ${socialProof ? `
        <div style="margin-top:24px;padding:16px 20px;background:#f8fafc;border-radius:8px;border-left:3px solid ${withAlpha(accent, 0.3)};">
          <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;font-style:italic;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            "${socialProof}"
          </p>
        </div>
        ` : ""}

        ${b.signature ? `
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;">
            <p style="color:#334155;line-height:1.7;margin:0;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${b.signature.replace(/\n/g, "<br>")}</p>
          </div>
        ` : ""}

        ${b.ctaText && b.ctaUrl ? `
          <div style="margin-top:28px;">
            <a href="${b.ctaUrl}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              ${b.ctaText} &rarr;
            </a>
          </div>
        ` : ""}
      </div>

      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body>
</html>`;

  const plainParas = emailBody.split(/\n\n+/).filter(Boolean);
  const openingText = plainParas.slice(0, 2).join("\n\n");
  const closingText = plainParas.slice(2).join("\n\n");
  const text = `${openingText}\n\n${context ? `[Why We're Reaching Out]\n${context}\n\n` : ""}${closingText}${socialProof ? `\n\n"${socialProof}"` : ""}\n\n---\n${brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;

  return { html, text };
}

// =============================================
// Investor Intro Template
// =============================================
// Introducing a startup to an investor (or vice versa)

export function brandedInvestorIntroEmail({
  emailBody,
  subject,
  investorName,
  matchReason,
  startupName,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  investorName: string;
  matchReason?: string;
  startupName?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;
  const formattedBody = formatBodyParagraphs(emailBody);

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>
      ${brandHeader(b, accent, accentDark, textColor)}
      <div class="email-body" style="padding:0 36px 36px;">
        ${formattedBody}
        ${matchReason ? `<div style="margin:24px 0 28px;"><div style="height:2px;background:linear-gradient(to right,${accent},transparent);margin:0 0 16px;border-radius:1px;"></div><p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">The Match</p><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">${matchReason}</p></div>` : ""}
        ${b.signature ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">${b.signature.replace(/\n/g, "<br>")}</p></div>` : ""}
        ${b.ctaText && b.ctaUrl ? `<div style="margin-top:28px;"><a href="${b.ctaUrl}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">${b.ctaText} &rarr;</a></div>` : ""}
      </div>
      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body></html>`;

  const text = `${emailBody}${matchReason ? `\n\n[The Match]\n${matchReason}` : ""}\n\n---\n${brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;
  return { html, text };
}

// =============================================
// Partnership Proposal Template
// =============================================

export function brandedPartnershipEmail({
  emailBody,
  subject,
  partnerName,
  proposalSummary,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  partnerName: string;
  proposalSummary?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;
  const formattedBody = formatBodyParagraphs(emailBody);

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>
      ${brandHeader(b, accent, accentDark, textColor)}
      <div class="email-body" style="padding:0 36px 36px;">
        ${formattedBody}
        ${proposalSummary ? `<div style="margin:24px 0 28px;padding:20px 24px;background:#f8fafc;border-radius:10px;border-left:3px solid ${accent};"><p style="color:${accentDark};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">Proposal Summary</p><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">${proposalSummary}</p></div>` : ""}
        ${b.signature ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">${b.signature.replace(/\n/g, "<br>")}</p></div>` : ""}
        ${b.ctaText && b.ctaUrl ? `<div style="margin-top:28px;"><a href="${b.ctaUrl}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">${b.ctaText} &rarr;</a></div>` : ""}
      </div>
      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body></html>`;

  const text = `${emailBody}${proposalSummary ? `\n\n[Proposal Summary]\n${proposalSummary}` : ""}\n\n---\n${brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;
  return { html, text };
}

// =============================================
// Event Invitation Template
// =============================================

export function brandedEventInviteEmail({
  emailBody,
  subject,
  eventName,
  eventDate,
  eventTime,
  eventLocation,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  emailBody: string;
  subject: string;
  eventName: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;
  const formattedBody = formatBodyParagraphs(emailBody);

  const pills = [];
  if (eventDate) pills.push(`<span style="display:inline-block;background:${withAlpha(accent, 0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">${eventDate}</span>`);
  if (eventTime) pills.push(`<span style="display:inline-block;background:${withAlpha(accent, 0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">${eventTime}</span>`);
  if (eventLocation) pills.push(`<span style="display:inline-block;background:${withAlpha(accent, 0.08)};color:${accentDark};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 4px 4px 0;">${eventLocation}</span>`);

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>
      ${brandHeader(b, accent, accentDark, textColor)}
      <div class="email-body" style="padding:0 36px 36px;">
        ${eventName ? `<div style="text-align:center;margin:0 0 24px;padding:20px 24px;background:linear-gradient(135deg,${withAlpha(accent, 0.06)} 0%,${withAlpha(accent, 0.02)} 100%);border-radius:10px;"><p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">You're Invited</p><h2 style="color:#0f172a;margin:0 0 12px;font-size:18px;font-weight:600;letter-spacing:-0.2px;">${eventName}</h2>${pills.length > 0 ? `<div>${pills.join("")}</div>` : ""}</div>` : ""}
        ${formattedBody}
        ${b.ctaText && b.ctaUrl ? `<div style="text-align:center;margin:28px 0 0;"><a href="${b.ctaUrl}" style="display:inline-block;background:${accent};color:${textColor};padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">${b.ctaText} &rarr;</a></div>` : ""}
        ${b.signature ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;"><p style="color:#334155;line-height:1.7;margin:0;font-size:14px;">${b.signature.replace(/\n/g, "<br>")}</p></div>` : ""}
      </div>
      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body></html>`;

  const dt = [eventDate, eventTime, eventLocation].filter(Boolean).join(" | ");
  const text = `${eventName ? `[${eventName}]\n${dt ? dt + "\n\n" : ""}` : ""}${emailBody}\n\n---\n${brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;
  return { html, text };
}

// =============================================
// Newsletter Template
// =============================================

export function brandedNewsletterEmail({
  subject,
  headline,
  articles,
  branding: rawBranding,
  unsubscribeEmail,
}: {
  subject: string;
  headline: string;
  articles: Array<{ title: string; summary: string; url?: string }>;
  branding?: UserBranding;
  unsubscribeEmail?: string;
}): { html: string; text: string } {
  const b = { ...DEFAULT_BRANDING, ...rawBranding };
  const accent = b.accentColor || DEFAULT_BRANDING.accentColor!;
  const accentDark = darken(accent, 0.2);
  const textColor = isLight(accent) ? "#0f172a" : "#ffffff";
  const brandName = b.brandName || DEFAULT_BRANDING.brandName!;
  const unsubUrl = `${UNSUBSCRIBE_BASE}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail || "")}`;

  const cards = articles.map((a, i) => `<div style="${i < articles.length - 1 ? "margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9;" : ""}"><h3 style="color:#0f172a;margin:0 0 6px;font-size:15px;font-weight:600;">${a.title}</h3><p style="color:#64748b;margin:0 0 ${a.url ? 8 : 0}px;font-size:14px;line-height:1.6;">${a.summary}</p>${a.url ? `<a href="${a.url}" style="color:${accent};font-size:13px;font-weight:600;text-decoration:none;">Read more &rarr;</a>` : ""}</div>`).join("");

  const html = `${EMAIL_HEAD}
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="padding:32px 16px;">
    <div class="email-container" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">
      <div class="accent-stripe" style="height:3px;background:linear-gradient(to right,${accent},${accentDark});"></div>
      ${brandHeader(b, accent, accentDark, textColor)}
      <div class="email-body" style="padding:0 36px 36px;">
        ${headline ? `<h2 style="color:#0f172a;margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:-0.3px;line-height:1.3;">${headline}</h2>` : ""}
        ${cards}
        ${b.ctaText && b.ctaUrl ? `<div style="text-align:center;margin:28px 0 0;"><a href="${b.ctaUrl}" style="display:inline-block;background:${accent};color:${textColor};padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">${b.ctaText} &rarr;</a></div>` : ""}
      </div>
      ${emailFooter(b, accent, unsubUrl)}
    </div>
  </div>
</body></html>`;

  const at = articles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.summary}${a.url ? `\n   ${a.url}` : ""}`).join("\n\n");
  const text = `${headline ? `${headline}\n\n` : ""}${at}\n\n---\n${brandName} | ${b.tagline}\n${b.website || ""}\n\nSent via Capital OS | ${COMPANY_ADDRESS}\nUnsubscribe: ${unsubUrl}`;
  return { html, text };
}

// =============================================
// Helper: Format body paragraphs
// =============================================
function formatBodyParagraphs(emailBody: string): string {
  return emailBody.split(/\n\n+/).map(p => { const t = p.trim(); if (!t) return ""; return `<p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 18px;letter-spacing:-0.01em;">${t.replace(/\n/g, "<br>")}</p>`; }).filter(Boolean).join("\n");
}
