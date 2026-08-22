// =============================================
// Document Content Analysis
// =============================================
// Extracts text and key information from uploaded documents.
// Server-side only.

/**
 * Extract text content from a document buffer.
 * Currently supports plain text extraction from PDF metadata.
 * Full PDF parsing would require pdf-lib or similar.
 */
export async function extractDocumentContent(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ text: string; pageCount?: number; metadata?: Record<string, string> }> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "txt" || ext === "md") {
    return { text: fileBuffer.toString("utf-8") };
  }

  if (ext === "pdf") {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const pageCount = pdfDoc.getPageCount();
      const metadata = pdfDoc.getTitle() ? { title: pdfDoc.getTitle() || "" } : undefined;
      return {
        text: `[PDF document — ${pageCount} page${pageCount !== 1 ? "s" : ""}. Full text extraction requires additional processing.]`,
        pageCount,
        metadata,
      };
    } catch {
      return { text: "[PDF document — could not extract content]" };
    }
  }

  if (ext === "pptx" || ext === "ppt") {
    return { text: "[PowerPoint document — content analysis requires additional processing.]" };
  }

  if (ext === "docx" || ext === "doc") {
    return { text: "[Word document — content analysis requires additional processing.]" };
  }

  return { text: `[Unknown file type: .${ext}]` };
}

/**
 * Analyze document content using AI to extract key business information.
 */
export async function analyzeDocumentForBusinessInfo(
  text: string,
  documentType: string
): Promise<{
  summary: string;
  keyMetrics: string[];
  fundingInfo: string | null;
  teamInfo: string[];
}> {
  if (!text || text.startsWith("[")) {
    return { summary: "Document content could not be extracted for analysis.", keyMetrics: [], fundingInfo: null, teamInfo: [] };
  }

  try {
    const { chatCompletion } = await import("@/lib/ai");
    const response = await chatCompletion({
      task: "research_summary",
      messages: [{
        role: "user",
        content: `Analyze this ${documentType} document and extract key business information.

DOCUMENT CONTENT:
${text.slice(0, 4000)}

Return JSON:
{
  "summary": "2-3 sentence summary of the document",
  "keyMetrics": ["metric 1", "metric 2", "metric 3"],
  "fundingInfo": "any funding/investment information found, or null",
  "teamInfo": ["person 1 — title", "person 2 — title"]
}

Return ONLY the JSON, no markdown.`,
      }],
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    // AI analysis failed
  }

  return { summary: "Document analysis not available.", keyMetrics: [], fundingInfo: null, teamInfo: [] };
}
