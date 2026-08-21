import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import GoTop from "@/components/Layout/GoTop";
import HeroBanner from "@/components/Landing/HeroBanner";
import About from "@/components/Landing/About";
import Features from "@/components/Landing/Features";
import WhyCapitalOS from "@/components/Landing/WhyCapitalOS";
import WorkingProcess from "@/components/Landing/WorkingProcess";
import Benefits from "@/components/Landing/Benefits";
import Testimonials from "@/components/Landing/Testimonials";
import Pricing from "@/components/Landing/Pricing";
import FAQ from "@/components/Landing/FAQ";

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
