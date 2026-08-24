import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Save custom SMTP settings for a user
 * POST /api/email/smtp/save
 * Body: { provider, host, port, user, pass, secure, fromName, fromEmail, domain }
 */
export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const body = await request.json();
    const {
      provider,
      host,
      port,
      user: smtpUser,
      pass,
      secure,
      fromName,
      fromEmail,
      domain,
    } = body;

    if (!host || !smtpUser || !pass || !fromEmail) {
      return NextResponse.json(
        { error: "Host, username, password, and sender email are required" },
        { status: 400 }
      );
    }

    // Use service role for DB writes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Deactivate any existing accounts for this provider
    await supabase
      .from("email_accounts")
      .update({ is_active: false })
      .eq("user_id", authUser.id)
      .eq("provider", provider || "custom_smtp");

    // Insert new custom SMTP account
    const { data, error } = await supabase
      .from("email_accounts")
      .insert({
        user_id: authUser.id,
        provider: provider || "custom_smtp",
        email_address: fromEmail,
        display_name: fromName || fromEmail.split("@")[0],
        is_active: true,
        smtp_host: host,
        smtp_port: parseInt(String(port || "587")),
        smtp_user: smtpUser,
        smtp_pass_encrypted: pass, // TODO: encrypt at rest
        smtp_secure: secure === true || secure === "true",
        custom_domain: domain || fromEmail.split("@")[1],
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save SMTP settings:", error);
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: {
        id: data.id,
        provider: data.provider,
        email_address: data.email_address,
        display_name: data.display_name,
      },
    });
  } catch (err) {
    console.error("SMTP save error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete custom SMTP settings
 * DELETE /api/email/smtp/save?id=account-id
 */
export async function DELETE(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Account ID required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", authUser.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
