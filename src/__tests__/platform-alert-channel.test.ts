// =============================================
// Platform alert channel
// =============================================
// The rule that matters: an owner with no mailbox still gets an alert when the
// platform sender is configured, and nothing is ever reported as sent when no
// sender exists.

import { describe, expect, it } from "vitest";
import { chooseAlertChannel } from "@/lib/services/email/platform";

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
