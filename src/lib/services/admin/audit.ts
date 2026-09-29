/**
 * Admin action audit trail.
 *
 * Records who/what/when/before-after for destructive or significant admin
 * operations (imports, merges, bulk ops, exports). Writes to `audit_log`,
 * which the /admin/audit-logs viewer reads — a single audit stream, not two
 * parallel tables. Best-effort: a failed audit write must never block the
 * operation itself.
 */

import { createClient } from "@supabase/supabase-js";

export function logAdminAction(entry: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}): void {
  void (async () => {
    try {
      const sp = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      // Resolve the actor email for the audit viewer's actor filter
      // (denormalized; user_id → email via auth admin).
      let actorEmail: string | null = null;
      try {
        const { data } = await sp.auth.admin.getUserById(entry.userId);
        actorEmail = data?.user?.email ?? null;
      } catch {
        // non-critical
      }
      await sp.from("audit_log").insert({
        user_id: entry.userId,
        user_email: actorEmail,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        details: entry.details || {},
        ip_address: entry.ip || null,
      });
    } catch {
      // Non-critical.
    }
  })();
}
