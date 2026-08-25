// =============================================
// Pitch Deck Generation API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { generatePitchDeck } from "@/lib/services/deck/generator";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { validateBodyAsync, generateDeckSchema } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const validated = await validateBodyAsync(request, generateDeckSchema);
    if (validated instanceof NextResponse) return validated;

    const { style, slideCount } = validated;
    const userId = user.id;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch company profile from Supabase
    const { data: profile, error: profileError } = await sp
      .from("company_profiles")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    // Fetch team members from Supabase (may not exist)
    let teamMembers: any[] = [];
    try {
      const { data } = await sp
        .from("company_team_members")
        .select("name, title, is_founder")
        .eq("company_id", profile.id);
      teamMembers = (data || []).map((m) => ({
        name: m.name,
        title: m.title || "Team Member",
        isFounder: m.is_founder,
      }));
    } catch {
      teamMembers = [];
    }

    // Generate the deck
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

    // Store files in Supabase Storage
    const pptxFileName = `${userId}/${Date.now()}-pitch-deck.pptx`;
    const { error: pptxError } = await sp.storage
      .from("company-documents")
      .upload(pptxFileName, result.pptxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });

    let pptxUrl = null;
    if (!pptxError) {
      const { data: urlData } = sp.storage
        .from("company-documents")
        .getPublicUrl(pptxFileName);
      pptxUrl = urlData.publicUrl;
    }

    const pdfFileName = `${userId}/${Date.now()}-pitch-deck.pdf`;
    const { error: pdfError } = await sp.storage
      .from("company-documents")
      .upload(pdfFileName, result.pdfBuffer, {
        contentType: "application/pdf",
      });

    let pdfUrl = null;
    if (!pdfError) {
      const { data: urlData } = sp.storage
        .from("company-documents")
        .getPublicUrl(pdfFileName);
      pdfUrl = urlData.publicUrl;
    }

    // Save document records (may not exist)
    const deckName = `${profile.company_name || "Company"} — ${result.style || "Investor"} Pitch Deck`;

    try {
      await sp.from("company_documents").insert([
        {
          company_id: profile.id,
          document_type: "pitch_deck",
          file_name: `${deckName}.pptx`,
          file_url: pptxUrl,
          file_size: result.pptxBuffer.length,
        },
        {
          company_id: profile.id,
          document_type: "pitch_deck",
          file_name: `${deckName}.pdf`,
          file_url: pdfUrl,
          file_size: result.pdfBuffer.length,
        },
      ]);
    } catch {
      // Table may not exist
    }

    // Update has_pitch_deck
    await sp
      .from("company_profiles")
      .update({ has_pitch_deck: true })
      .eq("user_id", userId);

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
