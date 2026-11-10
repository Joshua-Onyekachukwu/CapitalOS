import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function pretty(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(Math.round((count / max) * 100), 2) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-[4px]">
        <span className="text-[13px] text-gray-600 dark:text-gray-300 truncate pr-[8px]">
          {pretty(label)}
        </span>
        <span className="text-[12px] font-semibold text-[#06201b] dark:text-white flex-none">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-lime-500 rounded-full" style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

export default async function IntelligencePage() {
  const sp = getServiceClient();

  const [facetsRes, totalRes, emailRes, chequeRes, thesisRes, filingRes] = await Promise.all([
    sp.from("investor_facets").select("dimension, value, count").order("count", { ascending: false }).limit(400),
    sp.from("investors").select("id", { count: "exact", head: true }),
    sp
      .from("investors")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null)
      .neq("email", ""),
    sp.from("investors").select("id", { count: "exact", head: true }).not("min_check_size", "is", null),
    sp
      .from("investors")
      .select("id", { count: "exact", head: true })
      .not("investment_thesis", "is", null)
      .neq("investment_thesis", ""),
    sp
      .from("investors")
      .select("id", { count: "exact", head: true })
      .gte("edgar_last_filing_date", new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const facets = facetsRes.data ?? [];
  const dimensions = new Map<string, { value: string; count: number }[]>();
  for (const row of facets) {
    const dimension = String(row.dimension ?? "other");
    const list = dimensions.get(dimension) ?? [];
    list.push({ value: String(row.value ?? "unknown"), count: Number(row.count ?? 0) });
    dimensions.set(dimension, list);
  }

  const total = totalRes.count ?? 0;
  const withEmail = emailRes.count ?? 0;
  const withCheque = chequeRes.count ?? 0;
  const withThesis = thesisRes.count ?? 0;
  const recentFilings = filingRes.count ?? 0;

  const ordered = Array.from(dimensions.entries()).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Intelligence"
        description="What the investor corpus actually says — and what it cannot say yet, because no source is connected."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Firms on file", value: total, icon: "ri-building-2-line" },
          { label: "With an email", value: withEmail, icon: "ri-mail-line" },
          { label: "With cheque size", value: withCheque, icon: "ri-money-dollar-circle-line" },
          { label: "Filed in last 12m", value: recentFilings, icon: "ri-file-list-3-line" },
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

      {ordered.length === 0 ? (
        <Card className="mb-[20px]">
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-0">
              The facet rollup is empty. It is rebuilt by{" "}
              <code className="text-[12px]">refresh_investor_facets</code> after an import;
              until then this page shows coverage numbers only.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
          {ordered.map(([dimension, values]) => {
            const top = values.slice(0, 8);
            const max = Math.max(...top.map((v) => v.count), 1);
            return (
              <Card key={dimension}>
                <CardBody>
                  <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[12px]">
                    {pretty(dimension)}
                  </h3>
                  <div className="space-y-[10px]">
                    {top.map((entry) => (
                      <BarRow
                        key={`${dimension}-${entry.value}`}
                        label={entry.value}
                        count={entry.count}
                        max={max}
                      />
                    ))}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardBody>
          <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
            Not connected
          </h3>
          <p className="text-[13px] text-gray-500 !mb-[10px]">
            These streams need a named source before they can show anything real. Nothing below
            is estimated or simulated.
          </p>
          <ul className="space-y-[8px] text-[13px] text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-[8px]">
              <i className="ri-close-circle-line text-gray-300 mt-[2px]"></i>
              News and funding announcements — no news provider configured.
            </li>
            <li className="flex items-start gap-[8px]">
              <i className="ri-close-circle-line text-gray-300 mt-[2px]"></i>
              Portfolio company maps — {withThesis.toLocaleString()} firms have thesis text, but
              portfolio lists are not in the corpus.
            </li>
            <li className="flex items-start gap-[8px]">
              <i className="ri-close-circle-line text-gray-300 mt-[2px]"></i>
              Competitor funding rounds — requires an external funding database.
            </li>
            <li className="flex items-start gap-[8px]">
              <i className="ri-check-line text-lime-500 mt-[2px]"></i>
              Market intelligence from the corpus — the distributions above are live and
              measured.
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
