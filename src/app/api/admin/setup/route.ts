/**
 * Admin Setup API
 *
 * POST /api/admin/setup — Configure admin access for the first user
 *
 * This endpoint is ONLY available during initial setup.
 * Once an admin is configured, this endpoint is disabled.
 *
 * Body:
 *   { "email": "user@example.com" } — Add email to admin allowlist
 *   { "userId": "uuid", "action": "set_role" } — Set admin role in Supabase
 *   { "action": "status" } — Check current admin configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getAdminEmails, isAdminEmail, setSupabaseAdminRole, getAdminReason } from "@/lib/admin-setup";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const adminEmails = getAdminEmails();
    const isCurrentUserAdmin = isAdminEmail(user.email);

    return NextResponse.json({
      configured: adminEmails.length > 0,
      adminEmails: adminEmails.map((e) => e.replace(/(.{2}).*(@.*)/, "$1***$2")), // Mask emails
      currentUser: {
        email: user.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
        isAdmin: isCurrentUserAdmin,
        adminReason: getAdminReason(user.email),
      },
      setupComplete: adminEmails.length > 0,
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const body = await request.json();
    const { email, userId, action } = body;

    // Status check
    if (action === "status") {
      const adminEmails = getAdminEmails();
      return NextResponse.json({
        configured: adminEmails.length > 0,
        adminCount: adminEmails.length,
        currentUser: {
          email: user.email,
          isAdmin: isAdminEmail(user.email),
        },
      });
    }

    // Add email to allowlist
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      // Add to runtime allowlist
      const current = process.env.COCKROACH_ADMIN_EMAILS || "";
      const emails = current.split(",").map((e) => e.trim()).filter(Boolean);
      if (!emails.includes(email)) {
        emails.push(email);
        process.env.COCKROACH_ADMIN_EMAILS = emails.join(",");
      }

      return NextResponse.json({
        success: true,
        message: `Added ${email.replace(/(.{2}).*(@.*)/, "$1***$2")} to admin allowlist`,
        note: "For permanent access, add to COCKROACH_ADMIN_EMAILS in .env.local",
        currentAdmins: emails.length,
      });
    }

    // Set Supabase admin role
    if (userId && action === "set_role") {
      const success = await setSupabaseAdminRole(userId);
      if (success) {
        return NextResponse.json({
          success: true,
          message: `Set admin role for user ${userId}`,
        });
      }
      return NextResponse.json(
        { error: "Failed to set admin role. Check Supabase configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Provide email or userId with action=set_role" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
