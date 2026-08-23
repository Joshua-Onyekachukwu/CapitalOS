/**
 * Admin Setup Utilities
 *
 * Provides methods to configure admin access for Capital OS.
 *
 * Two methods for admin authentication:
 *   1. Email Allowlist (recommended for quick setup)
 *      - Set COCKROACH_ADMIN_EMAILS in .env.local
 *      - Any user with that email gets admin access
 *
 *   2. Supabase User Metadata (recommended for production)
 *      - Set app_metadata.role = "admin" on the Supabase user
 *      - More secure, doesn't expose emails in env vars
 *
 * Usage:
 *   import { isAdminEmail, setupAdminEmail } from "@/lib/admin-setup";
 *
 *   // Check if an email is admin
 *   if (isAdminEmail("user@example.com")) { ... }
 *
 *   // Get current admin emails
 *   const emails = getAdminEmails();
 */

// ── Email Allowlist ──

/**
 * Get the list of admin emails from environment variable.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.COCKROACH_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if an email is in the admin allowlist.
 */
export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * Add an email to the admin allowlist (runtime only).
 * For permanent changes, update .env.local.
 */
export function addAdminEmail(email: string): void {
  const current = process.env.COCKROACH_ADMIN_EMAILS || "";
  const emails = current
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  
  if (!emails.includes(email)) {
    emails.push(email);
    process.env.COCKROACH_ADMIN_EMAILS = emails.join(",");
  }
}

// ── Supabase Admin Role ──

/**
 * Set admin role on a Supabase user via the Management API.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set.
 *
 * @param userId - The Supabase user ID
 * @returns true if successful
 */
export async function setSupabaseAdminRole(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[admin] Missing Supabase URL or service role key");
    return false;
  }

  try {
    // Use Supabase Management API to update user metadata
    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          app_metadata: {
            role: "admin",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[admin] Failed to set admin role:", error);
      return false;
    }

    console.log(`[admin] Set admin role for user ${userId}`);
    return true;
  } catch (err) {
    console.error("[admin] Error setting admin role:", err);
    return false;
  }
}

/**
 * Remove admin role from a Supabase user.
 */
export async function removeSupabaseAdminRole(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[admin] Missing Supabase URL or service role key");
    return false;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          app_metadata: {
            role: null,
          },
        }),
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List all users with admin role.
 * Requires Supabase Management API access.
 */
export async function listAdminUsers(): Promise<Array<{ id: string; email: string }>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return [];
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!response.ok) return [];

    const { users } = await response.json();
    return users
      .filter((u: any) => u.app_metadata?.role === "admin")
      .map((u: any) => ({ id: u.id, email: u.email }));
  } catch {
    return [];
  }
}

// ── Admin Status Check ──

/**
 * Determine admin status using all available methods.
 * Returns the reason the user is admin, or null if not admin.
 */
export function getAdminReason(
  email: string,
  appMetadata?: Record<string, unknown>,
  userMetadata?: Record<string, unknown>
): string | null {
  // Check 1: Email allowlist
  if (isAdminEmail(email)) {
    return "email_allowlist";
  }

  // Check 2: Supabase app_metadata
  if (appMetadata?.role === "admin") {
    return "app_metadata_role";
  }

  // Check 3: Supabase user_metadata
  if (userMetadata?.role === "admin") {
    return "user_metadata_role";
  }

  return null;
}
