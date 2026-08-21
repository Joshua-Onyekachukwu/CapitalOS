import dynamic from "next/dynamic";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import GoTop from "@/components/Layout/GoTop";
import HeroBanner from "@/components/Landing/HeroBanner";

// Below-fold sections — dynamically imported for code splitting
const About = dynamic(() => import("@/components/Landing/About"));
const Features = dynamic(() => import("@/components/Landing/Features"));
const WhyCapitalOS = dynamic(() => import("@/components/Landing/WhyCapitalOS"));
const WorkingProcess = dynamic(() => import("@/components/Landing/WorkingProcess"));
const Benefits = dynamic(() => import("@/components/Landing/Benefits"));
const Testimonials = dynamic(() => import("@/components/Landing/Testimonials"));
const Pricing = dynamic(() => import("@/components/Landing/Pricing"));
const FAQ = dynamic(() => import("@/components/Landing/FAQ"));

export default function Home() {
  return (
    <>
      <Navbar />
      {/* Spacer for fixed navbar */}
      <div className="h-[69px] md:h-[89px] lg:h-[114px]"></div>

      <HeroBanner />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <About />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <Features />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <WhyCapitalOS />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <WorkingProcess />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <Benefits />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <Testimonials />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <Pricing />

      <div className="h-[20px] md:h-[40px] lg:h-[60px]"></div>
      <FAQ />

      <Footer />
      <GoTop />
    </>
  );
}
