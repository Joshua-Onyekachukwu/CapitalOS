// =============================================
// Pitch Deck Generator
// =============================================
// Generates company-specific investor pitch decks using AI content + PptxGenJS.
// Server-side only — never exposed to client bundle.

import PptxGenJS from "pptxgenjs";
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

export interface DeckPlan {
  companyName: string;
  slides: DeckSlide[];
  designDirection: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  };
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
}

// =============================================
// Design Direction by Industry
// =============================================

const DESIGN_DIRECTIONS: Record<string, DeckPlan["designDirection"]> = {
  fintech: { primaryColor: "1B5E20", secondaryColor: "2E7D32", accentColor: "4CAF50", backgroundColor: "FFFFFF", textColor: "212121" },
  healthtech: { primaryColor: "0D47A1", secondaryColor: "1565C0", accentColor: "42A5F5", backgroundColor: "FFFFFF", textColor: "212121" },
  ai: { primaryColor: "4A148C", secondaryColor: "6A1B9A", accentColor: "AB47BC", backgroundColor: "FFFFFF", textColor: "212121" },
  saas: { primaryColor: "E65100", secondaryColor: "F57C00", accentColor: "FFB74D", backgroundColor: "FFFFFF", textColor: "212121" },
  enterprise: { primaryColor: "263238", secondaryColor: "37474F", accentColor: "607D8B", backgroundColor: "FFFFFF", textColor: "212121" },
  consumer: { primaryColor: "880E4F", secondaryColor: "AD1457", accentColor: "EC407A", backgroundColor: "FFFFFF", textColor: "212121" },
  default: { primaryColor: "1A237E", secondaryColor: "283593", accentColor: "5C6BC0", backgroundColor: "FFFFFF", textColor: "212121" },
};

function getDesignDirection(industry: string): DeckPlan["designDirection"] {
  const lower = industry?.toLowerCase() || "";
  for (const [key, direction] of Object.entries(DESIGN_DIRECTIONS)) {
    if (lower.includes(key)) return direction;
  }
  return DESIGN_DIRECTIONS.default;
}

// =============================================
// AI Narrative Generation
// =============================================

async function generateNarrative(input: DeckInput): Promise<DeckSlide[]> {
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

Generate a JSON array of slides. Each slide must have:
- type: one of "cover", "problem", "solution", "market", "product", "traction", "business_model", "competition", "team", "ask", "vision"
- title: slide title (short, punchy)
- content: 1-2 sentence main message
- bullets: array of 2-4 key points (optional, for list slides)
- metrics: array of {label, value} for data slides (optional)

Return ONLY the JSON array, no markdown, no code blocks.

IMPORTANT: Use only the real data provided above. Do NOT invent revenue, customers, partnerships, or metrics that were not provided. If data is missing for a slide type, note that in the content field.`;

  const response = await chatCompletion({
    task: "email_drafting", // Uses higher temperature for creative content
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Parse failed
  }

  // Fallback: generate basic slides from input
  return generateFallbackSlides(input);
}

function generateFallbackSlides(input: DeckInput): DeckSlide[] {
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

  return slides;
}

// =============================================
// PPTX Generation
// =============================================

async function generatePptx(plan: DeckPlan): Promise<Buffer> {
  const pptx = new PptxGenJS();

  // Set presentation metadata
  pptx.author = plan.companyName;
  pptx.subject = `${plan.companyName} — Investor Pitch Deck`;
  pptx.title = `${plan.companyName} Pitch Deck`;

  const { primaryColor, secondaryColor, accentColor, backgroundColor, textColor } = plan.designDirection;

  for (const slide of plan.slides) {
    const pptxSlide = pptx.addSlide();

    // Background
    pptxSlide.background = { color: backgroundColor };

    switch (slide.type) {
      case "cover":
        renderCoverSlide(pptxSlide, slide, plan, primaryColor);
        break;
      case "team":
        renderTeamSlide(pptxSlide, slide, primaryColor, textColor);
        break;
      case "traction":
        renderMetricSlide(pptxSlide, slide, primaryColor, accentColor, textColor);
        break;
      case "ask":
        renderAskSlide(pptxSlide, slide, primaryColor, accentColor);
        break;
      default:
        renderStandardSlide(pptxSlide, slide, primaryColor, secondaryColor, textColor);
        break;
    }
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

function renderCoverSlide(slide: any, data: DeckSlide, plan: DeckPlan, primaryColor: string) {
  // Left panel with color
  slide.addShape("rect", { x: 0, y: 0, w: 4.5, h: 7.5, fill: { color: primaryColor } });

  // Company name
  slide.addText(plan.companyName, {
    x: 0.5, y: 2.0, w: 3.5, h: 1.5,
    fontSize: 36, fontFace: "Arial", color: "FFFFFF", bold: true,
  });

  // Tagline
  slide.addText(data.content, {
    x: 0.5, y: 3.5, w: 3.5, h: 1.0,
    fontSize: 16, fontFace: "Arial", color: "FFFFFF", italic: true,
  });

  // Right side — "Investor Pitch Deck"
  slide.addText("Investor Pitch Deck", {
    x: 5.0, y: 3.0, w: 4.5, h: 1.0,
    fontSize: 14, fontFace: "Arial", color: "999999", align: "center",
  });
}

function renderStandardSlide(slide: any, data: DeckSlide, primaryColor: string, secondaryColor: string, textColor: string) {
  // Accent bar at top
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: primaryColor } });

  // Slide number area
  slide.addText("", { x: 9.0, y: 7.0, w: 0.8, h: 0.3, fontSize: 10, color: "999999", align: "right" });

  // Title
  slide.addText(data.title, {
    x: 0.6, y: 0.4, w: 8.8, h: 0.8,
    fontSize: 28, fontFace: "Arial", color: primaryColor, bold: true,
  });

  // Content
  slide.addText(data.content, {
    x: 0.6, y: 1.4, w: 8.8, h: 1.5,
    fontSize: 16, fontFace: "Arial", color: textColor, lineSpacingMultiple: 1.3,
  });

  // Bullets
  if (data.bullets && data.bullets.length > 0) {
    const bulletText = data.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 14, color: textColor, breakType: "none" } }));
    slide.addText(bulletText, {
      x: 0.6, y: 3.2, w: 8.8, h: 3.5,
      fontFace: "Arial", lineSpacingMultiple: 1.5, valign: "top",
    });
  }
}

function renderMetricSlide(slide: any, data: DeckSlide, primaryColor: string, accentColor: string, textColor: string) {
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: primaryColor } });

  slide.addText(data.title, {
    x: 0.6, y: 0.4, w: 8.8, h: 0.8,
    fontSize: 28, fontFace: "Arial", color: primaryColor, bold: true,
  });

  slide.addText(data.content, {
    x: 0.6, y: 1.3, w: 8.8, h: 0.8,
    fontSize: 16, fontFace: "Arial", color: textColor,
  });

  if (data.metrics && data.metrics.length > 0) {
    const metricWidth = Math.min(2.8, 8.8 / data.metrics.length);
    const startX = (10 - metricWidth * data.metrics.length) / 2;

    data.metrics.forEach((metric, i) => {
      const x = startX + i * metricWidth;
      // Metric card background
      slide.addShape("rect", {
        x, y: 2.8, w: metricWidth - 0.2, h: 2.5,
        fill: { color: "F5F5F5" }, rectRadius: 0.1,
      });
      // Metric value
      slide.addText(metric.value, {
        x, y: 3.2, w: metricWidth - 0.2, h: 1.2,
        fontSize: 32, fontFace: "Arial", color: primaryColor, bold: true, align: "center",
      });
      // Metric label
      slide.addText(metric.label, {
        x, y: 4.3, w: metricWidth - 0.2, h: 0.6,
        fontSize: 12, fontFace: "Arial", color: "666666", align: "center",
      });
    });
  }
}

function renderTeamSlide(slide: any, data: DeckSlide, primaryColor: string, textColor: string) {
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: primaryColor } });

  slide.addText(data.title, {
    x: 0.6, y: 0.4, w: 8.8, h: 0.8,
    fontSize: 28, fontFace: "Arial", color: primaryColor, bold: true,
  });

  if (data.bullets && data.bullets.length > 0) {
    const memberWidth = Math.min(2.5, 8.8 / data.bullets.length);
    const startX = (10 - memberWidth * data.bullets.length) / 2;

    data.bullets.forEach((member, i) => {
      const x = startX + i * memberWidth;
      // Avatar circle
      slide.addShape("ellipse", {
        x: x + (memberWidth - 1.2) / 2, y: 1.8, w: 1.2, h: 1.2,
        fill: { color: "E8EAF6" },
      });
      // Initials
      const initials = member.split(" — ")[0]?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??";
      slide.addText(initials, {
        x: x + (memberWidth - 1.2) / 2, y: 2.1, w: 1.2, h: 0.6,
        fontSize: 20, fontFace: "Arial", color: primaryColor, bold: true, align: "center", valign: "middle",
      });
      // Name and title
      const parts = member.split(" — ");
      slide.addText(parts[0] || member, {
        x, y: 3.2, w: memberWidth, h: 0.5,
        fontSize: 13, fontFace: "Arial", color: textColor, bold: true, align: "center",
      });
      if (parts[1]) {
        slide.addText(parts[1], {
          x, y: 3.6, w: memberWidth, h: 0.4,
          fontSize: 11, fontFace: "Arial", color: "666666", align: "center",
        });
      }
    });
  }
}

function renderAskSlide(slide: any, data: DeckSlide, primaryColor: string, accentColor: string) {
  // Full background
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 7.5, fill: { color: primaryColor } });

  slide.addText(data.title, {
    x: 0.6, y: 1.5, w: 8.8, h: 1.0,
    fontSize: 36, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center",
  });

  slide.addText(data.content, {
    x: 1.0, y: 2.8, w: 8.0, h: 1.2,
    fontSize: 20, fontFace: "Arial", color: "FFFFFF", align: "center",
  });

  if (data.bullets && data.bullets.length > 0) {
    const bulletText = data.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 16, color: "FFFFFF" } }));
    slide.addText(bulletText, {
      x: 2.0, y: 4.2, w: 6.0, h: 2.5,
      fontFace: "Arial", lineSpacingMultiple: 1.5, align: "center",
    });
  }
}

// =============================================
// Main Export
// =============================================

export async function generatePitchDeck(input: DeckInput): Promise<{
  pptxBuffer: Buffer;
  slides: DeckSlide[];
  designDirection: DeckPlan["designDirection"];
}> {
  // 1. Generate narrative with AI
  const slides = await generateNarrative(input);

  // 2. Determine design direction
  const designDirection = getDesignDirection(input.industry);

  // 3. Create deck plan
  const plan: DeckPlan = {
    companyName: input.companyName,
    slides,
    designDirection,
  };

  // 4. Generate PPTX
  const pptxBuffer = await generatePptx(plan);

  return { pptxBuffer, slides, designDirection };
}
