/**
 * Unit tests — Email sender service (src/lib/services/email/sender.ts)
 *
 * Fully mocked: Supabase client, OAuth crypto, suppression, health guard,
 * and global fetch. Verifies provider selection, MIME building (including
 * attachments), token refresh, compliance injection, and failure paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock (table-aware) ───────────────────────
const dbRows: Record<string, any[]> = {
  email_accounts: [],
  email_messages: [],
};
const insertedMessages: any[] = [];

function makeSpMock() {
  function makeBuilder(table: string) {
    const builder: any = {
      select: () => builder,
      insert: (row: any) => {
        if (table === "email_messages") insertedMessages.push(row);
        return builder;
      },
      update: () => builder,
      eq: () => builder,
      limit: () => builder,
      single: () => builder,
      then: (resolve: any) =>
        Promise.resolve({ data: dbRows[table] ?? [], error: null }).then(resolve),
    };
    return builder;
  }
  return { from: (t: string) => makeBuilder(t) };
}
const spMock = makeSpMock();

vi.mock("@supabase/supabase-js", () => ({ createClient: () => spMock }));

// ── Service dependency mocks ──────────────────────────
vi.mock("@/lib/services/email/crypto", () => ({
  encryptToken: (t: string) => `enc:${t}`,
  decryptToken: () => "decrypted-access-token",
}));
vi.mock("@/lib/services/email/suppression", () => ({
  isSuppressed: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/services/email/events", () => ({
  logSend: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/services/email/sending-guard", () => ({
  checkBeforeSend: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { sendEmail } from "@/lib/services/email/sender";
import { isSuppressed } from "@/lib/services/email/suppression";
import { checkBeforeSend } from "@/lib/services/email/sending-guard";

// ── fetch mock ────────────────────────────────────────
const fetchCalls: { url: string; init: any }[] = [];
const fetchResponses: Record<string, (url: string) => { ok: boolean; status?: number; json: () => any; text: () => string }> = {};

function defaultResponse(url: string) {
  if (url.includes("gmail.googleapis.com")) {
    return { ok: true, json: () => ({ id: "gmail-msg-1" }), text: () => "" };
  }
  if (url.includes("graph.microsoft.com")) {
    return { ok: true, status: 202, json: () => ({}), text: () => "" };
  }
  if (url.includes("oauth2.googleapis.com")) {
    return { ok: true, json: () => ({ access_token: "fresh-token", expires_in: 3600 }), text: () => "" };
  }
  return { ok: false, status: 404, json: () => ({}), text: () => "not found" };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedMessages.length = 0;
  fetchCalls.length = 0;
  for (const k of Object.keys(fetchResponses)) delete fetchResponses[k]; // don't leak error overrides across tests
  (isSuppressed as any).mockResolvedValue(false);
  (checkBeforeSend as any).mockResolvedValue({ allowed: true });

  global.fetch = vi.fn(async (url: any, init: any) => {
    const u = String(url);
    fetchCalls.push({ url: u, init });
    const factory = fetchResponses[u] || defaultResponse;
    return factory(u);
  }) as any;

  dbRows.email_accounts = [
    {
      id: "acct-1",
      user_id: "user-1",
      provider: "google",
      email_address: "founder@startup.com",
      access_token: "enc:xxx",
      refresh_token: "enc:yyy",
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(), // valid
      is_active: true,
    },
  ];
});

const baseParams = {
  userId: "user-1",
  to: "investor@vc.com",
  subject: "Intro to Acme",
  bodyHtml: "<html><body><p>We build payments for SMBs.</p></body></html>",
};

function gmailRaw(): string {
  const call = fetchCalls.find((c) => c.url.includes("gmail.googleapis.com"))!;
  const raw = JSON.parse(call.init.body).raw as string;
  return Buffer.from(raw, "base64").toString("utf8");
}

describe("sendEmail — provider routing", () => {
  it("sends via Gmail when the connected account is Google", async () => {
    const result = await sendEmail(baseParams);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("gmail-msg-1");
    const mime = gmailRaw();
    expect(mime).toContain("To: investor@vc.com");
    expect(mime).toContain("Subject: Intro to Acme");
    expect(mime).toContain("text/html");
  });

  it("sends via Microsoft Graph when the connected account is Microsoft", async () => {
    dbRows.email_accounts = [
      { ...dbRows.email_accounts[0], provider: "microsoft" },
    ];

    const result = await sendEmail(baseParams);

    expect(result.success).toBe(true);
    const call = fetchCalls.find((c) => c.url.includes("graph.microsoft.com"))!;
    const message = JSON.parse(call.init.body).message;
    expect(message.subject).toBe("Intro to Acme");
    expect(message.toRecipients[0].emailAddress.address).toBe("investor@vc.com");
  });

  it("fails with a clear message when no email account is connected", async () => {
    dbRows.email_accounts = [];

    const result = await sendEmail(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No email account connected");
    expect(fetchCalls).toHaveLength(0);
  });

  it("blocks sends to suppressed addresses", async () => {
    (isSuppressed as any).mockResolvedValue(true);

    const result = await sendEmail(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("suppression");
    expect(fetchCalls).toHaveLength(0);
  });

  it("blocks sends when the health guard disallows", async () => {
    (checkBeforeSend as any).mockResolvedValue({ allowed: false, reason: "Account in warmup" });

    const result = await sendEmail(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("warmup");
  });

  it("surfaces provider API errors instead of faking success", async () => {
    fetchResponses["https://gmail.googleapis.com/gmail/v1/users/me/messages/send"] = () => ({
      ok: false,
      status: 403,
      json: () => ({}),
      text: () => "quota exceeded",
    });

    const result = await sendEmail(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Gmail API error");
  });
});

describe("sendEmail — attachments (regression: were silently dropped)", () => {
  const deckAttachment = {
    filename: "pitch-deck.pdf",
    content: Buffer.from("fake-pdf-bytes").toString("base64"),
    mimeType: "application/pdf",
  };

  it("includes attachments in the Gmail MIME message", async () => {
    const result = await sendEmail({ ...baseParams, attachments: [deckAttachment] });
    expect(result.success).toBe(true);

    const mime = gmailRaw();
    expect(mime).toContain("multipart/mixed");
    expect(mime).toContain('name="pitch-deck.pdf"');
    expect(mime).toContain("Content-Disposition: attachment");
    expect(mime).toContain(Buffer.from("fake-pdf-bytes").toString("base64"));
  });

  it("wraps body parts in multipart/alternative inside multipart/mixed", async () => {
    await sendEmail({ ...baseParams, attachments: [deckAttachment] });

    const mime = gmailRaw();
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("text/plain");
    expect(mime).toContain("text/html");
  });

  it("includes attachments in the Microsoft Graph payload", async () => {
    dbRows.email_accounts = [
      { ...dbRows.email_accounts[0], provider: "microsoft" },
    ];

    const result = await sendEmail({ ...baseParams, attachments: [deckAttachment] });
    expect(result.success).toBe(true);

    const call = fetchCalls.find((c) => c.url.includes("graph.microsoft.com"))!;
    const message = JSON.parse(call.init.body).message;
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0].name).toBe("pitch-deck.pdf");
    expect(message.attachments[0].contentBytes).toBe(deckAttachment.content);
    expect(message.attachments[0]["@odata.type"]).toBe("#microsoft.graph.fileAttachment");
  });

  it("sends plain multipart/alternative when no attachments are given", async () => {
    await sendEmail(baseParams);

    const mime = gmailRaw();
    expect(mime).toContain("multipart/alternative");
    expect(mime).not.toContain("multipart/mixed");
  });
});

describe("sendEmail — compliance, tracking, logging", () => {
  it("injects the CAN-SPAM unsubscribe footer", async () => {
    await sendEmail(baseParams);

    const mime = gmailRaw();
    expect(mime).toContain("Unsubscribe from all emails");
    expect(mime).toContain("/api/unsubscribe?email=investor%40vc.com");
  });

  it("logs the outbound message with tracking fields", async () => {
    await sendEmail(baseParams);

    expect(insertedMessages).toHaveLength(1);
    const msg = insertedMessages[0];
    expect(msg.to_address).toBe("investor@vc.com");
    expect(msg.from_address).toBe("founder@startup.com");
    expect(msg.status).toBe("sent");
    expect(msg.direction).toBe("outbound");
    expect(msg.tracking_id).toBeTruthy();
  });

  it("refreshes an expired Google token before sending", async () => {
    dbRows.email_accounts = [
      { ...dbRows.email_accounts[0], token_expires_at: new Date(Date.now() - 1000).toISOString() },
    ];

    const result = await sendEmail(baseParams);

    expect(result.success).toBe(true);
    const refresh = fetchCalls.find((c) => c.url.includes("oauth2.googleapis.com/token"));
    expect(refresh).toBeTruthy();
    expect(String(refresh!.init.body)).toContain("grant_type=refresh_token");
    // Send happens after refresh
    const sendIdx = fetchCalls.findIndex((c) => c.url.includes("gmail.googleapis.com"));
    const refreshIdx = fetchCalls.findIndex((c) => c.url.includes("oauth2.googleapis.com"));
    expect(refreshIdx).toBeLessThan(sendIdx);
  });
});
