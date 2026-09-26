/**
 * Unit tests — Email token encryption (AES-256-GCM)
 * Runs fully offline. Verifies round-trip, uniqueness of IVs,
 * and tamper detection.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { encryptToken, decryptToken } from "@/lib/services/email/crypto";

describe("email crypto (AES-256-GCM)", () => {
  beforeEach(() => {
    // Deterministic key for tests
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
  });

  it("round-trips a plaintext token", () => {
    const token = "ya29.a0AfH6SMBx示例-refresh-token";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toBe(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const token = "same-secret-value";
    const a = encryptToken(token);
    const b = encryptToken(token);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(token);
    expect(decryptToken(b)).toBe(token);
  });

  it("throws on a malformed ciphertext", () => {
    expect(() => decryptToken("not-a-valid-token")).toThrow();
    expect(() => decryptToken("iv:tag")).toThrow();
  });

  it("detects tampering via the auth tag", () => {
    const encrypted = encryptToken("sensitive-oauth-token");
    const parts = encrypted.split(":");
    // Flip a hex char in the ciphertext
    const tamperedCiphertext = parts[2][0] === "a" ? "b" + parts[2].slice(1) : "a" + parts[2].slice(1);
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
