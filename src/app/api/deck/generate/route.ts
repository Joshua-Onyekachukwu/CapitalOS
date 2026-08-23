// =============================================
// Pitch Deck Generation API Route
// =============================================
// Generates a company-specific investor pitch deck.
// Server-side only — AI client never exposed to browser bundle.
// Uses CockroachDB for data, Supabase Storage for file uploads.

import { NextRequest, NextResponse } from "next/server";
import { generatePitchDeck } from "@/lib/services/deck/generator";
import { query } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { validateBodyAsync, generateDeckSchema } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    // Validate input
    const validated = await validateBodyAsync(request, generateDeckSchema);
    if (validated instanceof NextResponse) return validated;

    const { style, slideCount } = validated;

    // SECURITY: Use authenticated user ID — never trust client-supplied userId
    const userId = user.id;

    // Fetch company profile from CockroachDB
    const profiles = await query<any>(
      "SELECT * FROM company_profiles WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (!profiles.length) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const profile = profiles[0];

    // Fetch team members from CockroachDB
    const teamData = await query<any>(
      "SELECT name, title, is_founder FROM company_team_members WHERE company_id = $1",
      [profile.id]
    );

    const teamMembers = (teamData || []).map((m: any) => ({
      name: m.name,
      title: m.title || "Team Member",
      isFounder: m.is_founder,
    }));

    // Generate the deck with style and slide count
    const result = await generatePitchDeck({
      companyName: profile.company_name || "Our Company",
      oneLiner: profile.one_liner || "",
      description: profile.description || "",
      differentiator: profile.differentiator || "",
      targetCustomer: profile.target_customer || "",
      industry: profile.industry || "",
      companyStage: profile.company_stage || "",
      currentlyRaising: profile.currently_raising,
      roundType: profile.round_type || "",
      fundingAmount: profile.funding_amount,
      mrr: profile.mrr,
      arr: profile.arr,
      customerCount: profile.customer_count,
      growthRate: profile.growth_rate || "",
      milestones: profile.milestones || [],
      teamMembers,
      style: style || "investor",
      slideCount: slideCount || 10,
    });

    // Store files in Supabase Storage (keeps file upload working)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const pptxFileName = `${userId}/${Date.now()}-pitch-deck.pptx`;
    const { error: pptxError } = await supabase.storage
      .from("company-documents")
      .upload(pptxFileName, result.pptxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });

    let pptxUrl = null;
    if (!pptxError) {
      const { data: urlData } = supabase.storage
        .from("company-documents")
        .getPublicUrl(pptxFileName);
      pptxUrl = urlData.publicUrl;
    }

    const pdfFileName = `${userId}/${Date.now()}-pitch-deck.pdf`;
    const { error: pdfError } = await supabase.storage
      .from("company-documents")
      .upload(pdfFileName, result.pdfBuffer, {
        contentType: "application/pdf",
      });

    let pdfUrl = null;
    if (!pdfError) {
      const { data: urlData } = supabase.storage
        .from("company-documents")
        .getPublicUrl(pdfFileName);
      pdfUrl = urlData.publicUrl;
    }

    // Save document records in CockroachDB
    const deckName = `${profile.company_name || "Company"} — ${result.style || "Investor"} Pitch Deck`;

    await query(
      `INSERT INTO company_documents (company_id, document_type, file_name, file_url, file_size)
       VALUES ($1, 'pitch_deck', $2, $3, $4)`,
      [profile.id, `${deckName}.pptx`, pptxUrl, result.pptxBuffer.length]
    );

    await query(
      `INSERT INTO company_documents (company_id, document_type, file_name, file_url, file_size)
       VALUES ($1, 'pitch_deck', $2, $3, $4)`,
      [profile.id, `${deckName}.pdf`, pdfUrl, result.pdfBuffer.length]
    );

    // Update has_pitch_deck
    await query(
      `UPDATE company_profiles SET has_pitch_deck = true WHERE user_id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      slides: result.slides,
      designDirection: result.designDirection,
      style: result.style,
      pptxUrl,
      pdfUrl,
      pptxFileName: `${deckName}.pptx`,
      pdfFileName: `${deckName}.pdf`,
      slideCount: result.slides.length,
    });
  } catch (err) {
    console.error("Deck generation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
