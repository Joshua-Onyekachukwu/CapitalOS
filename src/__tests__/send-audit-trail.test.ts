/**
 * Unit tests — Send audit trail (task 2.3, migration 014)
 *
 * Pins the contract that every outbound send is preceded by a visible credit
 * gate/deduction and that the resulting logging carries the campaign/sequence
 * refs. executeSend's writes flow through the SQL shim, so here the shim is
 * mocked and its SQL strings are asserted directly — no network needed.
 */
import { describe, it, expect, vi } from "vitest";

// Mutable test state reachable from inside the vi.mock factory (hoisting-safe).
const state = vi.hoisted(() => ({
  failAuditInsert: false as boolean | "hard",
}));

// ── Mock the SQL shim ─────────────────────────────────────
type Query = { sql: string; params: any[] };
const queries: Query[] = [];

function makeRowsFor(sql: string): any[] {
  if (/FROM\s+email_accounts/i.test(sql)) {
    return [{
      id: "acc-1", provider: "google", email_address: "founder@x.com",
      access_token: "enc", refresh_token: "enc",
      token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      is_active: true,
    }];
  }
  if (/FROM\s+campaign_sequence_enrollments/i.test(sql) && /JOIN\s+investors/i.test(sql)) {
    return [];
  }
  if (/FROM\s+campaign_sequence_enrollments/i.test(sql)) {
    return [{
      investor_id: "inv-1", sequence_id: "seq-1", campaign_id: "camp-1", current_step: 1,
    }];
  }
  if (/FROM\s+campaign_sequences/i.test(sql)) {
    return [{ id: "seq-1", total_steps: 2, total_completed: 0 }];
  }
  return [];
}

vi.mock("@/lib/db", () => ({
  query: async (sql: string, params: any[] = []) => {
    queries.push({ sql, params });
    if (
      state.failAuditInsert &&
      /INSERT\s+INTO\s+email_messages/i.test(sql)
    ) {
      if (state.failAuditInsert === "hard") {
        throw new Error("connection refused");
      }
      throw new Error("column email_messages.sequence_id does not exist");
    }
    return makeRowsFor(sql);
  },
}));

vi.mock("@/lib/billing/credits", () => ({
  hasCredits: vi.fn().mockResolvedValue({ hasCredits: true, balance: 10, cost: 1 }),
  consumeCredits: vi.fn().mockResolvedValue({ success: true, balance: 9, cost: 1 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, balance: 10 }),
}));

vi.mock("@/lib/services/email/sender", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "m-1" }),
}));

import { sendEmail } from "@/lib/services/email/sender";
import { executeSend, getPendingSends } from "@/lib/services/campaigns/sequence";
import type { SequenceStep } from "@/lib/services/campaigns/sequence";
import {
  hasCredits,
  consumeCredits,
  addCredits,
} from "@/lib/billing/credits";
import { sendEmailSchema } from "@/lib/validate";

const step = (o: Partial<SequenceStep> = {}) =>
  ({ id: "step-1", step_number: 1, step_type: "intro", delay_days: 0, delay_hours: 0, ...o }) as SequenceStep;

async function runSendToCompletion(
  options: { sendFails?: boolean; sender?: any } = {}
) {
  // Reset all mocks so a previous test's mockImplementation / call history
  // (e.g. the refund test's failing sender) can't leak into the next test.
  (sendEmail as any).mockReset();
  (sendEmail as any).mockImplementation(
    options.sender ?? (async () => ({ success: true, messageId: "m-1" }))
  );
  (hasCredits as any).mockClear();
  (consumeCredits as any).mockClear();
  (addCredits as any).mockClear();

  // executeSend() needs the account query and the enrollment query;
  // both come back from makeRowsFor() above.
  const result = await executeSend(
    "enr-1", step(), "vc@fund.com", "Ada Investor", "user-1", "Subject", "<p>Hi</p>"
  );
  return result;
}

describe("send audit trail (2.3)", () => {
  it("credits are checked AND deducted before any send is attempted", async () => {
    await runSendToCompletion();

    expect(hasCredits).toHaveBeenCalledWith("user-1", "email_send");
    expect(consumeCredits).toHaveBeenCalledWith("user-1", "email_send");

    // Order proof: the gate ran before the sender was invoked.
    expect((consumeCredits as any).mock.invocationCallOrder[0]).toBeLessThan(
      (sendEmail as any).mock.invocationCallOrder[0]
    );
  });

  it("sender invoked with the campaign/sequence audit refs", async () => {
    await runSendToCompletion();
    const call = (sendEmail as any).mock.calls.at(-1)[0];
    expect(call.investorId).toBe("inv-1");
    expect(call.campaignId).toBe("camp-1");
    expect(call.sequenceId).toBe("seq-1");
  });

  it("on send success the email_messages INSERT carries campaign/sequence columns", async () => {
    await runSendToCompletion();
    const emInsert = queries.find(
      (q) => /INSERT\s+INTO\s+email_messages/i.test(q.sql)
    );
    expect(emInsert).toBeTruthy();
    expect(emInsert!.sql).toMatch(/campaign_id/i);
    expect(emInsert!.sql).toMatch(/sequence_id/i);
  });

  it("on send failure the credit cost is refunded via the ledger", async () => {
    await runSendToCompletion({
      sender: async () => ({ success: false, error: "Gmail API error: 500" }),
    });
    expect(addCredits).toHaveBeenCalledWith(
      "user-1",
      1,
      "email_send_refund",
      expect.objectContaining({ reason: "sequence_send_failed" })
    );
  });

  it("pre-migration: audit insert rejection (42703) never fails a finished send", async () => {
    state.failAuditInsert = true;
    try {
      const result = await runSendToCompletion();
      expect(result).toBe(true);
      // The send succeeded, so no refund is taken.
      expect(addCredits).not.toHaveBeenCalled();
    } finally {
      state.failAuditInsert = false;
    }
  });

  it("pre-migration: other email_messages insert errors still fail loudly", async () => {
    state.failAuditInsert = "hard";
    try {
      await expect(runSendToCompletion()).rejects.toThrow(/connection refused/);
    } finally {
      state.failAuditInsert = false;
    }
  });

  it("schema accepts the optional audit refs; rejects garbage ids", () => {
    const ok = sendEmailSchema.safeParse({
      investorId: "123e4567-e89b-12d3-a456-426614174000",
      subject: "s",
      bodyHtml: "b",
      campaignId: "123e4567-e89b-12d3-a456-426614174000",
      approvedDraftId: undefined,
    });
    expect(ok.success).toBe(true);

    const bad = sendEmailSchema.safeParse({
      investorId: "not-a-uuid",
      subject: "s",
      bodyHtml: "b",
    });
    expect(bad.success).toBe(false);
  });
});
