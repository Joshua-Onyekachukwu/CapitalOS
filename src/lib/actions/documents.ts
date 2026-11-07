// Document Upload Actions
// Serves /dashboard/documents and the onboarding / startup document surfaces.
//
// Storage model
//   Bucket: `company-documents` (private, no public URLs).
//   Object path: `{user_id}/docs/{timestamp}{ext}`.
//   The path is forced server-side from the authenticated session, so one user
//   can never write into another user's prefix.
//
// Why the service role writes the object
//   The bucket has no authenticated INSERT policy on purpose. Uploads are
//   authorised here, by a verified session, and the key is derived from that
//   session rather than from client-supplied input. Reads are served as
//   short-lived signed URLs minted only after an ownership check on the
//   `company_documents` row.
//
// Where the object path lives
//   `company_documents.file_url` stores the object path (not a URL) for files
//   uploaded by this module. Any legacy value beginning with `http` is treated
//   as an already-absolute URL and passed through unchanged. Row values that
//   are NULL mean the file never reached storage — those rows render as
//   "file missing" and can be re-uploaded or deleted.

import { createClient } from "@/lib/supabase/server";
import {
  getAdminClient,
  COMPANY_DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/supabase/admin";

/**
 * Supported document types and their accepted MIME sets.
 * Enforced server-side (see ALLOWED_MIME below) and mirrored by the bucket's
 * allowed_mime_types, so a bad type is rejected before it reaches storage.
 */
export const DOCUMENT_MIME_TYPES: Record<string, string[]> = {
  pitch_deck: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/pdf",
  ],
  business_plan: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  financial_model: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  one_pager: ["application/pdf"],
  other: ["application/pdf", "application/msword", "image/png", "image/jpeg"],
};

/** Hard ceiling, matches the bucket's file_size_limit (25 MiB). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set(
  Object.values(DOCUMENT_MIME_TYPES).flat()
);

export interface UploadedDocument {
  id: string;
  documentType: string;
  fileName: string;
  /** Object path within the bucket, or NULL when the file never landed. */
  storagePath: string | null;
  fileSize: number | null;
  createdAt: string;
}

/**
 * Result of an upload attempt. Failures carry the real reason so the UI can
 * show it instead of a generic "upload failed".
 */
export type UploadResult =
  | { ok: true; document: UploadedDocument }
  | { ok: false; error: string };

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Upload a document for the current user's company profile.
 */
export async function uploadCompanyDocument(params: {
  file: File;
  documentType: string;
  fileName: string;
}): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { file, documentType, fileName } = params;

  // ── Validate before touching storage ──
  if (!file || file.size === 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `"${file.type}" is not an accepted type. Upload a PDF, PPTX, DOCX, DOC or XLSX file.`,
    };
  }

  const allowedTypes = Object.keys(DOCUMENT_MIME_TYPES);
  const normalizedType = allowedTypes.includes(documentType) ? documentType : "other";

  // Path is derived from the verified session — never from client input.
  const ext = (fileName.match(/\.[A-Za-z0-9]+$/)?.[0] || "").toLowerCase();
  const storagePath = `${user.id}/docs/${Date.now()}${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("[documents] storage upload failed:", uploadError.message);
    return { ok: false, error: `Storage rejected the upload: ${uploadError.message}` };
  }

  // ── Resolve (or create) the caller's company profile row ──
  // Runs on the user-scoped client so company_profiles RLS applies.
  let companyId: string | null = null;
  const { data: existingProfile } = await supabase
    .from("company_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  companyId = existingProfile?.id ?? null;

  if (!companyId) {
    const { data: created, error: createError } = await supabase
      .from("company_profiles")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (createError || !created) {
      // Roll the object back so a failed row never leaves an orphan in storage.
      await admin.storage.from(COMPANY_DOCUMENTS_BUCKET).remove([storagePath]);
      return {
        ok: false,
        error: `Could not create your company profile: ${createError?.message ?? "unknown error"}`,
      };
    }
    companyId = created.id;
  }

  const { data: record, error: insertError } = await supabase
    .from("company_documents")
    .insert({
      company_id: companyId,
      document_type: normalizedType,
      file_name: fileName,
      file_url: storagePath,
      file_size: file.size,
    })
    .select()
    .single();

  if (insertError || !record) {
    await admin.storage.from(COMPANY_DOCUMENTS_BUCKET).remove([storagePath]);
    console.error("[documents] row insert failed:", insertError?.message);
    return {
      ok: false,
      error: `Could not record the document: ${insertError?.message ?? "unknown error"}`,
    };
  }

  if (normalizedType === "pitch_deck") {
    await supabase
      .from("company_profiles")
      .update({ has_pitch_deck: true })
      .eq("user_id", user.id);
  }

  return {
    ok: true,
    document: {
      id: record.id,
      documentType: record.document_type,
      fileName: record.file_name,
      storagePath: record.file_url && !isAbsoluteUrl(record.file_url) ? record.file_url : null,
      fileSize: record.file_size,
      createdAt: record.created_at,
    },
  };
}

/**
 * Mint a short-lived signed URL for one document the caller owns.
 *
 * Ownership is established by reading the row through the user-scoped client
 * (so `company_documents` RLS decides visibility), not by trusting a path from
 * the request.
 */
export async function getDocumentDownloadUrl(
  documentId: string
): Promise<{ ok: true; url: string; expiresIn: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { data: row, error } = await supabase
    .from("company_documents")
    .select("id, file_url")
    .eq("id", documentId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Document not found." };
  if (!row.file_url) {
    return {
      ok: false,
      error: "This document has no stored file. Re-upload it from the upload panel.",
    };
  }

  // Legacy absolute URLs are returned as-is.
  if (isAbsoluteUrl(row.file_url)) {
    return { ok: true, url: row.file_url, expiresIn: 0 };
  }

  const admin = getAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .createSignedUrl(row.file_url, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    return { ok: false, error: signError?.message ?? "Could not create a download link." };
  }

  return { ok: true, url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
}

/**
 * Delete a document: database row first (so a failure is visible), then the
 * stored object.
 */
export async function deleteCompanyDocument(
  documentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { data: row, error: readError } = await supabase
    .from("company_documents")
    .select("id, file_url, document_type, company_id")
    .eq("id", documentId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Document not found." };

  const { error: deleteError } = await supabase
    .from("company_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) return { ok: false, error: deleteError.message };

  if (row.file_url && !isAbsoluteUrl(row.file_url)) {
    const admin = getAdminClient();
    const { error: storageError } = await admin.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .remove([row.file_url]);
    if (storageError) {
      // The row is gone, which is what the user asked for. Report the leftover
      // object rather than pretending it was cleaned up.
      console.error("[documents] orphaned object left behind:", row.file_url, storageError.message);
    }
  }

  // If that was the last pitch deck, clear the flag.
  if (row.document_type === "pitch_deck") {
    const { count } = await supabase
      .from("company_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", row.company_id)
      .eq("document_type", "pitch_deck");
    if ((count ?? 0) === 0) {
      await supabase
        .from("company_profiles")
        .update({ has_pitch_deck: false })
        .eq("user_id", user.id);
    }
  }

  return { ok: true };
}

/**
 * Storage health for the upload panel: does the bucket accept writes at all?
 * Returns the bucket's real state rather than assuming it exists.
 */
export async function getDocumentStorageHealth(): Promise<{
  configured: boolean;
  message: string;
}> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.storage.getBucket(COMPANY_DOCUMENTS_BUCKET);
    if (error || !data) {
      return {
        configured: false,
        message: `Storage bucket "${COMPANY_DOCUMENTS_BUCKET}" is not available: ${error?.message ?? "not found"}. Uploads will fail until it is created.`,
      };
    }
    return {
      configured: true,
      message: `Bucket "${COMPANY_DOCUMENTS_BUCKET}" ready (${data.public ? "PUBLIC — should be private" : "private"}).`,
    };
  } catch (err) {
    return {
      configured: false,
      message: err instanceof Error ? err.message : "Storage could not be reached.",
    };
  }
}
