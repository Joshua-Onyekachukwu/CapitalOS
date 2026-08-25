import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/roles";
import { DashboardShell } from "@/components/Dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check admin role
  const roleInfo = await getUserRole(user.id, user.email || "");

  return (
    <DashboardShell
      user={{
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email || "",
        avatar: user.user_metadata?.avatar_url ?? undefined,
        isAdmin: roleInfo.isAdmin,
      }}
    >
      {children}
    </DashboardShell>
  );
}
