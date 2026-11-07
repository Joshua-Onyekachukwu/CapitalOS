// =============================================
// Platform alert channel
// =============================================
// The rule that matters: an owner with no mailbox still gets an alert when the
// platform sender is configured, and nothing is ever reported as sent when no
// sender exists.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseAlertChannel,
  platformEmailConfigured,
  platformProvider,
  sendPlatformEmail,
} from "@/lib/services/email/platform";

const PLATFORM_KEYS = [
  "RESEND_API_KEY",
  "ALERT_FROM_EMAIL",
  "RESEND_FROM_EMAIL",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

function clearPlatformEnv() {
  for (const key of PLATFORM_KEYS) vi.stubEnv(key, "");
}

describe("alert channel selection", () => {
  it("prefers the owner's own mailbox", () => {
    expect(chooseAlertChannel({ hasMailbox: true, hasPlatformProvider: true })).toBe("mailbox");
  });

  it("falls back to the platform sender without a mailbox", () => {
    expect(chooseAlertChannel({ hasMailbox: false, hasPlatformProvider: true })).toBe("platform");
  });

  it("reports no channel when neither exists", () => {
    expect(chooseAlertChannel({ hasMailbox: false, hasPlatformProvider: false })).toBe("none");
  });
});

describe("platform provider detection", () => {
  beforeEach(clearPlatformEnv);
  afterEach(() => vi.unstubAllEnvs());

  it("finds nothing when no provider is configured", () => {
    expect(platformProvider()).toBe("none");
    expect(platformEmailConfigured()).toBe(false);
  });

  it("uses Resend when its key and sender are both set", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("ALERT_FROM_EMAIL", "alerts@capitalos.test");
    expect(platformProvider()).toBe("resend");
    expect(platformEmailConfigured()).toBe(true);
  });

  it("does not treat a lone Resend key as a sender", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(platformProvider()).toBe("none");
  });

  it("falls back to the platform SMTP account", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "platform@example.com");
    vi.stubEnv("SMTP_PASS", "app-password");
    expect(platformProvider()).toBe("smtp");
    expect(platformEmailConfigured()).toBe(true);
  });

  it("rejects a half-configured SMTP account", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "platform@example.com");
    expect(platformProvider()).toBe("none");
  });
});

describe("sendPlatformEmail without a provider", () => {
  beforeEach(clearPlatformEnv);
  afterEach(() => vi.unstubAllEnvs());

  it("reports skipped rather than pretending to send", async () => {
    const result = await sendPlatformEmail({
      to: "owner@example.com",
      subject: "Your data room link was opened",
      html: "<p>opened</p>",
      text: "opened",
    });
    expect(result).toEqual({ sent: false, reason: "skipped_no_provider" });
  });
});
