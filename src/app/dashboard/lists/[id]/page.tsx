import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import ListMembers, { type ListMember } from "@/components/Dashboard/ListMembers";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=%2Fdashboard%2Flists%2F${id}`);

  const sp = getServiceClient();
  const { data: list } = await sp
    .from("investor_lists")
    .select("id, name, description, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!list) notFound();

  const { data: items } = await sp
    .from("investor_list_items")
    .select("id, investor_id, note, added_at")
    .eq("list_id", id)
    .order("added_at", { ascending: false });

  const investorIds = (items ?? []).map((item) => item.investor_id as string);
  const people = new Map<
    string,
    { full_name: string; email: string | null; job_title: string | null }
  >();
  if (investorIds.length > 0) {
    const { data: rows } = await sp
      .from("investors")
      .select("id, full_name, email, job_title")
      .in("id", investorIds);
    for (const row of rows ?? []) {
      people.set(row.id as string, {
        full_name: row.full_name as string,
        email: (row.email as string | null) ?? null,
        job_title: (row.job_title as string | null) ?? null,
      });
    }
  }

  const members: ListMember[] = (items ?? []).map((item) => {
    const person = people.get(item.investor_id as string);
    return {
      itemId: item.id as string,
      investorId: item.investor_id as string,
      name: person?.full_name ?? "Investor no longer in the database",
      firm: person?.job_title ?? null,
      email: person?.email ?? null,
      note: (item.note as string | null) ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title={list.name as string}
        description={
          (list.description as string | null) ??
          `${members.length} investor${members.length === 1 ? "" : "s"} in this list.`
        }
        actions={
          <Link
            href="/dashboard/lists"
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-gray-500 hover:text-[#06201b]"
          >
            <i className="ri-arrow-left-line"></i>
            All lists
          </Link>
        }
      />
      <ListMembers listId={id} members={members} />
    </div>
  );
}
