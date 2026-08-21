import HeroBanner from "@/components/Landing/HeroBanner";
import ProblemStatement from "@/components/Landing/ProblemStatement";
import HowItWorks from "@/components/Landing/HowItWorks";
import KeyFeatures from "@/components/Landing/KeyFeatures";
import Metrics from "@/components/Landing/Metrics";
import TargetUsers from "@/components/Landing/TargetUsers";
import CtaSection from "@/components/Landing/CtaSection";

export default function Home() {
  return (
    <>
      <HeroBanner />

      <div id="problem">
        <ProblemStatement />
      </div>

      <div id="how-it-works">
        <HowItWorks />
      </div>

      <div id="features">
        <KeyFeatures />
      </div>

      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <Metrics />
      </div>

      <div id="who-its-for">
        <TargetUsers />
      </div>

      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <CtaSection />
      </div>
    </>
  );
}
