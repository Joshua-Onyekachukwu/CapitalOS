// =============================================
// Import preview tokens
// =============================================
// The admin import endpoint used to write as soon as it was called. A preview
// step is only meaningful if the write cannot happen without it, so the preview
// returns a short-lived HMAC over (expiry, source, content hash) and the import
// route refuses a body that does not carry a valid one.
//
// The signature binds the exact CSV bytes: editing the file between preview and
// confirm invalidates the token instead of importing a file nobody previewed.

import crypto from "crypto";

const TTL_MS = 10 * 60 * 1000;

function signingKey(): string {
  // A dedicated secret is preferred; the service-role key is already required
  // by this route and never leaves the server.
  const key = process.env.IMPORT_CONFIRM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("No key available to sign import previews");
  return key;
}

function signature(csvContent: string, source: string, expiresAt: number): string {
  const contentHash = crypto.createHash("sha256").update(csvContent).digest("hex");
  return crypto
    .createHmac("sha256", signingKey())
    .update(`${expiresAt}.${source}.${contentHash}`)
    .digest("base64url");
}

export function signImportPreview(csvContent: string, source: string): string {
  const expiresAt = Date.now() + TTL_MS;
  return `${expiresAt}.${signature(csvContent, source, expiresAt)}`;
}

export function verifyImportPreview(
  token: unknown,
  csvContent: string,
  source: string
): boolean {
  if (typeof token !== "string") return false;
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiresAt = Number(token.slice(0, separator));
  const presented = token.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = signature(csvContent, source, expiresAt);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
