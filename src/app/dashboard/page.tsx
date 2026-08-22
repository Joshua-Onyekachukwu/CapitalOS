import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { getDashboardStats, getRecentInvestors, getPipelineSummary } from "@/lib/actions/dashboard";
import { getOrCreateCompanyProfile } from "@/lib/actions/company";
import Link from "next/link";

export default async function DashboardPage() {
  const [stats, recentInvestors, pipeline, companyProfile] = await Promise.all([
    getDashboardStats(),
    getRecentInvestors(5),
    getPipelineSummary(),
    getOrCreateCompanyProfile(),
  ]);

  const stageColors: Record<string, string> = {
    not_ready: "bg-gray-400",
    needs_verification: "bg-amber-500",
    ready: "bg-lime-500",
    contacted: "bg-blue-500",
    do_not_contact: "bg-red-500",
  };

  const readinessScore = companyProfile?.readinessScore || 0;
  const onboardingCompleted = companyProfile?.onboardingCompleted || false;

  // Determine next steps based on what's missing
  const nextSteps: Array<{ label: string; href: string; icon: string }> = [];
  if (!companyProfile?.companyName) {
    nextSteps.push({ label: "Complete your company profile", href: "/onboarding", icon: "ri-building-line" });
  }
  if (!companyProfile?.hasPitchDeck) {
    nextSteps.push({ label: "Upload or create your pitch deck", href: "/dashboard/documents", icon: "ri-file-ppt-2-line" });
  }
  if (stats.totalInvestors === 0) {
    nextSteps.push({ label: "Discover your first investors", href: "/dashboard/investors/discover", icon: "ri-radar-line" });
  }
  if (stats.highFitInvestors === 0 && stats.totalInvestors > 0) {
    nextSteps.push({ label: "Run fit analysis on your investors", href: "/dashboard/investors", icon: "ri-star-line" });
  }
  if (nextSteps.length === 0) {
    nextSteps.push({ label: "Start an outreach campaign", href: "/dashboard/campaigns", icon: "ri-megaphone-line" });
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back${companyProfile?.companyName ? `, ${companyProfile.companyName}` : ""} 👋`}
        description="Here is an overview of your fundraising progress."
      />

      {/* Company Readiness — only show if onboarding completed */}
      {onboardingCompleted && readinessScore > 0 && (
        <Card className="mb-[20px]">
          <CardBody className="p-[20px]">
            <div className="flex items-center gap-[20px] flex-wrap">
              <div className="flex items-center gap-[14px] flex-1">
                <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center flex-none">
                  <span className="text-[18px] font-bold text-lime-700 dark:text-lime-400">{readinessScore}%</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                    Fundraising Readiness
                  </p>
                  <p className="text-[12px] text-gray-400 !mb-0">
                    {readinessScore >= 80
                      ? "Your profile is strong. Start discovering investors."
                      : readinessScore >= 50
                      ? "Good progress. Complete a few more fields to strengthen your profile."
                      : "Complete your company profile to improve investor matching."}
                  </p>
                </div>
              </div>
              <Link href="/onboarding">
                <Badge variant={readinessScore >= 80 ? "success" : "warning"}>
                  {readinessScore >= 80 ? "Profile Complete" : "Improve Profile"}
                </Badge>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Onboarding CTA — only show if not completed */}
      {!onboardingCompleted && (
        <Card className="mb-[20px]">
          <CardBody className="p-[20px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-lime-600 text-[22px] flex-none">
                <i className="ri-rocket-2-line"></i>
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                  Set up your fundraising workspace
                </p>
                <p className="text-[12px] text-gray-400 !mb-0">
                  Tell us about your company so we can match you with the right investors.
                </p>
              </div>
              <Link href="/onboarding">
                <span className="text-[13px] font-medium text-lime-600 hover:text-lime-700 whitespace-nowrap">
                  Get Started →
                </span>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Investors in Database", value: stats.totalInvestors.toLocaleString(), icon: "ri-database-2-line", color: "bg-lime-100 dark:bg-lime-900/20", iconColor: "text-lime-600" },
          { label: "Investor Firms", value: stats.totalFirms.toLocaleString(), icon: "ri-building-2-line", color: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
          { label: "High-Fit Investors", value: stats.highFitInvestors.toLocaleString(), icon: "ri-star-line", color: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600" },
          { label: "Added This Week", value: stats.investorsThisWeek.toLocaleString(), icon: "ri-add-circle-line", color: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[15px]">
              <div className={`w-[44px] h-[44px] rounded-[10px] ${stat.color} flex items-center justify-center ${stat.iconColor} text-[22px] flex-none`}>
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[12px] md:text-[13px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[20px] md:text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Quick Actions + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {/* Next Steps */}
        <Card>
          <CardBody>
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-[16px]">
              Next Steps
            </h3>
            <div className="space-y-[10px]">
              {nextSteps.map((step, i) => (
                <Link key={i} href={step.href}>
                  <div className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all cursor-pointer group">
                    <div className="w-[36px] h-[36px] rounded-[8px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[18px] flex-none">
                      <i className={step.icon}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">{step.label}</p>
                    </div>
                    <i className="ri-arrow-right-line text-gray-300 group-hover:text-lime-500 text-[16px]"></i>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Pipeline Summary */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-[16px]">
              <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
                Pipeline Overview
              </h3>
              <Link href="/dashboard/pipeline" className="text-[13px] text-lime-600 hover:text-lime-700 font-medium">
                View All →
              </Link>
            </div>
            {pipeline.length === 0 ? (
              <div className="text-center py-[30px]">
                <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
                  <i className="ri-kanban-view"></i>
                </div>
                <p className="text-[14px] text-gray-400 !mb-[4px]">No pipeline data yet</p>
                <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                  Discover investors to populate your pipeline.
                </p>
              </div>
            ) : (
              <div className="space-y-[10px]">
                {pipeline.map((stage) => (
                  <div key={stage.stage} className="flex items-center gap-[12px]">
                    <div className={`w-[8px] h-[8px] rounded-full flex-none ${stageColors[stage.stage] || "bg-gray-400"}`}></div>
                    <span className="text-[13px] text-gray-500 flex-1 capitalize">{stage.stage.replace(/_/g, " ")}</span>
                    <span className="text-[14px] font-bold text-[#06201b] dark:text-white">{stage.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Investors */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
              Recent Investors
            </h3>
            <Link href="/dashboard/investors" className="text-[13px] text-lime-600 hover:text-lime-700 font-medium">
              View All →
            </Link>
          </div>
          {recentInvestors.length === 0 ? (
            <div className="text-center py-[30px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
                <i className="ri-team-line"></i>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[4px]">No investors yet</p>
              <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                Run a data acquisition job or import investors via CSV.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Name</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Type</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Firm</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Fit</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvestors.map((investor) => (
                    <tr key={investor.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <td className="py-[12px]">
                        <Link href={`/dashboard/investors/${investor.id}`} className="text-[14px] font-medium text-[#06201b] dark:text-white hover:text-lime-600 transition-colors">
                          {investor.full_name}
                        </Link>
                      </td>
                      <td className="py-[12px]">
                        <span className="text-[13px] text-gray-500 capitalize">{investor.investor_type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="py-[12px]">
                        <span className="text-[13px] text-gray-500">{investor.firm_name || "—"}</span>
                      </td>
                      <td className="py-[12px]">
                        <span className={`text-[14px] font-bold ${investor.fit_score >= 80 ? "text-green-600" : investor.fit_score >= 60 ? "text-amber-600" : "text-gray-400"}`}>
                          {investor.fit_score}%
                        </span>
                      </td>
                      <td className="py-[12px]">
                        <Badge
                          variant={investor.outreach_readiness === "ready" ? "success" : investor.outreach_readiness === "contacted" ? "info" : "default"}
                          size="sm"
                        >
                          {investor.outreach_readiness.replace(/_/g, " ")}
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
    </div>
  );
}
