// =============================================
// Unsubscribe tokens (M1)
// =============================================
// Links are clicked from outside the app, so the token is the only proof the
// request came from a message we sent. It binds the address (and the sending
// user, when known) to an HMAC.
//
// Already-delivered mail carries `?email=` with no token. Those links must keep
// working, so an unsigned request is still accepted. New links always carry a
// token; a *present but invalid* token is rejected rather than downgraded.

import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY ||
    ""
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
}

export function normalizeUnsubscribeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Returns null when no secret is configured: a token nobody can verify is
 * worse than the legacy unsigned link, so callers fall back to it.
 */
export function signUnsubscribeToken(email: string, userId?: string): string | null {
  if (!secret()) return null;
  const payload = Buffer.from(
    JSON.stringify({ e: normalizeUnsubscribeEmail(email), u: userId || null })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
  token: string | null | undefined
): { email: string; userId: string | null } | null {
  if (!token || !secret()) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed?.e !== "string" || !parsed.e.includes("@")) return null;
    return { email: normalizeUnsubscribeEmail(parsed.e), userId: parsed.u || null };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(
  baseUrl: string,
  email: string,
  userId?: string
): string {
  const normalized = normalizeUnsubscribeEmail(email);
  const token = signUnsubscribeToken(normalized, userId);
  const query = `email=${encodeURIComponent(normalized)}`;
  return `${baseUrl}/unsubscribe?${query}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
}
