import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import UpdateComposer, {
  type SavedUpdate,
  type UpdateMetrics,
} from "@/components/Dashboard/UpdateComposer";

export const dynamic = "force-dynamic";

const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export default async function InvestorRelationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Fir");

  const sp = getServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    profileRes,
    entriesRes,
    updatesRes,
    sharesRes,
    sentRes,
    openedRes,
    repliedRes,
    receiptsRes,
  ] = await Promise.all([
    sp
      .from("company_profiles")
      .select("company_name, mrr, customer_count, funding_amount")
      .eq("user_id", user.id)
      .maybeSingle(),
    sp.from("user_pipeline_entries").select("stage, expected_amount").eq("user_id", user.id),
    sp
      .from("investor_updates")
      .select("id, period_label, subject, body, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    sp
      .from("data_room_shares")
      .select("id, label, expires_at, revoked_at, access_count, last_accessed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    sp
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("sent_at", "is", null),
    sp
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("opened_at", "is", null),
    sp
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("direction", "inbound"),
    sp
      .from("email_messages")
      .select("id, subject, to_address, sent_at, opened_at, replied_at, status")
      .eq("user_id", user.id)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(10),
  ]);

  const profile = profileRes.data;
  const entries = entriesRes.data ?? [];

  // "Committed" means a stage where the cheque is promised, not merely hoped
  // for. expected_amount stays null when unset, and null is not zero.
  const committed = entries
    .filter((e) => ["committed", "closed_won", "term_sheet"].includes(e.stage as string))
    .reduce((sum, e) => sum + (num(e.expected_amount) ?? 0), 0);

  const committedCount = entries.filter((e) =>
    ["committed", "closed_won", "term_sheet"].includes(e.stage as string)
  ).length;

  const metrics: UpdateMetrics = {
    companyName: (profile?.company_name as string | null) ?? null,
    mrr: num(profile?.mrr),
    customers: num(profile?.customer_count),
    raiseTarget: num(profile?.funding_amount),
    raisedSoFar: committed > 0 ? committed : null,
    pipelineInvestors: entries.length,
    monthName: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };

  const updates: SavedUpdate[] = (updatesRes.data ?? []).map((u) => ({
    id: u.id as string,
    periodLabel: u.period_label as string,
    subject: u.subject as string,
    body: u.body as string,
    status: u.status as string,
    createdAt: u.created_at as string,
  }));

  const shares = sharesRes.data ?? [];

  // Access log rows are keyed by share, so they are counted against this
  // user's shares rather than by a user column the log does not have.
  const shareIds = shares.map((s) => s.id as string);
  const accessRes = shareIds.length
    ? await sp
        .from("data_room_access_log")
        .select("id", { count: "exact", head: true })
        .in("share_id", shareIds)
        .gte("accessed_at", since)
    : { count: 0 };

  const now = Date.now();
  const activeShares = shares.filter(
    (s) => !s.revoked_at && new Date(s.expires_at as string).getTime() > now
  ).length;

  const tiles = [
    {
      label: "Emails sent",
      value: sentRes.count ?? 0,
      icon: "ri-mail-send-line",
      note: "Sending is not connected yet",
    },
    {
      label: "Opened",
      value: openedRes.count ?? 0,
      icon: "ri-mail-open-line",
      note: "Tracked opens across all sends",
    },
    {
      label: "Replies",
      value: repliedRes.count ?? 0,
      icon: "ri-reply-line",
      note: "Inbound messages recorded",
    },
    {
      label: "Data-room opens (30d)",
      value: accessRes.count ?? 0,
      icon: "ri-file-shield-2-line",
      note: `${activeShares} active share${activeShares === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Investor relations"
        description="Post-raise reporting: write a monthly update from your own numbers, review read receipts, and see how long data-room access lasts."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardBody className="flex items-center gap-[12px] p-[16px]">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 text-lime-600 flex items-center justify-center flex-none">
                <i className={tile.icon}></i>
              </div>
              <div className="min-w-0">
                <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {tile.value.toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-400 !mb-0 truncate">{tile.label}</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600 !mb-0 truncate">
                  {tile.note}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mb-[20px]">
        <UpdateComposer metrics={metrics} updates={updates} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
        <Card>
          <CardBody>
            <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
              Read receipts
            </h3>
            <p className="text-[12px] text-gray-400 !mb-[12px]">
              Opens and replies recorded against your sends. No mailbox is connected, so this list
              stays empty until sending is enabled — an absence of data, not an absence of interest.
            </p>
            {(receiptsRes.data ?? []).length === 0 ? (
              <p className="text-[13px] text-gray-500 !mb-0">
                No emails have been sent yet, so there are no receipts to show.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {["Recipient", "Subject", "Sent", "Opened", "Replied"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-[8px] py-[8px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(receiptsRes.data ?? []).map((row) => (
                      <tr
                        key={row.id as string}
                        className="border-b border-gray-50 dark:border-gray-800/50"
                      >
                        <td className="px-[8px] py-[8px] text-[12px] text-gray-600 dark:text-gray-300 truncate">
                          {(row.to_address as string) || "—"}
                        </td>
                        <td className="px-[8px] py-[8px] text-[12px] text-gray-600 dark:text-gray-300 truncate max-w-[180px]">
                          {(row.subject as string) || "(no subject)"}
                        </td>
                        <td className="px-[8px] py-[8px] text-[11px] text-gray-400">
                          {row.sent_at ? new Date(row.sent_at as string).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-[8px] py-[8px] text-[11px]">
                          {row.opened_at ? (
                            <Badge variant="success" size="sm">
                              Opened
                            </Badge>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-[8px] py-[8px] text-[11px]">
                          {row.replied_at ? (
                            <Badge variant="success" size="sm">
                              Replied
                            </Badge>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
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
            <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
              Data-room retention
            </h3>
            <p className="text-[12px] text-gray-400 !mb-[12px]">
              Every share link, whether it is still live, and how often it was opened. Access is
              retained for the window you set, then stops working.
            </p>
            {shares.length === 0 ? (
              <p className="text-[13px] text-gray-500 !mb-0">
                No data-room links exist yet. Create one from Documents, and its lifetime and access
                count appear here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {["Share", "Status", "Expires", "Opens", "Last access"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-[8px] py-[8px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shares.map((share) => {
                      const expired = new Date(share.expires_at as string).getTime() <= now;
                      const revoked = Boolean(share.revoked_at);
                      const daysLeft = Math.ceil(
                        (new Date(share.expires_at as string).getTime() - now) / 86_400_000
                      );
                      return (
                        <tr
                          key={share.id as string}
                          className="border-b border-gray-50 dark:border-gray-800/50"
                        >
                          <td className="px-[8px] py-[8px] text-[12px] text-gray-600 dark:text-gray-300">
                            {(share.label as string) || "Untitled share"}
                          </td>
                          <td className="px-[8px] py-[8px] text-[11px]">
                            {revoked ? (
                              <Badge variant="danger" size="sm">
                                Revoked
                              </Badge>
                            ) : expired ? (
                              <Badge variant="default" size="sm">
                                Expired
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                Live
                              </Badge>
                            )}
                          </td>
                          <td className="px-[8px] py-[8px] text-[11px] text-gray-400">
                            {revoked || expired
                              ? new Date(share.expires_at as string).toLocaleDateString()
                              : `${daysLeft}d left`}
                          </td>
                          <td className="px-[8px] py-[8px] text-[12px] text-gray-600 dark:text-gray-300">
                            {(share.access_count as number | null) ?? 0}
                          </td>
                          <td className="px-[8px] py-[8px] text-[11px] text-gray-400">
                            {share.last_accessed_at
                              ? new Date(share.last_accessed_at as string).toLocaleDateString()
                              : "Never"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-gray-300 dark:text-gray-600 !mb-0 mt-[10px]">
              {committedCount} investor{committedCount === 1 ? "" : "s"} at term sheet or beyond,
              worth{" "}
              {committed > 0
                ? `$${committed.toLocaleString()}`
                : "nothing recorded — expected cheques are unset"}
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
