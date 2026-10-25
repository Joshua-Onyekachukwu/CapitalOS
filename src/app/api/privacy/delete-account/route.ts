// =============================================
// Privacy — Delete my account (right to erasure)
// =============================================
// POST /api/privacy/delete-account   body: { confirm: "DELETE MY ACCOUNT" }
//
// Erases every erasable row owned by the requesting founder (children-first,
// see services/privacy/user-data.ts), then deletes the auth user. Pseudonymous
// financial/audit records are retained for billing integrity (documented in
// the privacy service and surfaced in the response). The session becomes
// invalid immediately after this call.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import {
  deleteUserData,
  DELETE_CONFIRMATION,
} from "@/lib/services/privacy/user-data";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  let body: { confirm?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* missing body handled below */
  }

  if (body.confirm !== DELETE_CONFIRMATION) {
    return NextResponse.json(
      { error: 'Confirmation required: send { confirm: "DELETE MY ACCOUNT" }' },
      { status: 400 }
    );
  }

  const sp = getSp();

  try {
    const { deleted, errors } = await deleteUserData(sp, user.id);

    // Delete the auth user last — profiles and any cascade-owned rows go with
    // it. If a non-cascading FK still references the user this fails and we
    // report which table blocked it instead of half-deleting silently.
    let authDeleted: string | true;
    try {
      const { error } = await sp.auth.admin.deleteUser(user.id);
      authDeleted = error ? `failed: ${error.message}` : true;
    } catch (err) {
      authDeleted = `failed: ${(err as Error)?.message || "unknown error"}`;
    }

    const ok = authDeleted === true;
    if (ok) {
      console.log(`[privacy/delete-account] user ${user.id} erased (${Object.values(deleted).reduce((a, b) => a + b, 0)} rows)`);
    } else {
      console.error(`[privacy/delete-account] user ${user.id} partial deletion:`, { errors, authDeleted });
    }

    return NextResponse.json(
      {
        success: ok,
        rowsDeleted: Object.values(deleted).reduce((a, b) => a + b, 0),
        deleted,
        errors,
        authDeleted,
        retainedPolicy:
          "Financial/audit records (subscriptions, billing events, credit ledger, founding-member, admin audit) are retained for billing integrity.",
      },
      { status: ok ? 200 : 207 }
    );
  } catch (err) {
    console.error("[privacy/delete-account] failed:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
