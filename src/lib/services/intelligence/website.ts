// =============================================
// Website Intelligence Extraction
// =============================================
// Extracts company information from websites: meta tags, positioning, brand signals.
// Deterministic parsing + AI analysis for positioning.

import { chatCompletion } from "@/lib/ai";

export interface WebsiteIntelligence {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  favicon: string | null;
  primaryColor: string | null;
  industry: string | null;
  positioning: string | null;
  targetAudience: string | null;
  extractedAt: string;
}

/**
 * Fetch and parse a website for company intelligence.
 */
export async function extractWebsiteIntelligence(url: string): Promise<WebsiteIntelligence | null> {
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    // Fetch the HTML
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "CapitalOS/1.0 (Company Intelligence Bot)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract meta tags
    const title = extractMeta(html, "og:title") || extractTag(html, "title") || "";
    const description = extractMeta(html, "og:description") || extractMeta(html, "description") || "";
    const keywords = extractMeta(html, "keywords")?.split(",").map((k) => k.trim()).filter(Boolean) || [];
    const ogImage = extractMeta(html, "og:image");
    const ogTitle = extractMeta(html, "og:title");
    const ogDescription = extractMeta(html, "og:description");
    const favicon = extractAttr(html, "link[rel*='icon']", "href") || extractAttr(html, "link[rel='shortcut icon']", "href");

    // Extract primary color from meta theme-color
    const primaryColor = extractMeta(html, "theme-color");

    // Use AI to extract positioning from the HTML content
    const positioning = await extractPositioning(title, description, html);

    return {
      title,
      description,
      keywords,
      ogImage,
      ogTitle,
      ogDescription,
      favicon,
      primaryColor,
      industry: positioning?.industry || null,
      positioning: positioning?.positioning || null,
      targetAudience: positioning?.targetAudience || null,
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Extract a meta tag content by property or name.
 */
function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property="${name}"[^>]*content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${name}"`, "i"),
    new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*name="${name}"`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/**
 * Extract a tag content by tag name.
 */
function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() || null;
}

/**
 * Extract an attribute from an HTML element.
 */
function extractAttr(html: string, selector: string, attr: string): string | null {
  // Simple regex-based extraction (not a full HTML parser)
  const tagMatch = html.match(new RegExp(`<link[^>]*rel="[^"]*icon[^"]*"[^>]*>`, "i"));
  if (tagMatch) {
    const attrMatch = tagMatch[0].match(new RegExp(`${attr}="([^"]*)"`));
    return attrMatch?.[1] || null;
  }
  return null;
}

/**
 * Use AI to extract positioning and industry from website content.
 */
async function extractPositioning(
  title: string,
  description: string,
  html: string
): Promise<{ industry: string | null; positioning: string | null; targetAudience: string | null } | null> {
  // Extract visible text (strip HTML tags)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  if (!textContent) return null;

  try {
    const response = await chatCompletion({
      task: "research_summary",
      messages: [{
        role: "user",
        content: `Analyze this website content and extract company intelligence.

TITLE: ${title}
DESCRIPTION: ${description}
CONTENT (first 3000 chars): ${textContent}

Return JSON with:
{
  "industry": "the company's industry/sector",
  "positioning": "one sentence describing their market positioning",
  "targetAudience": "who their target customer is"
}

Return ONLY the JSON, no markdown.`,
      }],
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // AI extraction failed
  }

  return null;
}

/**
 * Store website intelligence in company profile.
 */
export async function storeWebsiteIntelligence(
  userId: string,
  intelligence: WebsiteIntelligence
): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const updates: Record<string, unknown> = {};
  if (intelligence.positioning) updates.description = intelligence.positioning;
  if (intelligence.industry) updates.industry = intelligence.industry;

  if (Object.keys(updates).length === 0) return true;

  const { error } = await supabase
    .from("company_profiles")
    .update(updates)
    .eq("user_id", userId);

  return !error;
}
