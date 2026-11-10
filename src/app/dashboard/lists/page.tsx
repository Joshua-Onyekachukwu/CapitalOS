import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import ListsBoard, { type InvestorListSummary } from "@/components/Dashboard/ListsBoard";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Flists");

  const sp = getServiceClient();
  const { data: listRows } = await sp
    .from("investor_lists")
    .select("id, name, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (listRows ?? []).map((row) => row.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: items } = await sp
      .from("investor_list_items")
      .select("list_id")
      .in("list_id", ids);
    for (const item of items ?? []) {
      const key = item.list_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const lists: InvestorListSummary[] = (listRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    itemCount: counts.get(row.id as string) ?? 0,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Lists"
        description="Curated investor groups — a thesis, a geography, a stage — worked as a batch."
      />
      <ListsBoard lists={lists} />
    </div>
  );
}
