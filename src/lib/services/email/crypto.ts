// =============================================
// Token Encryption/Decryption
// =============================================
// Encrypts OAuth tokens before storage, decrypts for use.
// Uses AES-256-GCM for authenticated encryption.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    // Derive a key from Supabase URL as fallback (not ideal but functional)
    const fallback = process.env.NEXT_PUBLIC_SUPABASE_URL || "capital-os-default-key";
    // Hash to 32 bytes
    return createHash("sha256").update(fallback).digest();
  }
  return Buffer.from(key, "hex").length === 32
    ? Buffer.from(key, "hex")
    : Buffer.from(createHash("sha256").update(key).digest());
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
