// =============================================
// Copilot tool registry — gating behaviour
// =============================================
// These tests pin the two properties the approval flow depends on: a write can
// only be proposed with a real pipeline stage, and every write tool is marked
// as requiring approval (so the API persists it instead of executing it).

import { describe, it, expect } from "vitest";
import { COPILOT_TOOLS, detectToolRequest, getTool } from "@/lib/copilot/tools";
import { PIPELINE_STAGES } from "@/lib/services/pipeline/stages";

describe("copilot tool registry", () => {
  it("marks exactly the mutating tool as requiring approval", () => {
    const writes = COPILOT_TOOLS.filter((t) => t.requiresApproval).map((t) => t.name);
    expect(writes).toEqual(["move_pipeline_stage"]);
  });

  it("exposes read tools that never require approval", () => {
    for (const name of ["search_investors", "pipeline_snapshot", "readiness_summary"]) {
      expect(getTool(name)?.requiresApproval).toBe(false);
    }
  });

  it("returns undefined for an unknown tool", () => {
    expect(getTool("delete_everything")).toBeUndefined();
  });

  it("summarises a move with the human stage label", () => {
    const summary = getTool("move_pipeline_stage")!.summarize({
      investorName: "Sequoia",
      stage: "contacted",
    });
    expect(summary).toContain("Sequoia");
    expect(summary).toContain("Contacted");
  });
});

describe("copilot intent detection", () => {
  it("detects a move phrased with a stage label", () => {
    const req = detectToolRequest('Move "Sequoia" to First Meeting Completed');
    expect(req?.tool).toBe("move_pipeline_stage");
    expect(req?.args.investorName).toBe("Sequoia");
    expect(req?.args.stage).toBe("first_meeting_completed");
  });

  it("detects a move phrased with a stage id", () => {
    const req = detectToolRequest("move Acme Ventures to due diligence");
    expect(req?.tool).toBe("move_pipeline_stage");
    expect(req?.args.stage).toBe("due_diligence");
  });

  it("does not propose a move when the stage is not a real stage", () => {
    expect(detectToolRequest("move Sequoia to the moon")).toBeNull();
  });

  it("maps every pipeline stage label back to its id", () => {
    for (const stage of PIPELINE_STAGES) {
      const req = detectToolRequest(`move Example Capital to ${stage.label}`);
      expect(req?.args.stage).toBe(stage.id);
    }
  });

  it("routes pipeline questions to the read-only snapshot", () => {
    expect(detectToolRequest("what is my pipeline status?")?.tool).toBe("pipeline_snapshot");
  });

  it("routes readiness questions to the read-only summary", () => {
    expect(detectToolRequest("how many investors are ready to contact?")?.tool).toBe(
      "readiness_summary"
    );
  });

  it("falls through to conversation for ordinary advice questions", () => {
    expect(detectToolRequest("how should I price my seed round?")).toBeNull();
  });
});
