import HeroBanner from "@/components/Landing/HeroBanner";
import ProblemStatement from "@/components/Landing/ProblemStatement";
import HowItWorks from "@/components/Landing/HowItWorks";
import KeyFeatures from "@/components/Landing/KeyFeatures";
import Metrics from "@/components/Landing/Metrics";
import TargetUsers from "@/components/Landing/TargetUsers";
import Faq from "@/components/Landing/Faq";
import CtaSection from "@/components/Landing/CtaSection";

export default function Home() {
  return (
    <>
      {/* Spacer for fixed navbar */}
      <div className="h-[69px] md:h-[89px] lg:h-[114px]"></div>

      <HeroBanner />

      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <ProblemStatement />
      </div>

      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <Metrics />
      </div>

      <div id="features" className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <KeyFeatures />
      </div>

      <div id="how-it-works">
        <HowItWorks />
      </div>

      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <TargetUsers />
      </div>

      <Faq />

      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <CtaSection />
      </div>
    </>
  );
}
