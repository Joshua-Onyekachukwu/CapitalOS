import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { securityMiddleware, applySecurityHeaders, getCorsHeadersForResponse } from "@/lib/middleware/security";

export async function middleware(request: NextRequest) {
  // 1. Security middleware (CORS, CSRF) — handles preflight and blocks
  const securityResponse = securityMiddleware(request);
  if (securityResponse) return securityResponse;

  // 2. Auth session management
  const response = await updateSession(request);

  // 3. Apply security headers to all responses
  applySecurityHeaders(response);

  // 4. Apply CORS headers to API responses
  if (request.nextUrl.pathname.startsWith("/api/")) {
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
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|public).*)",
  ],
};
