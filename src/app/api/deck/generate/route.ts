// =============================================
// Pitch Deck Generation API Route
// =============================================
// Generates a company-specific investor pitch deck.
// Server-side only — AI client never exposed to browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { generatePitchDeck } from "@/lib/services/deck/generator";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, style, slideCount } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Fetch company profile
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    // Fetch team members
    const { data: teamData } = await supabase
      .from("company_team_members")
      .select("name, title, is_founder")
      .eq("company_id", profile.id);

    const teamMembers = (teamData || []).map((m) => ({
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

    // Store PPTX in Supabase Storage
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

    // Store PDF
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

    // Save document records
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    const deckName = `${profile.company_name || "Company"} — ${result.style || "Investor"} Pitch Deck`;

    if (companyProfile) {
      // Save PPTX record
      await supabase.from("company_documents").insert({
        company_id: companyProfile.id,
        document_type: "pitch_deck",
        file_name: `${deckName}.pptx`,
        file_url: pptxUrl,
        file_size: result.pptxBuffer.length,
      });

      // Save PDF record
      await supabase.from("company_documents").insert({
        company_id: companyProfile.id,
        document_type: "pitch_deck",
        file_name: `${deckName}.pdf`,
        file_url: pdfUrl,
        file_size: result.pdfBuffer.length,
      });

      // Update has_pitch_deck
      await supabase
        .from("company_profiles")
        .update({ has_pitch_deck: true })
        .eq("user_id", userId);
    }

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
      { error: err instanceof Error ? err.message : "Deck generation failed" },
      { status: 500 }
    );
  }
}
