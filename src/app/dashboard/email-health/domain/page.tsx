import { redirect } from "next/navigation";

export default function EmailHealthDomainRedirect() {
  redirect("/dashboard/deliverability/domain");
}
