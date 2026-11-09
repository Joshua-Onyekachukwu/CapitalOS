import { getActivePlans } from "@/lib/billing/plans";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { CheckoutButton, PortalButton } from "@/components/Billing/PlanActions";

export const dynamic = "force-dynamic";

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; plan?: string }>;
}) {
  const params = await searchParams;

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = key.startsWith("sk_live_")
    ? "live"
    : key.startsWith("sk_test_")
      ? "test"
      : "unconfigured";

  let plans: Awaited<ReturnType<typeof getActivePlans>> = [];
  let loadError: string | null = null;
  try {
    plans = await getActivePlans();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load plans";
  }

  const paid = plans.filter((p) => p.monthlyPrice > 0);

  // The landing cards link here with ?plan=<slug>. Highlight that plan and put
  // it first, so "Start My Raise" ends on a screen with one obvious purchase.
  const selectedPlan = params.plan ? (paid.find((p) => p.slug === params.plan) ?? null) : null;
  const ordered = selectedPlan
    ? [selectedPlan, ...paid.filter((p) => p.slug !== selectedPlan.slug)]
    : paid;

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Plans, payment method and invoices. Checkout and the portal are hosted by Stripe — card details never touch this app."
      />

      {params.checkout === "success" && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <p className="text-[13px] text-green-700 dark:text-green-400 !mb-0">
            Checkout completed. Stripe confirms with the webhook, usually within a few seconds —
            reload if your plan still looks unchanged.
          </p>
        </div>
      )}
      {params.checkout === "cancelled" && (
        <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-[12px] p-[16px] mb-[20px]">
          <p className="text-[13px] text-gray-600 dark:text-gray-300 !mb-0">
            Checkout cancelled. Nothing was charged.
          </p>
        </div>
      )}

      {mode === "unconfigured" && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300 !mb-[4px]">
            Billing is not configured
          </p>
          <p className="text-[12px] text-amber-700 dark:text-amber-400 !mb-0">
            Checkout and the portal answer 503 until{" "}
            <span className="font-mono">STRIPE_SECRET_KEY</span> and{" "}
            <span className="font-mono">STRIPE_WEBHOOK_SECRET</span> are set. No payment can be
            started or charged in this state.
          </p>
        </div>
      )}

      {mode === "test" && (
        <div className="bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-800/30 rounded-[12px] p-[16px] mb-[20px] flex items-center gap-[8px]">
          <Badge variant="info">Test mode</Badge>
          <span className="text-[12px] text-gray-600 dark:text-gray-300">
            Live keys are not in use. Stripe test cards only — no real money moves.
          </span>
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <p className="text-[13px] text-red-700 dark:text-red-400 !mb-0">
            Could not load plans: {loadError}
          </p>
        </div>
      )}

      {selectedPlan && (
        <Card className="mb-[20px] ring-2 ring-lime-400 dark:ring-lime-600">
          <CardBody>
            <div className="flex flex-wrap items-start justify-between gap-[16px]">
              <div>
                <Badge variant="info">Selected plan</Badge>
                <h3 className="text-[20px] font-semibold text-[#06201b] dark:text-white !mt-[8px] !mb-[2px]">
                  {selectedPlan.name}
                </h3>
                <p className="text-[14px] text-gray-600 dark:text-gray-300 !mb-[4px]">
                  {money(selectedPlan.monthlyPrice)}
                  {selectedPlan.billingModel === "one_time"
                    ? `, paid once for a ${selectedPlan.windowMonths ?? 3}-month window`
                    : " per month, cancel any time in the portal"}
                </p>
                <p className="text-[12px] text-gray-400 !mb-0">
                  {mode === "unconfigured"
                    ? "Checkout is not configured yet, so nothing can be charged. The button below reports exactly what is missing."
                    : "Card details are entered on Stripe. Nothing is charged here."}
                </p>
              </div>
              <CheckoutButton
                planSlug={selectedPlan.slug}
                interval="month"
                label={`Continue — ${money(selectedPlan.monthlyPrice)}`}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {params.plan && !selectedPlan && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <p className="text-[13px] text-amber-800 dark:text-amber-300 !mb-0">
            No active plan matches &quot;{params.plan}&quot;. Pick one below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[20px]">
        {ordered.map((plan) => (
          <Card
            key={plan.id}
            className={
              plan.slug === selectedPlan?.slug ? "ring-2 ring-lime-400 dark:ring-lime-600" : ""
            }
          >
            <CardBody>
              <div className="flex items-start justify-between mb-[8px]">
                <div>
                  <h3 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                    {plan.name}
                  </h3>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 !mb-0">
                    {plan.billingModel === "one_time"
                      ? `${money(plan.monthlyPrice)} one-time · ${plan.windowMonths ?? 3}-month window`
                      : `${money(plan.monthlyPrice)} / month`}
                  </p>
                </div>
                <Badge variant="default">{plan.includedCredits.toLocaleString()} credits</Badge>
              </div>
              <ul className="text-[13px] text-gray-600 dark:text-gray-300 space-y-[4px] mb-[16px]">
                <li>{plan.investorDbLimit.toLocaleString()} investor records</li>
                <li>{plan.deepResearchLimit.toLocaleString()} deep research runs</li>
                <li>{plan.emailAccountsLimit} connected email accounts</li>
                {plan.teamSeats > 0 && <li>{plan.teamSeats} team seats</li>}
              </ul>
              <CheckoutButton planSlug={plan.slug} interval="month" label={`Choose ${plan.name}`} />
            </CardBody>
          </Card>
        ))}
      </div>

      {paid.length === 0 && !loadError && (
        <Card>
          <CardBody>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 !mb-0">
              No paid plans are active in the database, so there is nothing to check out.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
            Already subscribed?
          </h3>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-[12px]">
            Change your card, download invoices or cancel in the Stripe portal. A cancellation keeps
            access until the end of the paid period.
          </p>
          <PortalButton />
        </CardBody>
      </Card>
    </div>
  );
}
