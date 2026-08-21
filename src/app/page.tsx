import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import GoTop from "@/components/Layout/GoTop";
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
      <Navbar />
      {/* Spacer for fixed navbar */}
      <div className="h-[69px] md:h-[89px] lg:h-[114px]"></div>

      <HeroBanner />

      <div className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[100px] 2xl:py-[120px]">
        <ProblemStatement />
      </div>

      <div className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[100px] 2xl:py-[120px]">
        <Metrics />
      </div>

      <div id="features" className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[100px] 2xl:py-[120px]">
        <KeyFeatures />
      </div>

      <div id="how-it-works">
        <HowItWorks />
      </div>

      <div className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[100px] 2xl:py-[120px]">
        <TargetUsers />
      </div>

      <Faq />

      <div className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[100px] 2xl:py-[120px]">
        <CtaSection />
      </div>
      <Footer />
      <GoTop />
    </>
  );
}
