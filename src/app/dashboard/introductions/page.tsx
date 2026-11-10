import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import IntroductionsBoard, { type Introduction } from "@/components/Dashboard/IntroductionsBoard";

export const dynamic = "force-dynamic";

export default async function IntroductionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Fintroductions");

  const sp = getServiceClient();
  const [introsRes, pipelineRes] = await Promise.all([
    sp
      .from("introductions")
      .select("id, target_name, target_firm, via_name, route, status, notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    sp
      .from("user_pipeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const rows = introsRes.data ?? [];
  const introductions: Introduction[] = rows.map((row) => ({
    id: row.id as string,
    targetName: row.target_name as string,
    targetFirm: (row.target_firm as string | null) ?? null,
    viaName: (row.via_name as string | null) ?? null,
    route: (row.route as string) ?? "warm",
    status: (row.status as string) ?? "planned",
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  }));

  const made = introductions.filter((i) => i.status === "made" || i.status === "met").length;
  const requested = introductions.filter((i) => i.status === "requested").length;
  const declined = introductions.filter((i) => i.status === "declined").length;

  return (
    <div>
      <PageHeader
        title="Introductions"
        description="Warm paths into investors, who can open them, and where each one has got to."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Tracked", value: introductions.length, icon: "ri-links-line" },
          { label: "Requested", value: requested, icon: "ri-mail-question-line" },
          { label: "Made / met", value: made, icon: "ri-handshake-line" },
          { label: "In pipeline", value: pipelineRes.count ?? 0, icon: "ri-kanban-view" },
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

      <IntroductionsBoard introductions={introductions} />

      {declined > 0 && (
        <p className="text-[12px] text-gray-400 mt-[12px] !mb-0">
          {declined} declined. Kept on record so the same path is not tried twice.
        </p>
      )}
    </div>
  );
}
