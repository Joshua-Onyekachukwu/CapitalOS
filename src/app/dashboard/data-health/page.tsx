import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/roles";
import AdminPage from "./page-client";

export default async function AdminPageWrapper() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roleInfo = await getUserRole(user.id, user.email || "");

  if (!roleInfo.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminPage />;
}
