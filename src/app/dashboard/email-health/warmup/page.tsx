import { redirect } from "next/navigation";

export default function EmailHealthWarmupRedirect() {
  redirect("/dashboard/deliverability/warmup");
}
