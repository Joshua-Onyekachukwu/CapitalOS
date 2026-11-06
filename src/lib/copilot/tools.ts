// =============================================
// Copilot tool registry
// =============================================
// A tool is a small, named capability with one rule that matters: anything that
// changes data must be approved by the owner before it runs. Read tools run
// inline and their output is attached to the answer; write tools are persisted
// as `pending` rows in copilot_tool_runs and executed only from the approval
// endpoint.
//
// Every executor takes the caller's user id and scopes its query by it. The
// service-role client bypasses RLS, so that scoping is the only thing standing
// between one tenant's copilot and another tenant's pipeline.

import { createClient } from "@supabase/supabase-js";
import { PIPELINE_STAGES, isPipelineStageId } from "@/lib/services/pipeline/stages";

export interface CopilotToolRequest {
  tool: string;
  args: Record<string, unknown>;
}

export interface CopilotTool {
  name: string;
  description: string;
  /** Mutating tools must never execute without an explicit owner approval. */
  requiresApproval: boolean;
  /** One-line, human-readable description of exactly what will happen. */
  summarize: (args: Record<string, unknown>) => string;
  execute: (userId: string, args: Record<string, unknown>) => Promise<unknown>;
}

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const asText = (value: unknown, max = 120): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const stageLabel = (id: string): string =>
  PIPELINE_STAGES.find((s) => s.id === id)?.label ?? id;

export const COPILOT_TOOLS: CopilotTool[] = [
  {
    name: "search_investors",
    description: "Search the investor corpus by name. Read-only.",
    requiresApproval: false,
    summarize: (args) => `Search investors for “${asText(args.query) || "anything"}”.`,
    execute: async (_userId, args) => {
      const query = asText(args.query, 80).replace(/[,()%]/g, " ").trim();
      if (!query) return { matches: [], note: "No search term was given." };
      const { data, error } = await getSp()
        .from("investors")
        .select("id, full_name, investor_type, fit_score, email, country, investment_stages, investment_sectors")
        .eq("is_active", true)
        .ilike("full_name", `%${query}%`)
        .order("fit_score", { ascending: false, nullsFirst: false })
        .limit(5);
      if (error) throw new Error(error.message);
      return { matches: data ?? [], count: data?.length ?? 0 };
    },
  },
  {
    name: "pipeline_snapshot",
    description: "Count the caller's pipeline entries per stage. Read-only.",
    requiresApproval: false,
    summarize: () => "Read your pipeline stage counts.",
    execute: async (userId) => {
      const { data, error } = await getSp()
        .from("user_pipeline_entries")
        .select("stage")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const stage = String((row as { stage?: string }).stage ?? "unknown");
        counts[stage] = (counts[stage] || 0) + 1;
      }
      return {
        total: data?.length ?? 0,
        byStage: Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([stage, count]) => ({ stage, label: stageLabel(stage), count })),
      };
    },
  },
  {
    name: "readiness_summary",
    description: "Count the investor corpus by outreach readiness. Read-only.",
    requiresApproval: false,
    summarize: () => "Read the corpus outreach-readiness counts.",
    execute: async () => {
      // Counts come from the facet rollup, so this is two indexed reads instead
      // of a scan over the corpus.
      const { data: facets, error } = await getSp()
        .from("investor_facets")
        .select("value, count")
        .eq("dimension", "readiness")
        .order("count", { ascending: false });
      if (error) throw new Error(error.message);
      return {
        readiness: (facets ?? []).map((f) => ({ value: f.value, count: f.count })),
      };
    },
  },
  {
    name: "move_pipeline_stage",
    description:
      "Move one investor already in your pipeline to a different stage. Requires approval.",
    requiresApproval: true,
    summarize: (args) =>
      `Move ${asText(args.investorName) || asText(args.investorId) || "an investor"} to ${
        isPipelineStageId(args.stage) ? stageLabel(args.stage) : "an unknown stage"
      }.`,
    execute: async (userId, args) => {
      const stage = asText(args.stage, 40);
      if (!isPipelineStageId(stage)) {
        throw new Error(
          `"${stage}" is not a pipeline stage. Valid stages: ${PIPELINE_STAGES.map((s) => s.id).join(", ")}`
        );
      }

      const investorId = asText(args.investorId, 64);
      const investorName = asText(args.investorName, 120);

      if (!investorId && !investorName) {
        throw new Error("An investor id or name is required");
      }

      const sp = getSp();

      // Only rows already owned by this user are eligible — the copilot cannot
      // add investors to a pipeline on its own.
      const { data: entries, error: entryError } = await sp
        .from("user_pipeline_entries")
        .select("id, investor_id, stage")
        .eq("user_id", userId);
      if (entryError) throw new Error(entryError.message);
      if (!entries || entries.length === 0) {
        throw new Error("Your pipeline is empty, so there is nothing to move");
      }

      let target = entries.find((e) => e.investor_id === investorId);

      if (!target && investorName) {
        const { data: matches, error: matchError } = await sp
          .from("investors")
          .select("id, full_name")
          .eq("is_active", true)
          .ilike("full_name", `%${investorName.replace(/[,()%]/g, " ")}%`)
          .limit(5);
        if (matchError) throw new Error(matchError.message);
        const ids = new Set((matches ?? []).map((m) => m.id));
        const inPipeline = entries.filter((e) => ids.has(e.investor_id));
        if (inPipeline.length === 0) {
          throw new Error(`No investor matching “${investorName}” is in your pipeline`);
        }
        if (inPipeline.length > 1) {
          const names = (matches ?? []).map((m) => m.full_name).join("; ");
          throw new Error(`That name matches several pipeline investors: ${names}. Be specific.`);
        }
        target = inPipeline[0];
      }

      if (!target) throw new Error("That investor is not in your pipeline");

      const { error: updateError } = await sp
        .from("user_pipeline_entries")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", target.id)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);

      return {
        investorId: target.investor_id,
        from: target.stage,
        to: stage,
        label: stageLabel(stage),
      };
    },
  },
];

export function getTool(name: string): CopilotTool | undefined {
  return COPILOT_TOOLS.find((tool) => tool.name === name);
}

const MOVE_VERB = /\b(?:move|put|set|change|update|advance|promote)\b/i;

/**
 * Deterministic intent matching.
 *
 * This is deliberately not a model call: a write must be proposed identically
 * every time for the same sentence, and an AI that invents a tool argument here
 * would be proposing a database write it half-guessed. Anything that does not
 * match cleanly falls through to normal conversation.
 */
export function detectToolRequest(message: string): CopilotToolRequest | null {
  const text = (message || "").trim();
  if (!text) return null;

  if (MOVE_VERB.test(text) && /\b(?:to|into)\b/i.test(text)) {
    const match = text.match(
      /\b(?:move|put|set|change|update|advance|promote)\s+(?:the\s+)?(.+?)\s+(?:to|into)\s+(.+?)[.!?]*$/i
    );
    if (match) {
      const subject = match[1].trim();
      const target = match[2].trim().toLowerCase();
      const stage =
        PIPELINE_STAGES.find(
          (s) =>
            target.includes(s.label.toLowerCase()) ||
            target.includes(s.id.replace(/_/g, " ")) ||
            target === s.id
        ) ?? null;

      if (stage) {
        return {
          tool: "move_pipeline_stage",
          args: { investorName: stripQuotes(subject), stage: stage.id },
        };
      }
      // A move phrased with an unknown stage is not a tool call — the assistant
      // should ask which stage, not guess one.
      return null;
    }
  }

  if (/\b(?:pipeline|funnel)\b/i.test(text) && /\b(?:how|what|status|summary|count|many)\b/i.test(text)) {
    return { tool: "pipeline_snapshot", args: {} };
  }

  if (/\b(?:readiness|ready\s+to\s+(?:contact|reach|email|outreach))\b/i.test(text)) {
    return { tool: "readiness_summary", args: {} };
  }

  const searchMatch = text.match(
    /\b(?:find|search(?:\s+for)?|look\s+up|who\s+is|tell\s+me\s+about)\s+(?:investors?\s+)?(?:at\s+|from\s+|named\s+)?(.{2,80})$/i
  );
  if (searchMatch && !MOVE_VERB.test(text)) {
    return { tool: "search_investors", args: { query: stripQuotes(searchMatch[1]) } };
  }

  return null;
}

function stripQuotes(value: string): string {
  return value.replace(/^["'“”]+|["'“”]+$/g, "").replace(/[.!?]+$/, "").trim();
}
