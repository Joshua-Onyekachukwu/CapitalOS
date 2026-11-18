// =============================================
// Click destinations (M2)
// =============================================
// The click route used to redirect to whatever `?url=` said, turning a tracked
// link into an open redirect. Destinations are now resolved from the message
// that was actually stored for that tracking id.

const HREF_RE = /href="([^"]+)"/gi;
const TRACKED_RE = /\/api\/track\/click\/[^?"]+\?url=([^"&]+)/i;

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Every URL the stored message was allowed to link to, deduplicated.
 * Stored HTML has already been rewritten by injectTracking, so tracked links
 * are unwrapped back to their original destination.
 */
export function extractClickDestinations(html: string): string[] {
  const destinations = new Set<string>();
  for (const match of html.matchAll(HREF_RE)) {
    const href = match[1];
    const tracked = href.match(TRACKED_RE);
    const candidate = tracked ? safeDecode(tracked[1]) : href;
    if (!candidate) continue;
    if (!/^https?:\/\//i.test(candidate)) continue;
    destinations.add(candidate);
  }
  return [...destinations];
}

/**
 * Returns the stored destination matching the requested URL, or null.
 * Exact match only: no prefix, host or scheme fallback.
 */
export function resolveClickDestination(html: string, requested: string): string | null {
  const decoded = safeDecode(requested) ?? requested;
  return extractClickDestinations(html).includes(decoded) ? decoded : null;
}
