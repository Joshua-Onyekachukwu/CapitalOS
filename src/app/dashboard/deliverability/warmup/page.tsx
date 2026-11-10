import DeliverabilityTabs from "@/components/Deliverability/DeliverabilityTabs";
import EmailHealthWarmup from "@/components/Deliverability/EmailHealthWarmup";

export default function DeliverabilityWarmupPage() {
  return (
    <div>
      <DeliverabilityTabs />
      <EmailHealthWarmup />
    </div>
  );
}
