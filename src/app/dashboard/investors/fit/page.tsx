import { redirect } from "next/navigation";

// The fit page became Matches. Every existing link and bookmark keeps working
// through a permanent redirect rather than a 404.
export default function LegacyFitRedirect() {
  redirect("/dashboard/investors/matches");
}
