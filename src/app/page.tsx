import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import GoTop from "@/components/Layout/GoTop";
import HeroBanner from "@/components/Landing/HeroBanner";
import WhoItsFor from "@/components/Landing/WhoItsFor";
import Features from "@/components/Landing/Features";
import FunFacts from "@/components/Landing/FunFacts";
import AboutUs from "@/components/Landing/AboutUs";
import Platform from "@/components/Landing/Platform";
import Feedbacks from "@/components/Landing/Feedbacks";
import Faqs from "@/components/Landing/Faqs";
import CtaSection from "@/components/Landing/CtaSection";

export default function Home() {
  return (
    <>
      <Navbar />

      <HeroBanner />

      <WhoItsFor />

      <div id="features">
        <Features />
      </div>

      <FunFacts />

      <AboutUs />

      <Platform />

      <Feedbacks />

      <Faqs />

      <CtaSection />

      <Footer />
      <GoTop />
    </>
  );
}
