/**
 * Unit tests — Reply understanding (rules classifier + pause logic)
 * Fully offline: AI refinement is disabled via rulesOnly, DB is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("@/lib/db", () => ({ query: (...a: unknown[]) => queryMock(...a) }));
vi.mock("@/lib/ai", () => ({
  chatCompletion: vi.fn(),
  isAiConfigured: () => false,
}));

import {
  classifyReplyRules,
  understandReply,
} from "@/lib/services/email/reply-understanding";

beforeEach(() => {
  queryMock.mockReset();
});

describe("classifyReplyRules", () => {
  it("flags meeting asks as meeting_ready", () => {
    const r = classifyReplyRules({
      subject: "Re: Introduction",
      body: "Happy to chat — does Thursday work? Send your calendar link.",
    });
    expect(r.interestLevel).toBe("meeting_ready");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects out-of-office autoresponders before anything else", () => {
    const r = classifyReplyRules({
      subject: "Automatic reply: Introduction",
      body: "I am out of the office until Monday with limited access to email. Thanks!",
    });
    expect(r.interestLevel).toBe("out_of_office");
  });

  it("separates soft_no from hard_no", () => {
    const soft = classifyReplyRules({
      subject: "Re: Intro",
      body: "We're not a fit for this one at the moment, but good luck with the raise.",
    });
    const hard = classifyReplyRules({
      subject: "Re: Intro",
      body: "Remove me from your list. Never contact me again.",
    });
    expect(soft.interestLevel).toBe("soft_no");
    expect(hard.interestLevel).toBe("hard_no");
  });

  it("treats deck requests as interested", () => {
    const r = classifyReplyRules({
      subject: "Re: Hello",
      body: "Interesting — please share the deck and I'll circulate internally.",
    });
    expect(r.interestLevel).toBe("interested");
  });

  it("returns neutral with low confidence when nothing matches", () => {
    const r = classifyReplyRules({ subject: "Re: Hi", body: "Ok." });
    expect(r.interestLevel).toBe("neutral");
    expect(r.confidence).toBeLessThanOrEqual(0.3);
  });
});

describe("understandReply (integration, rules-only)", () => {
  it("drafts a reply, pauses enrollments, and persists an insight", async () => {
    // sequences lookup -> one stop_on_reply sequence
    queryMock.mockResolvedValueOnce([{ id: "seq-1" }]);
    // enrollment pause update -> returns one row
    queryMock.mockResolvedValueOnce([{ id: "enr-1" }]);
    // insight insert
    queryMock.mockResolvedValueOnce([]);

    const result = await understandReply({
      userId: "u-1",
      investorId: "inv-1",
      threadId: "t-1",
      messageId: "msg-1",
      subject: "Re: Fundraise intro",
      body: "This sounds interesting — send me your availability and let's schedule a call.",
      options: { rulesOnly: true },
    });

    expect(result.interestLevel).toBe("meeting_ready");
    expect(result.engine).toBe("ai"); // rule-based draft still provided
    expect(result.suggestedReply).toContain("calendar");
    expect(result.pausedEnrollments).toBe(1);

    // 3 DB calls: sequence lookup, enrollment update, insight insert
    expect(queryMock).toHaveBeenCalledTimes(3);
    const insertSql = queryMock.mock.calls[2][0] as string;
    expect(insertSql).toContain("reply_insights");
    const insertParams = queryMock.mock.calls[2][1] as unknown[];
    expect(insertParams).toContain("meeting_ready");
  });

  it("does not draft for hard_no but still persists the insight", async () => {
    queryMock.mockResolvedValueOnce([]); // no stop_on_reply sequences
    queryMock.mockResolvedValueOnce([]); // insight insert

    const result = await understandReply({
      userId: "u-1",
      investorId: "inv-2",
      threadId: "t-2",
      messageId: "msg-2",
      subject: "Re: Intro",
      body: "Never contact me again.",
      options: { rulesOnly: true },
    });

    expect(result.interestLevel).toBe("hard_no");
    expect(result.suggestedReply).toBeNull();
    expect(result.pausedEnrollments).toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("survives total DB failure without throwing", async () => {
    queryMock.mockRejectedValue(new Error("connection reset"));
    const result = await understandReply({
      userId: "u-1",
      investorId: "inv-3",
      threadId: "t-3",
      messageId: "msg-3",
      subject: "Re: Intro",
      body: "Let's talk next week.",
      options: { rulesOnly: true },
    });
    expect(result.interestLevel).toBe("meeting_ready");
    expect(result.pausedEnrollments).toBe(0);
  });
});
