"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";

export interface UpdateResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function clean(value: unknown, max = 20000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Save a monthly update draft. Nothing here sends mail: `sent` is deliberately
 * unreachable from the UI until a sending path exists, so an update can never
 * claim it reached investors when it did not.
 */
export async function saveInvestorUpdate(input: {
  id?: string;
  periodLabel: string;
  subject: string;
  body: string;
  status?: "draft" | "ready";
}): Promise<UpdateResult> {
  try {
    const user = await requireUser();
    const periodLabel = clean(input.periodLabel, 80);
    const subject = clean(input.subject, 200);
    const body = clean(input.body);

    if (!periodLabel) return { ok: false, error: "Give the update a period." };
    if (!subject) return { ok: false, error: "The update needs a subject." };
    if (!body) return { ok: false, error: "The update has no content yet." };

    const status = input.status === "ready" ? "ready" : "draft";
    const sp = getServiceClient();

    if (input.id) {
      const { error } = await sp
        .from("investor_updates")
        .update({
          period_label: periodLabel,
          subject,
          body,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      revalidatePath("/dashboard/ir");
      return { ok: true, id: input.id };
    }

    const { data, error } = await sp
      .from("investor_updates")
      .insert({
        user_id: user.id,
        period_label: periodLabel,
        subject,
        body,
        status,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/ir");
    return { ok: true, id: data.id as string };
  } catch (error) {
    console.error("[ir] save update:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the update.",
    };
  }
}

export async function deleteInvestorUpdate(id: string): Promise<UpdateResult> {
  try {
    const user = await requireUser();
    const sp = getServiceClient();
    const { error } = await sp
      .from("investor_updates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/ir");
    return { ok: true };
  } catch (error) {
    console.error("[ir] delete update:", error);
    return { ok: false, error: "Could not delete the update." };
  }
}
