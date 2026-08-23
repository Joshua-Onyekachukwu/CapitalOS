/**
 * Auth Helper — Gets the current user from Supabase auth.
 * Used by server actions and API routes to identify the logged-in user.
 * This is the ONLY Supabase dependency kept in the data layer.
 */
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Require authentication — throws if not logged in.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
