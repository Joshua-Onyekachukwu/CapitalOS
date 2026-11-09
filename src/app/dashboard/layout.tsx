import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/roles";
import { DashboardShell } from "@/components/Dashboard/DashboardShell";
import { SprintWindowBanner } from "@/components/Billing/SprintWindowBanner";
import { getSprintStatus } from "@/lib/billing/plans";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check admin role
  const roleInfo = await getUserRole(user.id, user.email || "");

  // Never let a billing read break the dashboard: the banner is an offer, not
  // a gate, so a failure just means no banner.
  let sprint = null;
  try {
    sprint = await getSprintStatus(user.id);
  } catch (err) {
    console.error("[dashboard] sprint status unavailable:", err);
  }

  return (
    <DashboardShell
      user={{
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email || "",
        avatar: user.user_metadata?.avatar_url ?? undefined,
        isAdmin: roleInfo.isAdmin,
      }}
    >
      <SprintWindowBanner sprint={sprint} />
      {children}
    </DashboardShell>
  );
}
