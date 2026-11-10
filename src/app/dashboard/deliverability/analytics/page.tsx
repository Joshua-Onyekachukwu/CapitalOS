import DeliverabilityTabs from "@/components/Deliverability/DeliverabilityTabs";
import EmailHealthAnalytics from "@/components/Deliverability/EmailHealthAnalytics";

export default function DeliverabilityAnalyticsPage() {
  return (
    <div>
      <DeliverabilityTabs />
      <EmailHealthAnalytics />
    </div>
  );
}
