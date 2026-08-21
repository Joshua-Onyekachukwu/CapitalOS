import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/user";
import { DashboardShell } from "@/components/Dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Middleware should catch this, but double-check
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      user={{
        name: user.full_name || user.email.split("@")[0],
        email: user.email,
        avatar: user.avatar_url ?? undefined,
      }}
    >
      {children}
    </DashboardShell>
  );
}
