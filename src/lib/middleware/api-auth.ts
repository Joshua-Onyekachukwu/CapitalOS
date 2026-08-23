/**
 * API Auth Middleware
 * 
 * Provides authentication and authorization for API routes.
 * Every API route should use either `requireAuth()` or `optionalAuth()`.
 * 
 * Usage:
 *   import { requireAuth } from "@/lib/middleware/api-auth";
 *   
 *   export async function GET(request: NextRequest) {
 *     const user = await requireAuth(request);
 *     if (user instanceof NextResponse) return user; // 401 response
 *     // user is authenticated — use user.id
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Require authentication — returns 401 if not logged in.
 * Returns AuthUser if authenticated.
 */
export async function requireAuth(request?: NextRequest): Promise<AuthUser | NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    return {
      id: user.id,
      email: user.email || "",
    };
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}

/**
 * Optional authentication — returns null if not logged in (does NOT return 401).
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export async function optionalAuth(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) return null;
    
    return {
      id: user.id,
      email: user.email || "",
    };
  } catch {
    return null;
  }
}

/**
 * Require admin role — returns 403 if not admin.
 * Checks Supabase app_metadata.role or user_metadata.role for admin status.
 * Falls back to checking COCKROACH_ADMIN_EMAILS env var for allowlist.
 */
export async function requireAdmin(request?: NextRequest): Promise<AuthUser | NextResponse> {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  // Check 1: Supabase user metadata for admin role
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const isAdminMeta = user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
      if (isAdminMeta) return authUser;
    }
  } catch {
    // Fall through to env check
  }

  // Check 2: Email allowlist via COCKROACH_ADMIN_EMAILS env var
  const adminEmails = process.env.COCKROACH_ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];
  if (adminEmails.includes(authUser.email.toLowerCase())) {
    return authUser;
  }

  // Not admin
  return NextResponse.json(
    { error: "Forbidden — admin access required" },
    { status: 403 }
  );
}
