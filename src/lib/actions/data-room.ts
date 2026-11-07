"use server";

// Data room server actions.
//
// A share is a bearer link: possession of the token is the authorisation. That
// makes three things non-negotiable and they are enforced here, not in the UI:
//   • the token is 32 random bytes (base64url), never derived from anything
//     guessable and never reused;
//   • expiry is stored, not computed from "created_at + n" at read time, so
//     changing the code cannot extend an existing link;
//   • only documents the caller owns can be added to a share.

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
const MAX_DOCUMENTS_PER_SHARE = 25;
const MAX_EXPIRY_DAYS = 90;
const MIN_EXPIRY_DAYS = 1;

export interface DataRoomShare {
  id: string;
  token: string;
  url: string;
  label: string | null;
  documentIds: string[];
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  status: "active" | "expired" | "revoked";
}

export type ShareResult<T> = { ok: true; value: T } | { ok: false; error: string };

function statusOf(row: {
  revoked_at: string | null;
  expires_at: string;
}): DataRoomShare["status"] {
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

export async function createDataRoomShare(params: {
  documentIds: string[];
  expiresInDays: number;
  label?: string | null;
}): Promise<ShareResult<DataRoomShare>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const ids = [...new Set((params.documentIds || []).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: "Select at least one document to share." };
  }
  if (ids.length > MAX_DOCUMENTS_PER_SHARE) {
    return {
      ok: false,
      error: `A share can contain at most ${MAX_DOCUMENTS_PER_SHARE} documents.`,
    };
  }

  const days = Math.round(Number(params.expiresInDays));
  if (!Number.isFinite(days) || days < MIN_EXPIRY_DAYS || days > MAX_EXPIRY_DAYS) {
    return {
      ok: false,
      error: `Expiry must be between ${MIN_EXPIRY_DAYS} and ${MAX_EXPIRY_DAYS} days.`,
    };
  }

  // Ownership check through the user-scoped client: RLS means a document the
  // caller does not own simply is not returned, so it cannot enter the share.
  const { data: owned, error: ownedError } = await supabase
    .from("company_documents")
    .select("id")
    .in("id", ids);

  if (ownedError) return { ok: false, error: ownedError.message };
  const ownedIds = new Set((owned ?? []).map((r) => r.id as string));
  const rejected = ids.filter((id) => !ownedIds.has(id));
  if (rejected.length > 0) {
    return { ok: false, error: "One or more documents could not be found on your account." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const { data: row, error } = await supabase
    .from("data_room_shares")
    .insert({
      user_id: user.id,
      token,
      label: (params.label || "").trim().slice(0, 120) || null,
      document_ids: ids,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !row) {
    return { ok: false, error: error?.message || "Could not create the share." };
  }

  return {
    ok: true,
    value: {
      id: row.id,
      token: row.token,
      url: `${APP_URL}/share/${row.token}`,
      label: row.label,
      documentIds: row.document_ids ?? ids,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      accessCount: row.access_count ?? 0,
      lastAccessedAt: row.last_accessed_at,
      createdAt: row.created_at,
      status: statusOf(row),
    },
  };
}

export async function listDataRoomShares(): Promise<ShareResult<DataRoomShare[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { data, error } = await supabase
    .from("data_room_shares")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    value: (data ?? []).map((row) => ({
      id: row.id,
      token: row.token,
      url: `${APP_URL}/share/${row.token}`,
      label: row.label,
      documentIds: row.document_ids ?? [],
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      accessCount: row.access_count ?? 0,
      lastAccessedAt: row.last_accessed_at,
      createdAt: row.created_at,
      status: statusOf(row),
    })),
  };
}

export async function revokeDataRoomShare(id: string): Promise<ShareResult<true>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase
    .from("data_room_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, value: true };
}

export interface AccessLogEntry {
  id: string;
  accessedAt: string;
  ip: string | null;
  userAgent: string | null;
  documentCount: number;
  /** granted, or why the attempt was refused. */
  outcome: string;
}

export async function getDataRoomAccessLog(
  shareId: string
): Promise<ShareResult<AccessLogEntry[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  // RLS on the log is scoped through the share's owner, so this cannot read
  // another founder's access history even if the id is guessed.
  const { data, error } = await supabase
    .from("data_room_access_log")
    .select("id, accessed_at, ip, user_agent, document_count, outcome")
    .eq("share_id", shareId)
    .order("accessed_at", { ascending: false })
    .limit(50);

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    value: (data ?? []).map((r) => ({
      id: r.id,
      accessedAt: r.accessed_at,
      ip: r.ip,
      userAgent: r.user_agent,
      documentCount: r.document_count ?? 0,
      outcome: r.outcome ?? "granted",
    })),
  };
}
