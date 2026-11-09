"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PricingIcon from "./PricingIcon";

// Two engagement tiers, priced as upfront sprints. The layout is the original
// editorial one: the primary card holds the left column while the heading and
// the Pro card sit beside it on the right. Both icons belong inside the card
// they describe.
const plans = [
  {
    id: "starter",
    name: "3-MONTH SPRINT",
    price: "$499",
    suffix: "paid upfront",
    features: [
      "Everything for an actively raising founder",
      "AI investor discovery, matching & fit scoring",
      "Personalized AI email drafts, reviewed before send",
      "7 branded templates with open/click tracking & CAN-SPAM",
      "Drip sequences with stop-on-reply & business-hours sending",
      "21-stage pipeline Kanban + email health dashboard",
      "Pitch deck generator (PPTX + PDF)",
      "AI Copilot that answers questions about your investors",
      "3-month window",
    ],
    cta: "Start My Raise",
    href: "/dashboard/billing?plan=sprint_3m",
  },
  {
    id: "professional",
    name: "6-MONTH PRO SPRINT",
    price: "$999",
    suffix: "paid upfront",
    features: [
      "Full Sprint for a longer or more complex raise",
      "Extended AI research and outreach capacity",
      "More sequences, more investor research, more time under management",
      "6-month window",
    ],
    cta: "Start My Raise",
    href: "/dashboard/billing?plan=sprint_6m",
  },
];

// The section rises into place once it is scrolled to. `idle` is the server
// render: the content is always visible without JavaScript, and only a section
// that is still below the fold is hidden and then animated.
type RevealPhase = "idle" | "hidden" | "shown";

const Pricing: React.FC = () => {
  const [starter, professional] = plans;
  const sectionRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<RevealPhase>("idle");

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Reduced motion (and environments without the observer): show it as is.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      setPhase("shown");
      return;
    }

    // Following a #pricing link lands on the section, so it is already visible.
    if (section.getBoundingClientRect().top < window.innerHeight * 0.85) {
      setPhase("shown");
      return;
    }

    setPhase("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Staggered entrance. The delay is dropped while hidden so nothing waits on
  // the way in, and reduced-motion users are shown the section immediately.
  const reveal = (delay: number) => ({
    className: `transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
      phase === "hidden" ? "opacity-0 translate-y-[28px]" : "opacity-100 translate-y-0"
    }`,
    style: { transitionDelay: phase === "shown" ? `${delay}ms` : "0ms" },
  });

  const starterReveal = reveal(0);
  const headingReveal = reveal(120);
  const proReveal = reveal(240);

  return (
    <div ref={sectionRef} className="pb-[60px] md:pb-[80px] lg:pb-[100px] xl:pb-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[4px] md:gap-[8px] lg:gap-[25px]">
          {/* Primary sprint: stays in view while the right column is read. */}
          <div
            {...starterReveal}
            className={`${starterReveal.className} ltr:xl:pr-[20px] rtl:xl:pl-[20px]`}
          >
            <div
              data-pricing-card={starter.id}
              className="md:flex lg:block xl:flex items-center justify-between bg-[#06201b] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px] xl:px-[40px] xl:py-[50px] lg:sticky top-[100px]"
            >
              <div>
                <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[12px] md:mb-[14px] lg:mb-[16px]">
                  {starter.name}
                </span>
                <div className="leading-none text-white font-black text-[34px] md:text-5xl lg:text-[46px] -tracking-[0.14px] md:-tracking-[0.18px] lg:-tracking-[0.22px]">
                  {starter.price}{" "}
                  <span className="text-sm md:text-base -tracking-[0.14px] font-medium text-[#9E948E]">
                    {starter.suffix}
                  </span>
                </div>
                <ul className="text-[#E3E3E3] my-[20px] md:my-[25px] xl:my-[30px] text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
                  {starter.features.map((feature, i) => (
                    <li
                      key={i}
                      className="relative mb-[10px] last:mb-0 ltr:pl-[26px] rtl:pr-[26px]"
                    >
                      <i className="ri-checkbox-circle-fill absolute top-1/2 -translate-y-1/2 ltr:left-0 rtl:right-0 text-lg text-[#FFCB33]"></i>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={starter.href}
                  className="inline-block relative font-medium text-[#FFC813] text-base md:text-[15px] lg:text-md -tracking-[0.16px] transition-all hover:underline md:-mt-[5px]"
                >
                  {starter.cta} <i className="ri-arrow-right-long-line"></i>
                </Link>
              </div>
              <div
                className="text-center flex-none mt-[20px] md:mt-0 lg:mt-[25px] xl:mt-0"
                data-pricing-icon-slot
              >
                <PricingIcon plan="starter" />
              </div>
            </div>
          </div>

          {/* Heading and the Pro card share the second column. */}
          <div className="flex flex-col ltr:xl:pl-[20px] rtl:xl:pr-[20px]">
            <div
              {...headingReveal}
              className={`${headingReveal.className} flex-none mt-[30px] md:mt-[40px] lg:mt-0 mb-[30px] md:mb-[40px] lg:mb-[50px]`}
            >
              <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
                Pricing
              </span>
              <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
                Flexible <span className="font-semibold italic">Pricing Plans</span> Designed to Fit
                Every Founder
              </h2>
            </div>
            <div
              data-pricing-card={professional.id}
              {...proReveal}
              className={`${proReveal.className} flex flex-1 flex-col md:flex-row lg:flex-col xl:flex-row items-stretch justify-between bg-[#D15616] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px] xl:px-[40px] xl:py-[50px]`}
            >
              {/* The column stretches so the Pro CTA rests on the card floor. */}
              <div className="flex flex-1 flex-col">
                <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-black mb-[12px] md:mb-[14px] lg:mb-[16px]">
                  {professional.name}
                </span>
                <div className="leading-none text-white font-black text-[34px] md:text-5xl lg:text-[46px] -tracking-[0.14px] md:-tracking-[0.18px] lg:-tracking-[0.22px]">
                  {professional.price}{" "}
                  <span className="text-sm md:text-base -tracking-[0.14px] font-medium">
                    {professional.suffix}
                  </span>
                </div>
                <ul className="text-white/80 mt-[20px] md:mt-[25px] xl:mt-[30px] mb-[20px] md:mb-[25px] xl:mb-[30px] text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
                  {professional.features.map((feature, i) => (
                    <li
                      key={i}
                      className="relative mb-[10px] last:mb-0 ltr:pl-[26px] rtl:pr-[26px]"
                    >
                      <i className="ri-checkbox-circle-fill absolute top-1/2 -translate-y-1/2 ltr:left-0 rtl:right-0 text-black text-lg"></i>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={professional.href}
                  className="mt-auto self-start inline-block relative font-medium text-black text-base md:text-[15px] lg:text-md -tracking-[0.16px] transition-all hover:underline"
                >
                  {professional.cta} <i className="ri-arrow-right-long-line"></i>
                </Link>
              </div>
              <div
                className="text-center flex-none self-center mt-[20px] md:mt-0 lg:mt-[25px] xl:mt-0"
                data-pricing-icon-slot
              >
                <PricingIcon plan="professional" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
