import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import PrintButton from "@/components/Dashboard/PrintButton";

export const dynamic = "force-dynamic";

function pretty(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Freports");

  const sp = getServiceClient();

  const [
    pipelineRes,
    sentRes,
    openedRes,
    repliedRes,
    meetingsRes,
    upcomingRes,
    savedRes,
    tasksRes,
    campaignsRes,
    sequencesRes,
  ] = await Promise.all([
    sp
      .from("user_pipeline_entries")
      .select("stage, expected_amount, probability, updated_at")
      .eq("user_id", user.id)
      .limit(1000),
    sp.from("email_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("sent_at", "is", null),
    sp.from("email_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("opened_at", "is", null),
    sp.from("email_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("replied_at", "is", null),
    sp.from("meetings").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sp
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("scheduled_at", new Date().toISOString()),
    sp.from("saved_investors").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sp.from("crm_tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "open"),
    sp
      .from("campaigns")
      .select("id, name, status, total_investors, emails_sent, response_rate, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    sp
      .from("campaign_sequences")
      .select("id, name, status, total_steps, total_enrolled, total_completed, total_replies")
      .eq("user_id", user.id)
      .limit(20),
  ]);

  const pipeline = pipelineRes.data ?? [];
  const byStage = new Map<string, { count: number; amount: number }>();
  for (const entry of pipeline) {
    const stage = (entry.stage as string) || "unspecified";
    const current = byStage.get(stage) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(entry.expected_amount ?? 0);
    byStage.set(stage, current);
  }
  const stages = Array.from(byStage.entries())
    .map(([stage, data]) => ({ stage, ...data }))
    .sort((a, b) => b.count - a.count);

  const sent = sentRes.count ?? 0;
  const opened = openedRes.count ?? 0;
  const replied = repliedRes.count ?? 0;
  const campaigns = campaignsRes.data ?? [];
  const sequences = sequencesRes.data ?? [];

  const funnel = [
    { label: "Emails sent", value: sent },
    { label: "Opened", value: opened },
    { label: "Replied", value: replied },
    { label: "Meetings", value: meetingsRes.count ?? 0 },
  ];
  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="What has actually happened in your raise, measured from your own records."
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Investors in pipeline", value: pipeline.length, icon: "ri-kanban-view" },
          { label: "Saved investors", value: savedRes.count ?? 0, icon: "ri-bookmark-line" },
          { label: "Emails sent", value: sent, icon: "ri-send-plane-line" },
          { label: "Open tasks", value: tasksRes.count ?? 0, icon: "ri-checkbox-circle-line" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        <Card>
          <CardBody>
            <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
              Outreach funnel
            </h3>
            <p className="text-[12px] text-gray-400 !mb-[16px]">
              {sent === 0
                ? "Nothing has been sent yet, so every conversion rate below is unmeasurable rather than zero."
                : "Counts are from your sent mail only."}
            </p>
            <div className="space-y-[10px]">
              {funnel.map((step) => {
                const pct = Math.round((step.value / maxFunnel) * 100);
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-[4px]">
                      <span className="text-[13px] text-gray-500">{step.label}</span>
                      <span className="text-[13px] font-semibold text-[#06201b] dark:text-white">
                        {step.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-[8px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-lime-500 rounded-full"
                        style={{ width: `${Math.max(pct, step.value > 0 ? 3 : 0)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[8px] mt-[16px] flex-wrap">
              <a
                href="/api/dashboard/reports/export?type=pipeline"
                className="inline-flex items-center gap-[6px] rounded-[6px] border border-gray-200 px-[10px] py-[6px] text-[12px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                <i className="ri-download-line"></i>
                Pipeline CSV
              </a>
              <a
                href="/api/dashboard/reports/export?type=outreach"
                className="inline-flex items-center gap-[6px] rounded-[6px] border border-gray-200 px-[10px] py-[6px] text-[12px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                <i className="ri-download-line"></i>
                Outreach CSV
              </a>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
              Pipeline by stage
            </h3>
            <p className="text-[12px] text-gray-400 !mb-[12px]">
              {stages.length === 0
                ? "No investors in the pipeline yet."
                : "Expected amount is summed only where you entered one."}
            </p>
            {stages.length > 0 && (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="pb-[6px] font-medium">Stage</th>
                    <th className="pb-[6px] font-medium text-right">Investors</th>
                    <th className="pb-[6px] font-medium text-right">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((row) => (
                    <tr key={row.stage} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-[6px] text-gray-600 dark:text-gray-300">{pretty(row.stage)}</td>
                      <td className="py-[6px] text-right font-medium text-[#06201b] dark:text-white">
                        {row.count}
                      </td>
                      <td className="py-[6px] text-right text-gray-500">
                        {row.amount > 0 ? `$${row.amount.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[12px] text-gray-400 mt-[12px] !mb-0">
              {upcomingRes.count ?? 0} upcoming meeting
              {(upcomingRes.count ?? 0) === 1 ? "" : "s"} · {meetingsRes.count ?? 0} logged in total
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-[20px]">
        <CardBody>
          <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[12px]">
            Campaigns
          </h3>
          {campaigns.length === 0 ? (
            <p className="text-[13px] text-gray-500 !mb-0">
              No campaigns yet.{" "}
              <Link href="/dashboard/campaigns" className="text-lime-600 hover:underline">
                Create one
              </Link>{" "}
              to start measuring response.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="pb-[8px] font-medium">Campaign</th>
                    <th className="pb-[8px] font-medium text-right">Investors</th>
                    <th className="pb-[8px] font-medium text-right">Sent</th>
                    <th className="pb-[8px] font-medium text-right">Response</th>
                    <th className="pb-[8px] font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr
                      key={campaign.id as string}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-[8px] text-gray-700 dark:text-gray-200">
                        <Link
                          href={`/dashboard/campaigns/${campaign.id}`}
                          className="hover:text-lime-600"
                        >
                          {campaign.name as string}
                        </Link>
                      </td>
                      <td className="py-[8px] text-right text-gray-500">
                        {Number(campaign.total_investors ?? 0).toLocaleString()}
                      </td>
                      <td className="py-[8px] text-right text-gray-500">
                        {Number(campaign.emails_sent ?? 0).toLocaleString()}
                      </td>
                      <td className="py-[8px] text-right text-gray-500">
                        {Number(campaign.emails_sent ?? 0) > 0
                          ? `${Math.round(Number(campaign.response_rate ?? 0))}%`
                          : "—"}
                      </td>
                      <td className="py-[8px] text-right">
                        <Badge variant="default" size="sm">
                          {String(campaign.status ?? "draft")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[12px]">
            Sequences
          </h3>
          {sequences.length === 0 ? (
            <p className="text-[13px] text-gray-500 !mb-0">
              No sequences yet. Sequences are created against a campaign —{" "}
              <Link href="/dashboard/sequences" className="text-lime-600 hover:underline">
                open the sequences hub
              </Link>{" "}
              to see how they connect.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {sequences.map((sequence) => (
                <li key={sequence.id as string} className="flex items-center gap-[10px] py-[8px]">
                  <span className="flex-1 text-[13px] text-gray-700 dark:text-gray-200 truncate">
                    {sequence.name as string}
                  </span>
                  <span className="text-[12px] text-gray-400">
                    {Number(sequence.total_enrolled ?? 0)} enrolled ·{" "}
                    {Number(sequence.total_replies ?? 0)} replied
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
