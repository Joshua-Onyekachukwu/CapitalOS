import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { securityMiddleware, applySecurityHeaders, getCorsHeadersForResponse } from "@/lib/middleware/security";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Security middleware (CORS, CSRF) — handles preflight and blocks
  const securityResponse = securityMiddleware(request);
  if (securityResponse) return securityResponse;

  // 2. Auth session — full updateSession for protected pages (dashboard, settings, etc.)
  //    For public pages (landing, login, signup), just pass through without calling getUser()
  //    This prevents the Supabase auth network call from timing out on mobile connections.
  const protectedPaths = ["/dashboard", "/admin", "/startup", "/investors", "/campaigns", "/outreach", "/analytics", "/settings"];
  const authPages = ["/login", "/signup", "/forgot-password", "/reset-password"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPages.some((p) => pathname.startsWith(p));

  let response: NextResponse;
  if (isProtected || isAuthPage) {
    // Protected or auth pages need full session check + redirect logic
    response = await updateSession(request);
  } else {
    // Public pages (landing, pricing, etc.) — just pass through, no auth call
    response = NextResponse.next();
  }

  // 3. Apply security headers to all responses
  applySecurityHeaders(response);

  // 4. Apply CORS headers to API responses
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const corsHeaders = getCorsHeadersForResponse(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|public).*)",
  ],
};
