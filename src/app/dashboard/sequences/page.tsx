import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Fsequences");

  const sp = getServiceClient();
  const [sequencesRes, stepsRes, enrollmentsRes] = await Promise.all([
    sp
      .from("campaign_sequences")
      .select(
        "id, campaign_id, name, description, status, total_steps, total_enrolled, total_completed, total_replies, stop_on_reply, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    sp
      .from("campaign_sequence_steps")
      .select("id, sequence_id, step_number, step_type, subject_template, delay_days, is_active")
      .order("step_number", { ascending: true })
      .limit(500),
    sp
      .from("campaign_sequence_enrollments")
      .select("id, sequence_id, status")
      .eq("user_id", user.id)
      .limit(2000),
  ]);

  const sequences = sequencesRes.data ?? [];
  const sequenceIds = new Set(sequences.map((s) => s.id as string));
  const steps = (stepsRes.data ?? []).filter((s) => sequenceIds.has(s.sequence_id as string));
  const enrollments = (enrollmentsRes.data ?? []).filter((e) =>
    sequenceIds.has(e.sequence_id as string)
  );

  const stepsBySequence = new Map<string, typeof steps>();
  for (const step of steps) {
    const key = step.sequence_id as string;
    stepsBySequence.set(key, [...(stepsBySequence.get(key) ?? []), step]);
  }

  const activeBySequence = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (enrollment.status !== "active") continue;
    const key = enrollment.sequence_id as string;
    activeBySequence.set(key, (activeBySequence.get(key) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Sequences"
        description="Multi-step follow-up cadences attached to a campaign. Each step waits, sends, and stops on reply."
        actions={
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center gap-[6px] rounded-[6px] border border-gray-200 px-[12px] py-[7px] text-[13px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            <i className="ri-megaphone-line"></i>
            Campaigns
          </Link>
        }
      />

      {sequences.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-[8px]">
              No sequences yet. A sequence belongs to a campaign, so create the campaign first
              and add the follow-up steps from its detail page.
            </p>
            <Link href="/dashboard/campaigns/new" className="text-[13px] font-medium text-lime-600 hover:underline">
              Create a campaign
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[14px]">
          {sequences.map((sequence) => {
            const ownSteps = stepsBySequence.get(sequence.id as string) ?? [];
            const active = activeBySequence.get(sequence.id as string) ?? 0;
            return (
              <Card key={sequence.id as string}>
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-[12px]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[8px] flex-wrap">
                        <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0">
                          {sequence.name as string}
                        </h3>
                        <Badge
                          variant={
                            sequence.status === "active"
                              ? "success"
                              : sequence.status === "paused"
                              ? "warning"
                              : "default"
                          }
                          size="sm"
                        >
                          {String(sequence.status ?? "draft")}
                        </Badge>
                        {sequence.stop_on_reply ? (
                          <Badge variant="info" size="sm">
                            stops on reply
                          </Badge>
                        ) : null}
                      </div>
                      {sequence.description && (
                        <p className="text-[12px] text-gray-500 !mb-0 mt-[4px]">
                          {sequence.description as string}
                        </p>
                      )}
                      <p className="text-[12px] text-gray-400 !mb-0 mt-[4px]">
                        {ownSteps.length} step{ownSteps.length === 1 ? "" : "s"} ·{" "}
                        {active} enrolled now · {Number(sequence.total_completed ?? 0)} completed ·{" "}
                        {Number(sequence.total_replies ?? 0)} replied
                      </p>
                      {ownSteps.length > 0 && (
                        <ol className="mt-[10px] space-y-[6px]">
                          {ownSteps.map((step) => (
                            <li key={step.id as string} className="flex items-start gap-[8px]">
                              <span className="w-[20px] h-[20px] rounded-full bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400 text-[11px] font-bold flex items-center justify-center flex-none mt-[1px]">
                                {step.step_number as number}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-gray-700 dark:text-gray-200 !mb-0 truncate">
                                  {(step.subject_template as string) || "(no subject)"}
                                </p>
                                <p className="text-[11px] text-gray-400 !mb-0">
                                  {String(step.step_type ?? "email")} · waits{" "}
                                  {Number(step.delay_days ?? 0)} day
                                  {Number(step.delay_days ?? 0) === 1 ? "" : "s"}
                                  {step.is_active === false ? " · inactive" : ""}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    {sequence.campaign_id && (
                      <Link
                        href={`/dashboard/campaigns/${sequence.campaign_id}`}
                        className="text-[12px] font-medium text-lime-600 hover:underline flex-none"
                      >
                        Open campaign
                      </Link>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-gray-400 mt-[14px] !mb-0">
        Sending is still gated on a connected mailbox — a sequence can be built and enrolled
        without one, but nothing leaves until an account is connected in{" "}
        <Link href="/dashboard/settings" className="text-lime-600 hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
