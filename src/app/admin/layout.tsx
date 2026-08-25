import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/roles";
import AdminLayoutClient from "./layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roleInfo = await getUserRole(user.id, user.email || "");

  if (!roleInfo.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
