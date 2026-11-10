"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const TASK_STATUSES = ["open", "done", "snoozed"] as const;
const INTRO_STATUSES = ["planned", "requested", "made", "met", "declined"] as const;
const INTRO_ROUTES = ["direct", "warm", "cold"] as const;
const OPP_KINDS = ["grant", "accelerator", "event", "challenge", "other"] as const;
const OPP_STATUSES = ["watching", "applied", "won", "skipped"] as const;

function clean(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("[relationships]", message);
  return { ok: false, error: message };
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(input: {
  title: string;
  notes?: string;
  dueAt?: string;
  investorId?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "A task needs a title." };

    const sp = getServiceClient();
    const { error } = await sp.from("crm_tasks").insert({
      user_id: user.id,
      title,
      notes: clean(input.notes),
      due_at: clean(input.dueAt, 40),
      investor_id: clean(input.investorId, 60),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/crm");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setTaskStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
      return { ok: false, error: "Unknown task status." };
    }
    const sp = getServiceClient();
    const { error } = await sp
      .from("crm_tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/crm");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const sp = getServiceClient();
    const { error } = await sp.from("crm_tasks").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/crm");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ── Introductions ────────────────────────────────────────────────────────────

export async function createIntroduction(input: {
  targetName: string;
  targetFirm?: string;
  viaName?: string;
  route?: string;
  notes?: string;
  investorId?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const targetName = clean(input.targetName, 200);
    if (!targetName) return { ok: false, error: "Who is being introduced?" };
    const route = INTRO_ROUTES.includes(input.route as (typeof INTRO_ROUTES)[number])
      ? (input.route as string)
      : "warm";

    const sp = getServiceClient();
    const { error } = await sp.from("introductions").insert({
      user_id: user.id,
      target_name: targetName,
      target_firm: clean(input.targetFirm),
      via_name: clean(input.viaName),
      route,
      notes: clean(input.notes),
      investor_id: clean(input.investorId, 60),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/introductions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setIntroductionStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!INTRO_STATUSES.includes(status as (typeof INTRO_STATUSES)[number])) {
      return { ok: false, error: "Unknown introduction status." };
    }
    const sp = getServiceClient();
    const { error } = await sp
      .from("introductions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/introductions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteIntroduction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const sp = getServiceClient();
    const { error } = await sp
      .from("introductions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/introductions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ── Opportunities ────────────────────────────────────────────────────────────

export async function createOpportunity(input: {
  title: string;
  org?: string;
  kind?: string;
  deadline?: string;
  url?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "An opportunity needs a title." };
    const kind = OPP_KINDS.includes(input.kind as (typeof OPP_KINDS)[number])
      ? (input.kind as string)
      : "grant";

    const sp = getServiceClient();
    const { error } = await sp.from("opportunities").insert({
      user_id: user.id,
      title,
      org: clean(input.org),
      kind,
      deadline: clean(input.deadline, 10),
      url: clean(input.url),
      notes: clean(input.notes),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/opportunities");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setOpportunityStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!OPP_STATUSES.includes(status as (typeof OPP_STATUSES)[number])) {
      return { ok: false, error: "Unknown opportunity status." };
    }
    const sp = getServiceClient();
    const { error } = await sp
      .from("opportunities")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/opportunities");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const sp = getServiceClient();
    const { error } = await sp
      .from("opportunities")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/opportunities");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
