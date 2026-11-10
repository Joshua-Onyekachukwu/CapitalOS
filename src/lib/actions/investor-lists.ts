"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";

export interface ListActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ListActionResult {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("[investor-lists]", message);
  return { ok: false, error: message };
}

function clean(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

async function assertOwnedList(listId: string, userId: string) {
  const sp = getServiceClient();
  const { data, error } = await sp
    .from("investor_lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("List not found.");
  return sp;
}

export async function createInvestorList(input: {
  name: string;
  description?: string;
}): Promise<ListActionResult> {
  try {
    const user = await requireUser();
    const name = clean(input.name, 120);
    if (!name) return { ok: false, error: "A list needs a name." };

    const sp = getServiceClient();
    const { data, error } = await sp
      .from("investor_lists")
      .insert({ user_id: user.id, name, description: clean(input.description) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/lists");
    return { ok: true, id: data?.id as string | undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteInvestorList(listId: string): Promise<ListActionResult> {
  try {
    const user = await requireUser();
    const sp = await assertOwnedList(listId, user.id);

    // Items first: investor_list_items has no cascade guarantee on every
    // environment, and an orphaned item would count against a deleted list.
    await sp.from("investor_list_items").delete().eq("list_id", listId);
    const { error } = await sp
      .from("investor_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/lists");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addInvestorToList(input: {
  listId: string;
  investorId: string;
  note?: string;
}): Promise<ListActionResult> {
  try {
    const user = await requireUser();
    const investorId = clean(input.investorId, 60);
    if (!investorId) return { ok: false, error: "Choose an investor first." };
    const sp = await assertOwnedList(input.listId, user.id);

    const { error } = await sp.from("investor_list_items").insert({
      list_id: input.listId,
      investor_id: investorId,
      note: clean(input.note),
    });
    // 23505 = already in the list; that is a benign no-op, not a failure.
    if (error && error.code !== "23505") throw new Error(error.message);

    revalidatePath(`/dashboard/lists/${input.listId}`);
    revalidatePath("/dashboard/lists");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeInvestorFromList(itemId: string): Promise<ListActionResult> {
  try {
    const user = await requireUser();
    const sp = getServiceClient();

    const { data: item, error: itemError } = await sp
      .from("investor_list_items")
      .select("id, list_id")
      .eq("id", itemId)
      .maybeSingle();
    if (itemError) throw new Error(itemError.message);
    if (!item?.list_id) return { ok: false, error: "List item not found." };

    await assertOwnedList(item.list_id as string, user.id);
    const { error } = await sp.from("investor_list_items").delete().eq("id", itemId);
    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/lists/${item.list_id}`);
    revalidatePath("/dashboard/lists");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
