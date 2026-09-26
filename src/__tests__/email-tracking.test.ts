/**
 * Unit tests — Email tracking (open pixel + click rewrite)
 * Runs fully offline with NEXT_PUBLIC_APP_URL pinned.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateTrackingId, injectTracking } from "@/lib/services/email/tracking";

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.capitalos.test";
});

describe("generateTrackingId", () => {
  it("returns a 16-char alphanumeric id", () => {
    const id = generateTrackingId();
    expect(id).toMatch(/^[a-z0-9]{16}$/);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTrackingId()));
    expect(ids.size).toBe(100);
  });
});

describe("injectTracking", () => {
  const html = `<html><body><p>Hi</p><a href="https://example.com">Link</a></body></html>`;

  it("injects a 1x1 open pixel before </body>", () => {
    const tracked = injectTracking(html, "track123", true);
    expect(tracked).toContain("/api/track/open/track123");
    expect(tracked.indexOf("/api/track/open/track123")).toBeLessThan(tracked.indexOf("</body>"));
  });

  it("rewrites outbound links through the click tracker", () => {
    const tracked = injectTracking(html, "track123", true);
    expect(tracked).toContain("/api/track/click/track123?url=" + encodeURIComponent("https://example.com"));
  });

  it("does not double-rewrite already-tracked links", () => {
    const tracked = injectTracking(html, "track123", true);
    const count = (tracked.match(/api\/track\/open\/track123/g) || []).length;
    expect(count).toBe(1);
  });

  it("returns html unchanged when tracking disabled", () => {
    expect(injectTracking(html, "track123", false)).toBe(html);
  });

  it("appends the pixel when no </body> tag exists", () => {
    const fragment = `<p>No body tag</p>`;
    const tracked = injectTracking(fragment, "track123", true);
    expect(tracked).toContain("/api/track/open/track123");
    expect(tracked.endsWith("!important;\" alt=\"\" />")).toBe(true);
  });

  it("leaves mailto: and tel: links untracked", () => {
    const frag = `<a href="mailto:a@b.com">mail</a><a href="tel:+123">tel</a>`;
    const tracked = injectTracking(frag, "track123", true);
    expect(tracked).toContain(`href="mailto:a@b.com"`);
    expect(tracked).toContain(`href="tel:+123"`);
  });
});
