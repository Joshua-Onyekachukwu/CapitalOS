// =============================================
// Public data room access — GET /api/data-room/[token]
// =============================================
// No session: the token is the credential. That makes this the most exposed
// endpoint in the app, so it is deliberately paranoid:
//
//   • unknown / revoked / expired tokens return no document metadata at all;
//   • document rows are re-checked against the share owner, so a stale or
//     tampered document_ids array cannot leak someone else's file;
//   • the URLs returned are short-lived signed URLs, never stored paths;
//   • the access is recorded atomically (log row + counter) before links are
//     returned.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "company-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!token || token.length < 20 || token.length > 128) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sp = getAdmin();

  const { data: share, error } = await sp
    .from("data_room_shares")
    .select("id, user_id, label, document_ids, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[data-room] lookup failed:", error.message);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (share.revoked_at) {
    return NextResponse.json({ error: "This link has been revoked." }, { status: 410 });
  }
  if (new Date(share.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  const ids: string[] = share.document_ids ?? [];

  const { data: docs } = await sp
    .from("company_documents")
    .select("id, file_name, document_type, file_url, file_size, company_profiles!inner(user_id)")
    .in("id", ids);

  const owned = (docs ?? []).filter((d: any) => {
    const profile = Array.isArray(d.company_profiles) ? d.company_profiles[0] : d.company_profiles;
    return profile?.user_id === share.user_id && !!d.file_url;
  });

  const paths = owned
    .map((d: any) => d.file_url as string)
    .filter((p: string) => !/^https?:\/\//i.test(p));

  let signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await sp.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    signedByPath = new Map(
      (signed ?? [])
        .filter((s: any) => s.signedUrl)
        .map((s: any) => [s.path as string, s.signedUrl as string])
    );
  }

  const documents = owned.map((d: any) => ({
    id: d.id,
    name: d.file_name,
    type: d.document_type,
    size: d.file_size,
    url: /^https?:\/\//i.test(d.file_url) ? d.file_url : signedByPath.get(d.file_url) ?? null,
  }));

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;

  const { error: logError } = await sp.rpc("log_data_room_access", {
    p_share_id: share.id,
    p_ip: ip,
    p_user_agent: userAgent,
    p_document_count: documents.length,
  });
  if (logError) {
    // A failed log must not silently pass: the access happened, and the owner
    // is entitled to know the record is incomplete.
    console.error("[data-room] access log failed:", logError.message);
  }

  return NextResponse.json(
    {
      label: share.label,
      expiresAt: share.expires_at,
      documents,
      linkExpiresIn: SIGNED_URL_TTL_SECONDS,
      logged: !logError,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
