import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await sp
      .from("company_profiles")
      .select("email_brand_name, email_tagline, email_accent_color, email_logo_url, email_website, email_footer_text, email_cta_text, email_cta_url, email_signature, company_name")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      brandName: profile?.email_brand_name || profile?.company_name || "",
      tagline: profile?.email_tagline || "",
      accentColor: profile?.email_accent_color || "#84cc16",
      logoUrl: profile?.email_logo_url || "",
      website: profile?.email_website || "",
      footerText: profile?.email_footer_text || "",
      ctaText: profile?.email_cta_text || "",
      ctaUrl: profile?.email_cta_url || "",
      signature: profile?.email_signature || "",
    });
  } catch (err) {
    console.error("Branding GET error:", err);
    return NextResponse.json({ error: "Failed to load branding" }, { status: 500 });
  }
}
