"use client";

import React from "react";
import Link from "next/link";
import PricingIcon from "./PricingIcon";

const plans = [
  {
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
    bgColor: "bg-[#06201b]",
    textColor: "text-white",
    iconColor: "text-lime-500",
    linkColor: "text-lime-500",
    image: "/images/real-estate-agent/building2.png",
  },
  {
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
    bgColor: "bg-[#D15616]",
    textColor: "text-white",
    iconColor: "text-black",
    linkColor: "text-black",
    image: "/images/real-estate-agent/building.png",
  },
];

const Pricing: React.FC = () => {
  return (
    <div className="pb-[60px] md:pb-[80px] lg:pb-[100px] xl:pb-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] md:gap-[24px] items-start">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              data-pricing-card={index === 0 ? "starter" : "professional"}
              className={`${plan.bgColor} rounded-[16px] p-[20px] md:p-[24px] lg:p-[30px] xl:px-[40px] xl:py-[50px]`}
            >
              <div className="flex items-start justify-between gap-[16px] mb-[12px] md:mb-[14px] lg:mb-[16px]">
                <span
                  className={`block uppercase text-xs md:text-sm tracking-[1.95px] font-bold ${
                    index === 0 ? "text-[#D15616]" : "text-black"
                  }`}
                >
                  {plan.name}
                </span>
                <div className="shrink-0" data-pricing-icon-slot>
                  <PricingIcon
                    plan={index === 0 ? "starter" : "professional"}
                  />
                </div>
              </div>

              <div className="leading-none text-white font-black text-[34px] md:text-5xl lg:text-[46px] -tracking-[0.14px] md:-tracking-[0.18px] lg:-tracking-[0.22px]">
                {plan.price}{" "}
                <span
                  className={`text-sm md:text-base -tracking-[0.14px] font-medium ${
                    index === 0 ? "text-[#9E948E]" : "text-white/70"
                  }`}
                >
                  {plan.suffix}
                </span>
              </div>

              <ul
                className={`${
                  index === 0 ? "text-[#E3E3E3]" : "text-white/80"
                } my-[20px] md:my-[25px] xl:my-[30px] text-base md:text-[16px] -tracking-[0.16px]`}
              >
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="relative mb-[10px] last:mb-0 ltr:pl-[26px] rtl:pr-[26px]"
                  >
                    <i
                      className={`ri-checkbox-circle-fill absolute top-1/2 -translate-y-1/2 ltr:left-0 rtl:right-0 text-lg ${
                        index === 0 ? "text-[#FFCB33]" : "text-black"
                      }`}
                    ></i>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`inline-block relative font-medium text-base md:text-[16px] -tracking-[0.16px] transition-all hover:underline md:-mt-[5px] ${
                  index === 0 ? "text-[#FFC813]" : "text-black"
                }`}
              >
                {plan.cta} <i className="ri-arrow-right-long-line"></i>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-[24px] text-center">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
            Choose Your Engagement
          </span>
          <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            Fundraising Lifecycle Pricing
          </h2>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
