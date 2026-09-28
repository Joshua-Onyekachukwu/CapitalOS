// =============================================
// Admin User Role Management
// =============================================
// POST /api/admin/users/role — promote or demote a user's admin role.
// Guardrails:
//   - requireAdmin (caller) + explicit confirmToken === target userId
//   - self-demotion refused (prevents lockout)
//   - demotion refused when the target is the LAST role-based admin
//   - email-allowlist admins cannot be managed here (their status comes
//     from the COCKROACH_ADMIN_EMAILS env var, not app_metadata)
//   - every attempt (success or refusal) is written to audit_log

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";
import { setSupabaseAdminRole, removeSupabaseAdminRole, isAdminEmail } from "@/lib/admin-setup";
import { logAdminAction } from "@/lib/services/admin/audit";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
  }

  try {
    const body = await request.json();
    const userId: string | undefined = body?.userId;
    const action: string | undefined = body?.action; // "promote" | "demote"
    const confirmToken: string | undefined = body?.confirmToken;

    if (!userId || !["promote", "demote"].includes(action || "")) {
      return NextResponse.json(
        { error: "userId and action (promote|demote) are required" },
        { status: 400 }
      );
    }
    // The UI must echo the target id back — proves a deliberate action.
    if (confirmToken !== userId) {
      return NextResponse.json(
        { error: "confirmToken must equal userId" },
        { status: 400 }
      );
    }

    const sp = getSupabase();

    // ── Resolve the target ──
    const { data: targetData } = await sp.auth.admin.getUserById(userId);
    const target = targetData?.user;
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const targetEmail = target.email || "";
    const targetIsRoleAdmin = target.app_metadata?.role === "admin";
    const targetIsAllowlistAdmin = isAdminEmail(targetEmail);

    // ── Guardrails ──
    const audit = (auditAction: string, details: Record<string, unknown>) => {
      logAdminAction({
        userId: user.id,
        action: auditAction,
        entityType: "user",
        entityId: userId,
        details: { targetEmail, ...details },
        ip: request.headers.get("x-forwarded-for"),
      });
    };

    if (targetIsAllowlistAdmin) {
      audit("role_change_refused", { reason: "allowlist_admin", requested: action });
      return NextResponse.json(
        { error: "This user is an admin via the COCKROACH_ADMIN_EMAILS allowlist — manage it in the environment, not here." },
        { status: 409 }
      );
    }

    if (action === "demote") {
      if (!targetIsRoleAdmin) {
        return NextResponse.json({ error: "User is not a role-based admin" }, { status: 409 });
      }
      if (userId === user.id) {
        audit("role_change_refused", { reason: "self_demotion", requested: "demote" });
        return NextResponse.json(
          { error: "You cannot demote yourself — ask another admin." },
          { status: 409 }
        );
      }
      // Last-admin protection: count role-based admins.
      const { data: all } = await sp.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const roleAdmins = (all?.users || []).filter(
        (u) => u.app_metadata?.role === "admin" && !isAdminEmail(u.email || "")
      );
      if (roleAdmins.length <= 1) {
        audit("role_change_refused", { reason: "last_admin", requested: "demote" });
        return NextResponse.json(
          { error: "Cannot demote the last role-based admin." },
          { status: 409 }
        );
      }
    }

    if (action === "promote" && targetIsRoleAdmin) {
      return NextResponse.json({ error: "User is already an admin" }, { status: 409 });
    }

    // ── Perform the change ──
    const ok =
      action === "promote"
        ? await setSupabaseAdminRole(userId)
        : await removeSupabaseAdminRole(userId);

    if (!ok) {
      return NextResponse.json({ error: "Role change failed" }, { status: 500 });
    }

    audit(`role_${action}d`, {
      from: action === "promote" ? "user" : "admin",
      to: action === "promote" ? "admin" : "user",
    });

    return NextResponse.json({
      ok: true,
      userId,
      role: action === "promote" ? "admin" : "user",
    });
  } catch (err) {
    console.error("[api/admin/users/role] failed:", err);
    return NextResponse.json({ error: "Role change failed" }, { status: 500 });
  }
}
