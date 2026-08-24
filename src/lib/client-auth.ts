/**
 * Client-side auth helper.
 * Fetches current user from /api/auth/me instead of importing server-side auth.
 * This prevents "next/headers" from being bundled in client components.
 */
export async function getClientUser(): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
