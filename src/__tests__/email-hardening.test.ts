/**
 * Regression tests — email hardening.
 * H4: CR/LF must never survive into MIME headers.
 * H6: token encryption must fail closed when no real key is configured.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { sendEmailSchema } from "@/lib/validate";
import { encryptToken, decryptToken } from "@/lib/services/email/crypto";

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
