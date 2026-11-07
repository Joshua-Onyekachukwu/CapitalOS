"use client";

import React from "react";
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
  },
];

const Pricing: React.FC = () => {
  const [starter, professional] = plans;

  return (
    <div className="pb-[60px] md:pb-[80px] lg:pb-[100px] xl:pb-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[4px] md:gap-[8px] lg:gap-[25px]">
          {/* Primary sprint: stays in view while the right column is read. */}
          <div className="ltr:xl:pr-[20px] rtl:xl:pl-[20px]">
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
                  href="/signup"
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
          <div className="ltr:xl:pl-[20px] rtl:xl:pr-[20px]">
            <div className="mt-[30px] md:mt-[40px] lg:mt-0 mb-[30px] md:mb-[40px] lg:mb-[50px]">
              <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
                Pricing
              </span>
              <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
                Flexible <span className="font-semibold italic">Pricing Plans</span>{" "}
                Designed to Fit Every Founder
              </h2>
            </div>
            <div
              data-pricing-card={professional.id}
              className="md:flex lg:block xl:flex items-center justify-between bg-[#D15616] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px] xl:px-[40px] xl:py-[50px]"
            >
              <div>
                <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-black mb-[12px] md:mb-[14px] lg:mb-[16px]">
                  {professional.name}
                </span>
                <div className="leading-none text-white font-black text-[34px] md:text-5xl lg:text-[46px] -tracking-[0.14px] md:-tracking-[0.18px] lg:-tracking-[0.22px]">
                  {professional.price}{" "}
                  <span className="text-sm md:text-base -tracking-[0.14px] font-medium">
                    {professional.suffix}
                  </span>
                </div>
                <ul className="text-white/80 my-[20px] md:my-[25px] xl:my-[30px] text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
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
                  href="/signup"
                  className="inline-block relative font-medium text-black text-base md:text-[15px] lg:text-md -tracking-[0.16px] transition-all hover:underline md:-mt-[5px]"
                >
                  {professional.cta} <i className="ri-arrow-right-long-line"></i>
                </Link>
              </div>
              <div
                className="text-center flex-none mt-[20px] md:mt-0 lg:mt-[25px] xl:mt-0"
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
