// =============================================
// Email Account — Disconnect Action
// =============================================
// Disconnects a user's email account (Google or Microsoft).
// Uses CockroachDB for data.

"use server";

import { query } from "@/lib/db";

export async function disconnectEmail(userId: string, provider: string) {
  try {
    await query(
      `UPDATE email_accounts SET is_active = false WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getConnectedEmails(userId: string) {
  try {
    const data = await query<any>(
      `SELECT id, provider, email_address, display_name, is_active, created_at
       FROM email_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}
