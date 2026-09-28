/**
 * AI usage metering.
 *
 * Records every successful model call into credit_ledger (amount 0 —
 * informational metering rows, not charges) so usage, model mix and latency
 * are observable via the admin AI-stats page. Best-effort by design: a
 * metering failure must never break a user-facing AI call.
 */

import { createClient } from "@supabase/supabase-js";

export interface AiUsageRecord {
  userId?: string;
  task: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export function recordAiUsage(usage: AiUsageRecord): void {
  // Fire-and-forget: never await, never throw into the caller's path.
  void (async () => {
    try {
      const sp = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await sp.from("credit_ledger").insert({
        user_id: usage.userId,
        amount: 0,
        operation: usage.task,
        model_used: usage.model,
        tokens_used: usage.totalTokens,
        operation_detail: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          latencyMs: usage.latencyMs,
        },
      });
    } catch {
      // Metering is non-critical; swallow all errors.
    }
  })();
}
