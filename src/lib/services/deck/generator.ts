// =============================================
// Pitch Deck Generator — Full Engine
// =============================================
// Generates company-specific investor pitch decks using AI content + PptxGenJS.
// Supports 5 composable design styles, PPTX and PDF export.
// Server-side only — never exposed to client bundle.

import PptxGenJS from "pptxgenjs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { chatCompletion } from "@/lib/ai";

// =============================================
// Types
// =============================================

export interface DeckSlide {
  type: string;
  title: string;
  content: string;
  bullets?: string[];
  metrics?: Array<{ label: string; value: string }>;
  notes?: string;
}

export interface DesignDirection {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontHeading?: string;
  fontBody?: string;
}

export interface DeckPlan {
  companyName: string;
  slides: DeckSlide[];
  designDirection: DesignDirection;
  style: string;
}

export interface DeckInput {
  companyName: string;
  oneLiner: string;
  description: string;
  differentiator: string;
  targetCustomer: string;
  industry: string;
  companyStage: string;
  currentlyRaising: boolean;
  roundType: string;
  fundingAmount: number | null;
  mrr: number | null;
  arr: number | null;
  customerCount: number | null;
  growthRate: string;
  milestones: string[];
  teamMembers: Array<{ name: string; title: string; isFounder: boolean }>;
  style?: string;
  slideCount?: number;
}

// =============================================
// 5 Composable Design Styles
// =============================================

const STYLE_DESIGNS: Record<string, DesignDirection> = {
  investor: {
    primaryColor: "1A237E",
    secondaryColor: "283593",
    accentColor: "5C6BC0",
    backgroundColor: "FFFFFF",
    textColor: "212121",
    fontHeading: "Arial",
    fontBody: "Arial",
  },
  minimal: {
    primaryColor: "37474F",
    secondaryColor: "546E7A",
    accentColor: "90A4AE",
    backgroundColor: "FFFFFF",
    textColor: "263238",
    fontHeading: "Helvetica Neue",
    fontBody: "Helvetica Neue",
  },
  bold: {
    primaryColor: "B71C1C",
    secondaryColor: "C62828",
    accentColor: "EF5350",
    backgroundColor: "FAFAFA",
    textColor: "212121",
    fontHeading: "Arial Black",
    fontBody: "Arial",
  },
  corporate: {
    primaryColor: "0D47A1",
    secondaryColor: "1565C0",
    accentColor: "42A5F5",
    backgroundColor: "FFFFFF",
    textColor: "1B5E20",
    fontHeading: "Calibri",
    fontBody: "Calibri",
  },
  modern: {
    primaryColor: "6A1B9A",
    secondaryColor: "8E24AA",
    accentColor: "CE93D8",
    backgroundColor: "FAFAFA",
    textColor: "212121",
    fontHeading: "Poppins",
    fontBody: "Inter",
  },
};

// Industry-specific accent overrides (blended with style)
const INDUSTRY_ACCENTS: Record<string, { primaryColor?: string; accentColor?: string }> = {
  fintech: { primaryColor: "1B5E20", accentColor: "4CAF50" },
  healthtech: { primaryColor: "0D47A1", accentColor: "42A5F5" },
  ai: { primaryColor: "4A148C", accentColor: "AB47BC" },
  saas: { primaryColor: "E65100", accentColor: "FFB74D" },
  enterprise: { primaryColor: "263238", accentColor: "607D8B" },
  consumer: { primaryColor: "880E4F", accentColor: "EC407A" },
  climatetech: { primaryColor: "1B5E20", accentColor: "66BB6A" },
  deeptech: { primaryColor: "311B92", accentColor: "7C4DFF" },
};

function getDesignDirection(style: string, industry: string): DesignDirection {
  const base = { ...(STYLE_DESIGNS[style] || STYLE_DESIGNS.investor) };

  // Blend in industry accent if available
  const lower = industry?.toLowerCase() || "";
  for (const [key, accent] of Object.entries(INDUSTRY_ACCENTS)) {
    if (lower.includes(key)) {
      if (accent.primaryColor) base.primaryColor = accent.primaryColor;
      if (accent.accentColor) base.accentColor = accent.accentColor;
      break;
    }
  }

  return base;
}

// =============================================
// AI Narrative Generation
// =============================================

async function generateNarrative(input: DeckInput): Promise<DeckSlide[]> {
  const slideCount = input.slideCount || 10;
  const prompt = `You are an expert pitch deck writer for startup founders. Generate a complete pitch deck narrative for this company.

COMPANY: ${input.companyName}
DESCRIPTION: ${input.oneLiner} — ${input.description}
DIFFERENTIATOR: ${input.differentiator}
TARGET CUSTOMER: ${input.targetCustomer}
INDUSTRY: ${input.industry}
STAGE: ${input.companyStage}
${input.currentlyRaising ? `RAISING: ${input.roundType} — $${input.fundingAmount?.toLocaleString() || "?"}` : ""}
${input.mrr ? `MRR: $${input.mrr.toLocaleString()}` : ""}
${input.customerCount ? `CUSTOMERS: ${input.customerCount}` : ""}
${input.growthRate ? `GROWTH: ${input.growthRate}` : ""}
${input.milestones.length > 0 ? `MILESTONES: ${input.milestones.join(", ")}` : ""}
TEAM: ${input.teamMembers.map((m) => `${m.name} (${m.title})`).join(", ")}

Generate EXACTLY ${slideCount} slides as a JSON array. Each slide must have:
- type: one of "cover", "problem", "solution", "market", "product", "traction", "business_model", "competition", "team", "ask", "vision"
- title: slide title (short, punchy)
- content: 1-2 sentence main message
- bullets: array of 2-4 key points (optional, for list slides)
- metrics: array of {label, value} for data slides (optional)

Return ONLY the JSON array, no markdown, no code blocks.

IMPORTANT: Use only the real data provided above. Do NOT invent revenue, customers, partnerships, or metrics that were not provided. If data is missing for a slide type, note that in the content field.`;

  const response = await chatCompletion({
    task: "email_drafting",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const slides = JSON.parse(jsonMatch[0]);
      // Trim to requested count
      return slides.slice(0, slideCount);
    }
  } catch {
    // Parse failed
  }

  return generateFallbackSlides(input, slideCount);
}

function generateFallbackSlides(input: DeckInput, slideCount: number): DeckSlide[] {
  const slides: DeckSlide[] = [
    { type: "cover", title: input.companyName, content: input.oneLiner },
    { type: "problem", title: "The Problem", content: `${input.targetCustomer} struggle with a problem that ${input.companyName} solves.` },
    { type: "solution", title: "Our Solution", content: input.description || input.oneLiner },
    { type: "product", title: "The Product", content: input.differentiator || "Our product delivers unique value to customers." },
  ];

  if (input.mrr || input.customerCount) {
    const metrics: DeckSlide["metrics"] = [];
    if (input.mrr) metrics.push({ label: "MRR", value: `$${input.mrr.toLocaleString()}` });
    if (input.customerCount) metrics.push({ label: "Customers", value: String(input.customerCount) });
    if (input.growthRate) metrics.push({ label: "Growth", value: input.growthRate });
    slides.push({ type: "traction", title: "Traction", content: "Our progress speaks for itself.", metrics });
  }

  slides.push(
    { type: "market", title: "Market Opportunity", content: `${input.industry} is a large and growing market.` },
    { type: "business_model", title: "Business Model", content: `${input.companyName} generates revenue through ${input.industry || "our core product"}.` },
  );

  if (input.teamMembers.length > 0) {
    slides.push({
      type: "team",
      title: "Our Team",
      content: "The team behind the mission.",
      bullets: input.teamMembers.map((m) => `${m.name} — ${m.title}`),
    });
  }

  if (input.currentlyRaising) {
    slides.push({
      type: "ask",
      title: "The Ask",
      content: `We are raising ${input.roundType || "a round"}${input.fundingAmount ? ` of $${input.fundingAmount.toLocaleString()}` : ""}.`,
      bullets: ["Accelerate growth", "Expand team", "Scale operations"],
    });
  }

  slides.push({ type: "vision", title: "Vision", content: `Building the future of ${input.industry || "our industry"}.` });

  return slides.slice(0, slideCount);
}

// =============================================
// PPTX Generation
// =============================================

async function generatePptx(plan: DeckPlan): Promise<Buffer> {
  const pptx = new PptxGenJS();

  pptx.author = plan.companyName;
  pptx.subject = `${plan.companyName} — Investor Pitch Deck`;
  pptx.title = `${plan.companyName} Pitch Deck`;
  pptx.layout = "LAYOUT_WIDE";

  const d = plan.designDirection;
  const fontH = d.fontHeading || "Arial";
  const fontB = d.fontBody || "Arial";

  for (const slide of plan.slides) {
    const s = pptx.addSlide();
    s.background = { color: d.backgroundColor };

    switch (slide.type) {
      case "cover": renderCoverPptx(s, slide, plan, d, fontH); break;
      case "team": renderTeamPptx(s, slide, d, fontH, fontB); break;
      case "traction": renderMetricPptx(s, slide, d, fontH, fontB); break;
      case "ask": renderAskPptx(s, slide, d, fontH, fontB); break;
      default: renderStandardPptx(s, slide, d, fontH, fontB); break;
    }
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

function renderCoverPptx(s: any, data: DeckSlide, plan: DeckPlan, d: DesignDirection, fontH: string) {
  // Left panel
  s.addShape("rect", { x: 0, y: 0, w: 5.0, h: 7.5, fill: { color: d.primaryColor } });
  // Subtle accent stripe
  s.addShape("rect", { x: 0, y: 3.2, w: 5.0, h: 0.06, fill: { color: d.accentColor } });

  s.addText(plan.companyName, {
    x: 0.6, y: 1.8, w: 3.8, h: 1.5,
    fontSize: 38, fontFace: fontH, color: "FFFFFF", bold: true,
  });

  s.addText(data.content, {
    x: 0.6, y: 3.5, w: 3.8, h: 1.0,
    fontSize: 16, fontFace: fontH, color: "FFFFFF", italic: true,
  });

  // Right side
  s.addText("Investor Pitch Deck", {
    x: 5.5, y: 3.0, w: 4.0, h: 1.0,
    fontSize: 14, fontFace: fontH, color: "999999", align: "center",
  });

  // Decorative circle
  s.addShape("ellipse", {
    x: 7.0, y: 4.5, w: 2.0, h: 2.0,
    fill: { color: d.accentColor, transparency: 85 },
  });
}

function renderStandardPptx(s: any, data: DeckSlide, d: DesignDirection, fontH: string, fontB: string) {
  // Top accent bar
  s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: d.primaryColor } });

  // Side accent
  s.addShape("rect", { x: 0, y: 0.8, w: 0.08, h: 1.0, fill: { color: d.accentColor } });

  // Title
  s.addText(data.title, {
    x: 0.6, y: 0.5, w: 12.0, h: 0.9,
    fontSize: 30, fontFace: fontH, color: d.primaryColor, bold: true,
  });

  // Content
  s.addText(data.content, {
    x: 0.6, y: 1.6, w: 12.0, h: 1.8,
    fontSize: 16, fontFace: fontB, color: d.textColor, lineSpacingMultiple: 1.3,
  });

  // Bullets
  if (data.bullets && data.bullets.length > 0) {
    const bulletText = data.bullets.map((b) => ({
      text: b,
      options: { bullet: true, fontSize: 14, color: d.textColor, breakType: "none" },
    }));
    s.addText(bulletText, {
      x: 0.6, y: 3.6, w: 12.0, h: 3.5,
      fontFace: fontB, lineSpacingMultiple: 1.5, valign: "top",
    });
  }
}

function renderMetricPptx(s: any, data: DeckSlide, d: DesignDirection, fontH: string, fontB: string) {
  s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: d.primaryColor } });

  s.addText(data.title, {
    x: 0.6, y: 0.4, w: 12.0, h: 0.9,
    fontSize: 30, fontFace: fontH, color: d.primaryColor, bold: true,
  });

  s.addText(data.content, {
    x: 0.6, y: 1.4, w: 12.0, h: 0.8,
    fontSize: 16, fontFace: fontB, color: d.textColor,
  });

  if (data.metrics && data.metrics.length > 0) {
    const count = data.metrics.length;
    const metricWidth = Math.min(3.5, 12.0 / count);
    const startX = (13.33 - metricWidth * count) / 2;

    data.metrics.forEach((metric, i) => {
      const x = startX + i * metricWidth;
      // Card background
      s.addShape("rect", {
        x, y: 2.8, w: metricWidth - 0.2, h: 3.0,
        fill: { color: "F5F5F5" }, rectRadius: 0.1,
      });
      // Accent top line on card
      s.addShape("rect", {
        x: x + 0.3, y: 2.8, w: metricWidth - 0.8, h: 0.04,
        fill: { color: d.accentColor },
      });
      // Value
      s.addText(metric.value, {
        x, y: 3.3, w: metricWidth - 0.2, h: 1.4,
        fontSize: 36, fontFace: fontH, color: d.primaryColor, bold: true, align: "center",
      });
      // Label
      s.addText(metric.label, {
        x, y: 4.7, w: metricWidth - 0.2, h: 0.6,
        fontSize: 13, fontFace: fontB, color: "666666", align: "center",
      });
    });
  }
}

function renderTeamPptx(s: any, data: DeckSlide, d: DesignDirection, fontH: string, fontB: string) {
  s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: d.primaryColor } });

  s.addText(data.title, {
    x: 0.6, y: 0.4, w: 12.0, h: 0.9,
    fontSize: 30, fontFace: fontH, color: d.primaryColor, bold: true,
  });

  if (data.bullets && data.bullets.length > 0) {
    const count = data.bullets.length;
    const memberWidth = Math.min(3.0, 12.0 / count);
    const startX = (13.33 - memberWidth * count) / 2;

    data.bullets.forEach((member, i) => {
      const x = startX + i * memberWidth;
      // Avatar circle
      s.addShape("ellipse", {
        x: x + (memberWidth - 1.4) / 2, y: 1.8, w: 1.4, h: 1.4,
        fill: { color: "E8EAF6" },
      });
      // Initials
      const initials = member.split(" — ")[0]?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??";
      s.addText(initials, {
        x: x + (memberWidth - 1.4) / 2, y: 2.1, w: 1.4, h: 0.7,
        fontSize: 22, fontFace: fontH, color: d.primaryColor, bold: true, align: "center", valign: "middle",
      });
      // Name
      const parts = member.split(" — ");
      s.addText(parts[0] || member, {
        x, y: 3.4, w: memberWidth, h: 0.5,
        fontSize: 14, fontFace: fontB, color: d.textColor, bold: true, align: "center",
      });
      if (parts[1]) {
        s.addText(parts[1], {
          x, y: 3.8, w: memberWidth, h: 0.4,
          fontSize: 12, fontFace: fontB, color: "666666", align: "center",
        });
      }
    });
  }
}

function renderAskPptx(s: any, data: DeckSlide, d: DesignDirection, fontH: string, fontB: string) {
  // Full background
  s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: d.primaryColor } });

  // Accent line
  s.addShape("rect", { x: 4.0, y: 2.2, w: 5.33, h: 0.04, fill: { color: d.accentColor } });

  s.addText(data.title, {
    x: 1.0, y: 2.5, w: 11.33, h: 1.2,
    fontSize: 40, fontFace: fontH, color: "FFFFFF", bold: true, align: "center",
  });

  s.addText(data.content, {
    x: 1.5, y: 3.8, w: 10.33, h: 1.2,
    fontSize: 20, fontFace: fontB, color: "FFFFFF", align: "center",
  });

  if (data.bullets && data.bullets.length > 0) {
    const bulletText = data.bullets.map((b) => ({
      text: b,
      options: { bullet: true, fontSize: 16, color: "FFFFFF" },
    }));
    s.addText(bulletText, {
      x: 3.0, y: 5.2, w: 7.33, h: 2.0,
      fontFace: fontB, lineSpacingMultiple: 1.5, align: "center",
    });
  }
}

// =============================================
// PDF Generation
// =============================================

async function generatePdf(plan: DeckPlan): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const d = plan.designDirection;
  // Parse hex color to RGB
  const parseHex = (hex: string) => {
    const h = hex.replace("#", "");
    return rgb(
      parseInt(h.substring(0, 2), 16) / 255,
      parseInt(h.substring(2, 4), 16) / 255,
      parseInt(h.substring(4, 6), 16) / 255
    );
  };

  const primaryRgb = parseHex(d.primaryColor);
  const textRgb = parseHex(d.textColor);
  const accentRgb = parseHex(d.accentColor);

  for (const slide of plan.slides) {
    const page = pdfDoc.addPage([1333, 750]); // Widescreen

    switch (slide.type) {
      case "cover": {
        // Left panel
        page.drawRectangle({
          x: 0, y: 0, width: 500, height: 750,
          color: primaryRgb,
        });
        // Company name
        page.drawText(plan.companyName, {
          x: 60, y: 500, size: 38, font: helveticaBold, color: rgb(1, 1, 1),
        });
        // Tagline
        page.drawText(slide.content, {
          x: 60, y: 450, size: 16, font: helvetica, color: rgb(1, 1, 1),
          maxWidth: 380,
        });
        // Right side text
        page.drawText("Investor Pitch Deck", {
          x: 600, y: 350, size: 14, font: helvetica, color: parseHex("999999"),
        });
        break;
      }
      case "ask": {
        // Full background
        page.drawRectangle({
          x: 0, y: 0, width: 1333, height: 750,
          color: primaryRgb,
        });
        page.drawText(slide.title, {
          x: 100, y: 400, size: 40, font: helveticaBold, color: rgb(1, 1, 1),
        });
        page.drawText(slide.content, {
          x: 150, y: 340, size: 20, font: helvetica, color: rgb(1, 1, 1),
          maxWidth: 1000,
        });
        if (slide.bullets) {
          slide.bullets.forEach((b, i) => {
            page.drawText(`•  ${b}`, {
              x: 300, y: 280 - i * 35, size: 16, font: helvetica, color: rgb(1, 1, 1),
              maxWidth: 700,
            });
          });
        }
        break;
      }
      default: {
        // Top accent bar
        page.drawRectangle({
          x: 0, y: 740, width: 1333, height: 10,
          color: primaryRgb,
        });
        // Title
        page.drawText(slide.title, {
          x: 60, y: 660, size: 30, font: helveticaBold, color: primaryRgb,
        });
        // Content
        page.drawText(slide.content, {
          x: 60, y: 600, size: 16, font: helvetica, color: textRgb,
          maxWidth: 1200,
        });
        // Bullets
        if (slide.bullets) {
          slide.bullets.forEach((b, i) => {
            page.drawText(`•  ${b}`, {
              x: 80, y: 540 - i * 40, size: 14, font: helvetica, color: textRgb,
              maxWidth: 1100,
            });
          });
        }
        // Metrics
        if (slide.metrics && slide.metrics.length > 0) {
          const mw = Math.min(300, 1100 / slide.metrics.length);
          const sx = (1333 - mw * slide.metrics.length) / 2;
          slide.metrics.forEach((m, i) => {
            const mx = sx + i * mw;
            // Card background
            page.drawRectangle({
              x: mx, y: 300, width: mw - 20, height: 180,
              color: parseHex("F5F5F5"),
              borderColor: parseHex("E0E0E0"),
              borderWidth: 1,
            });
            // Value
            page.drawText(m.value, {
              x: mx + 10, y: 400, size: 32, font: helveticaBold, color: primaryRgb,
            });
            // Label
            page.drawText(m.label, {
              x: mx + 10, y: 340, size: 12, font: helvetica, color: parseHex("666666"),
            });
          });
        }
        // Team avatars
        if (slide.type === "team" && slide.bullets) {
          const count = slide.bullets.length;
          const mw = Math.min(250, 1100 / count);
          const sx = (1333 - mw * count) / 2;
          slide.bullets.forEach((member, i) => {
            const mx = sx + i * mw;
            const parts = member.split(" — ");
            // Circle
            page.drawCircle({
              x: mx + mw / 2, y: 450, size: 30,
              color: parseHex("E8EAF6"),
            });
            // Name
            page.drawText(parts[0] || member, {
              x: mx, y: 390, size: 13, font: helveticaBold, color: textRgb,
            });
            if (parts[1]) {
              page.drawText(parts[1], {
                x: mx, y: 370, size: 11, font: helvetica, color: parseHex("666666"),
              });
            }
          });
        }
        break;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// =============================================
// Main Export
// =============================================

export async function generatePitchDeck(input: DeckInput): Promise<{
  pptxBuffer: Buffer;
  pdfBuffer: Buffer;
  slides: DeckSlide[];
  designDirection: DesignDirection;
  style: string;
}> {
  // 1. Generate narrative with AI
  const slides = await generateNarrative(input);

  // 2. Determine design direction from style + industry
  const style = input.style || "investor";
  const designDirection = getDesignDirection(style, input.industry);

  // 3. Create deck plan
  const plan: DeckPlan = {
    companyName: input.companyName,
    slides,
    designDirection,
    style,
  };

  // 4. Generate both PPTX and PDF
  const [pptxBuffer, pdfBuffer] = await Promise.all([
    generatePptx(plan),
    generatePdf(plan),
  ]);

  return { pptxBuffer, pdfBuffer, slides, designDirection, style };
}
