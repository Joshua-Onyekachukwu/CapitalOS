import { redirect } from "next/navigation";

export default function EmailHealthRedirect() {
  redirect("/dashboard/deliverability");
}
