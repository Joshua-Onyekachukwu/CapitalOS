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

      <About />

      <Features />

      <WhyCapitalOS />

      <WorkingProcess />

      <Benefits />

      <Testimonials />

      <Pricing />

      <FAQ />

      <Footer />
      <GoTop />
    </>
  );
}
