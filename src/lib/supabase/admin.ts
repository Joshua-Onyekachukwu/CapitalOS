/**
 * Server-only Supabase admin client (service role).
 *
 * SECURITY: bypasses RLS. Never import this from a Client Component, and never
 * let a request-supplied value decide what it reads or writes. Every call site
 * must establish the caller's identity and ownership *first*, then act on
 * exactly that user's rows/prefix.
 *
 * Used for two things the cookie-scoped client cannot do:
 *   1. Storage writes. The `company-documents` bucket has no authenticated
 *      INSERT policy by design — uploads go through the server so the object
 *      path is forced to the caller's own `{user_id}/` prefix. Giving end
 *      clients an INSERT policy keyed on a path prefix is weaker, because the
 *      prefix is client-asserted.
 *   2. Minting short-lived signed URLs after an ownership check on the
 *      `company_documents` row.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    _admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

export const COMPANY_DOCUMENTS_BUCKET = "company-documents";

/**
 * Signed-URL lifetime. Long enough to open a document, short enough that a
 * leaked link stops working quickly. Confidential fundraising materials are
 * never served from a permanent public URL.
 */
export const SIGNED_URL_TTL_SECONDS = 60;
