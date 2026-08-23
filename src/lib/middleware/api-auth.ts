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
 * NOTE: Implement proper role checking when user roles are added to the schema.
 * For now, this is a placeholder that checks auth only.
 */
export async function requireAdmin(): Promise<AuthUser | NextResponse> {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;
  
  // TODO: Check user role from database when admin roles are implemented
  // For now, all authenticated users are treated as regular users
  // Admin routes should be gated by a proper role check
  
  return user;
}
