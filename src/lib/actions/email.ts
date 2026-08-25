// =============================================
// Email Account — Disconnect Action (Supabase)
// =============================================

"use server";

import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function disconnectEmail(userId: string, provider: string) {
  try {
    const sp = getSp();
    await sp
      .from("email_accounts")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("provider", provider);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getConnectedEmails(userId: string) {
  try {
    const sp = getSp();
    const { data } = await sp
      .from("email_accounts")
      .select("id, provider, email_address, display_name, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}
