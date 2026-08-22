// =============================================
// Email Account — Disconnect Action
// =============================================
// Disconnects a user's email account (Google or Microsoft).

"use server";

import { createClient } from "@supabase/supabase-js";

export async function disconnectEmail(userId: string, provider: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("email_accounts")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getConnectedEmails(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, provider, email_address, display_name, is_active, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data };
}
