"use server";

import { createClient } from "@/lib/supabase/server";

export interface ChangeLogEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  source_type: string | null;
  source_provider: string | null;
  confidence: number | null;
  change_type: string;
  detected_by: string | null;
  created_at: string;
}

export async function getInvestorChangeLog(
  investorId: string,
  limit = 50
): Promise<ChangeLogEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("data_change_log")
    .select("*")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching change log:", error);
    return [];
  }

  return data || [];
}

export async function getDataHealth() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_data_health")
    .select("*")
    .single();

  if (error) {
    console.error("Error fetching data health:", error);
    return null;
  }

  return data;
}

export async function getPendingDuplicateCount(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("duplicate_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return count || 0;
}
