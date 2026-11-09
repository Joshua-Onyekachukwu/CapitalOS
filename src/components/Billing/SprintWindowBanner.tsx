import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { SprintStatus } from "@/lib/billing/plans";
import { CheckoutButton } from "./PlanActions";

/**
 * The post-close handoff from docs/07: when a Sprint window runs out, the
 * founder is still emailing their new investors. Offer the $29/month Retention
 * tier instead of dropping them onto an expired plan. Renders nothing while a
 * sprint is comfortably running.
 */
export function SprintWindowBanner({ sprint }: { sprint: SprintStatus | null }) {
  if (!sprint) return null;
  if (!sprint.ended && !sprint.endingSoon) return null;

  const days = sprint.daysRemaining ?? 0;

  return (
    <Card className="mb-[20px] border-lime-300 dark:border-lime-800">
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-[16px]">
          <div className="max-w-[620px]">
            <Badge variant={sprint.ended ? "warning" : "info"}>
              {sprint.ended ? "Sprint ended" : `${days} day${days === 1 ? "" : "s"} left`}
            </Badge>
            <h3 className="text-[17px] font-semibold text-[#06201b] dark:text-white !mt-[8px] !mb-[4px]">
              {sprint.ended
                ? `Your ${sprint.planName} has ended — keep your investors warm`
                : `Your ${sprint.planName} ends soon`}
            </h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-300 !mb-0">
              The round may be closing, but your backers still expect updates. Retention drafts your
              monthly update, tracks who read it, and keeps the data room ready for the next round —
              $29/month, cancellable in the portal.
            </p>
          </div>
          <div className="flex flex-col items-start gap-[8px]">
            <CheckoutButton planSlug="retention" interval="month" label="Add Retention — $29/mo" />
            <Link
              href="/dashboard/billing?plan=retention"
              className="text-[12px] text-gray-500 hover:text-lime-600 dark:text-gray-400"
            >
              Compare plans →
            </Link>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
