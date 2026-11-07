// =============================================
// Public data room access — GET /api/data-room/[token]
// =============================================
// No session: the token is the credential. That makes this the most exposed
// endpoint in the app, so it is deliberately paranoid:
//
//   • every attempt is rate limited by client address and by token hash before
//     the share is looked up, so guessing cannot become a free database probe;
//   • unknown / revoked / expired tokens return no document metadata at all,
//     and the denial is written to the owner-visible access log;
//   • document rows are re-checked against the share owner, so a stale or
//     tampered document_ids array cannot leak someone else's file;
//   • the URLs returned are short-lived signed URLs, never stored paths;
//   • the access is recorded atomically (log row + counter) before links are
//     returned, and only a granted open increments the counter.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DATA_ROOM_LIMITS,
  clientIp,
  consumeRateLimit,
  hashToken,
  type RpcClient,
} from "@/lib/data-room/rate-limit";

const BUCKET = "company-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type AuditOutcome =
  | "granted"
  | "not_found"
  | "revoked"
  | "expired"
  | "rate_limited"
  | "invalid_token"
  | "error";

type Admin = ReturnType<typeof getAdmin>;

async function auditDenial(
  sp: Admin,
  entry: {
    shareId?: string | null;
    tokenHash: string;
    ip: string | null;
    userAgent: string | null;
    outcome: AuditOutcome;
    documentCount?: number;
  }
) {
  const { error } = await sp.from("data_room_access_log").insert({
    share_id: entry.shareId ?? null,
    token_hash: entry.tokenHash,
    ip: entry.ip,
    user_agent: entry.userAgent,
    document_count: Math.max(0, entry.documentCount ?? 0),
    outcome: entry.outcome,
  });
  if (error) {
    // Losing an audit row must not change the response the caller sees, but it
    // must be loud: silence here means the owner's log is incomplete.
    console.error("[data-room] denial audit failed:", error.message);
  }
}

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.round(retryAfter))),
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const sp = getAdmin();
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;
  // Hash before the token reaches the database or a log line.
  const tokenHash = hashToken(token ?? "");

  // ── 1. Address budget ──
  const ipDecision = await consumeRateLimit(
    sp as unknown as RpcClient,
    "ip",
    ip ?? "unknown-ip",
    DATA_ROOM_LIMITS.ip
  );
  if (!ipDecision.allowed) {
    // Only the first blocked request of a window is logged: writing one row per
    // blocked request would let the limiter itself be used to fill the table.
    if (ipDecision.hits === DATA_ROOM_LIMITS.ip.limit + 1) {
      await auditDenial(sp, { tokenHash, ip, userAgent, outcome: "rate_limited" });
    }
    return tooManyRequests(ipDecision.retryAfter);
  }

  // ── 2. Shape check ──
  // The generator emits 43 base64url characters; anything far outside that is
  // rejected before it costs a share lookup.
  if (!token || token.length < 20 || token.length > 128) {
    await auditDenial(sp, { tokenHash, ip, userAgent, outcome: "invalid_token" });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── 3. Token budget ──
  const tokenDecision = await consumeRateLimit(
    sp as unknown as RpcClient,
    "token",
    tokenHash,
    DATA_ROOM_LIMITS.token
  );
  if (!tokenDecision.allowed) {
    if (tokenDecision.hits === DATA_ROOM_LIMITS.token.limit + 1) {
      await auditDenial(sp, { tokenHash, ip, userAgent, outcome: "rate_limited" });
    }
    return tooManyRequests(tokenDecision.retryAfter);
  }

  // ── 4. Lookup ──
  const { data: share, error } = await sp
    .from("data_room_shares")
    .select("id, user_id, label, document_ids, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[data-room] lookup failed:", error.message);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!share) {
    await auditDenial(sp, { tokenHash, ip, userAgent, outcome: "not_found" });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (share.revoked_at) {
    await auditDenial(sp, {
      shareId: share.id,
      tokenHash,
      ip,
      userAgent,
      outcome: "revoked",
    });
    return NextResponse.json({ error: "This link has been revoked." }, { status: 410 });
  }
  if (new Date(share.expires_at).getTime() <= Date.now()) {
    await auditDenial(sp, {
      shareId: share.id,
      tokenHash,
      ip,
      userAgent,
      outcome: "expired",
    });
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

  // ── 5. Record the granted open ──
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
