import DeliverabilityTabs from "@/components/Deliverability/DeliverabilityTabs";
import EmailHealthOverview from "@/components/Deliverability/EmailHealthOverview";

export default function DeliverabilityPage() {
  return (
    <div>
      <DeliverabilityTabs />
      <EmailHealthOverview />
    </div>
  );
}
