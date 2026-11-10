import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import OpportunitiesBoard, { type Opportunity } from "@/components/Dashboard/OpportunitiesBoard";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Fopportunities");

  const sp = getServiceClient();
  const { data } = await sp
    .from("opportunities")
    .select("id, title, org, kind, deadline, url, notes, status")
    .eq("user_id", user.id)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(200);

  const opportunities: Opportunity[] = (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    org: (row.org as string | null) ?? null,
    kind: (row.kind as string) ?? "grant",
    deadline: (row.deadline as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: (row.status as string) ?? "watching",
  }));

  const watching = opportunities.filter((o) => o.status === "watching").length;
  const applied = opportunities.filter((o) => o.status === "applied").length;
  const won = opportunities.filter((o) => o.status === "won").length;

  return (
    <div>
      <PageHeader
        title="Opportunities"
        description="Grants, accelerators, demo days and challenges with the deadlines that matter."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Watching", value: watching, icon: "ri-eye-line" },
          { label: "Applied", value: applied, icon: "ri-send-plane-line" },
          { label: "Won", value: won, icon: "ri-trophy-line" },
          { label: "Total tracked", value: opportunities.length, icon: "ri-list-check" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[12px] p-[16px]">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 text-lime-600 flex items-center justify-center flex-none">
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <OpportunitiesBoard opportunities={opportunities} />
    </div>
  );
}
