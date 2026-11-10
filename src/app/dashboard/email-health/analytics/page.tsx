import { redirect } from "next/navigation";

export default function EmailHealthAnalyticsRedirect() {
  redirect("/dashboard/deliverability/analytics");
}
