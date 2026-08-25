/**
 * Role-Based Access Control
 *
 * Checks if a user is admin using:
 * 1. COCKROACH_ADMIN_EMAILS env var (email allowlist)
 * 2. Supabase app_metadata.role = "admin"
 *
 * Used by server components and layouts to control navigation.
 */
import { createClient } from "@supabase/supabase-js";

export interface RoleInfo {
  isAdmin: boolean;
  role: "admin" | "user";
}

/**
 * Check if a user is admin. Server-side only.
 */
export async function getUserRole(userId: string, email: string): Promise<RoleInfo> {
  // Check 1: Email allowlist
  const adminEmails = (process.env.COCKROACH_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.includes(email.toLowerCase())) {
    return { isAdmin: true, role: "admin" };
  }

  // Check 2: Supabase app_metadata
  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sp.auth.admin.getUserById(userId);
    if (data?.user?.app_metadata?.role === "admin") {
      return { isAdmin: true, role: "admin" };
    }
  } catch {
    // Non-critical
  }

  return { isAdmin: false, role: "user" };
}
