/**
 * Regression tests — email hardening.
 * H4: CR/LF must never survive into MIME headers.
 * H6: token encryption must fail closed when no real key is configured.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { sendEmailSchema } from "@/lib/validate";
import { encryptToken, decryptToken } from "@/lib/services/email/crypto";
import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe-token";
import {
  extractClickDestinations,
  resolveClickDestination,
} from "@/lib/services/email/click-destinations";

const base = {
  investorId: "11111111-1111-4111-8111-111111111111",
  bodyHtml: "<p>hello</p>",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("send schema header injection (H4)", () => {
  it("strips CR/LF from the subject", () => {
    const parsed = sendEmailSchema.parse({
      ...base,
      subject: "Hello\r\nBcc: attacker@example.com",
    });
    expect(parsed.subject).not.toMatch(/[\r\n]/);
    expect(parsed.subject).toBe("Hello Bcc: attacker@example.com");
  });

  it("strips CR/LF and quotes from attachment names", () => {
    const parsed = sendEmailSchema.parse({
      ...base,
      subject: "Hi",
      attachments: [
        { name: 'deck"\r\nX-Injected: 1.pdf', content: "AAA", mimeType: "application/pdf" },
      ],
    });
    expect(parsed.attachments?.[0].name).not.toMatch(/[\r\n"]/);
  });

  it("rejects a subject that is empty after stripping", () => {
    const result = sendEmailSchema.safeParse({ ...base, subject: "\r\n" });
    expect(result.success).toBe(false);
  });
});

describe("token encryption fail-closed (H6)", () => {
  it("refuses to encrypt without a configured key", () => {
    vi.stubEnv("EMAIL_TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptToken("refresh-token")).toThrow(/EMAIL_TOKEN_ENCRYPTION_KEY/);
  });

  it("round-trips with a real key", () => {
    vi.stubEnv("EMAIL_TOKEN_ENCRYPTION_KEY", "a".repeat(64));
    const encrypted = encryptToken("refresh-token");
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptToken(encrypted)).toBe("refresh-token");
  });
});

describe("signed unsubscribe tokens (M1)", () => {
  it("round-trips the address and sending user", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
    const token = signUnsubscribeToken("Founder@Example.com ", "user-1");
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken(token)).toEqual({
      email: "founder@example.com",
      userId: "user-1",
    });
  });

  it("rejects a tampered payload or signature", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
    const token = signUnsubscribeToken("founder@example.com")!;
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ e: "attacker@example.com", u: null })
    ).toString("base64url");
    expect(verifyUnsubscribeToken(`${forgedPayload}.${signature}`)).toBeNull();
    expect(verifyUnsubscribeToken(`${payload}.${signature.slice(0, -1)}x`)).toBeNull();
  });

  it("rejects tokens signed with another secret", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
    const token = signUnsubscribeToken("founder@example.com")!;
    vi.stubEnv("UNSUBSCRIBE_SECRET", "other-secret");
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("builds a link carrying the token and keeps the legacy email param", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
    const url = buildUnsubscribeUrl("https://app.test", "founder@example.com");
    expect(url).toContain("/unsubscribe?email=founder%40example.com");
    expect(url).toContain("&token=");
    const parsed = new URL(url);
    expect(verifyUnsubscribeToken(parsed.searchParams.get("token"))?.email).toBe(
      "founder@example.com"
    );
  });

  it("treats a missing token as legacy, not as a valid signature", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
    expect(verifyUnsubscribeToken(null)).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });
});

describe("stored click destinations (M2)", () => {
  const html = `
    <a href="https://capital.test/api/track/click/abc123?url=https%3A%2F%2Fdeck.example.com%2Fpitch">deck</a>
    <a href="https://cal.example.com/meet">call</a>
    <a href="mailto:founder@example.com">mail</a>
  `;

  it("extracts original destinations, including unwrapped tracked links", () => {
    expect(extractClickDestinations(html).sort()).toEqual([
      "https://cal.example.com/meet",
      "https://deck.example.com/pitch",
    ]);
  });

  it("resolves only a URL stored in that message", () => {
    expect(
      resolveClickDestination(html, "https://deck.example.com/pitch")
    ).toBe("https://deck.example.com/pitch");
  });

  it("refuses an attacker-supplied destination", () => {
    expect(resolveClickDestination(html, "https://evil.example.com/phish")).toBeNull();
    expect(resolveClickDestination(html, "https://cal.example.com/meet.evil")).toBeNull();
  });
});
