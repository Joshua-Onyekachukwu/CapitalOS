"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const plans = [
  {
    name: "STARTER",
    price: "$29",
    suffix: "/month",
    features: [
      "AI-powered investor discovery",
      "Up to 50 investor matches",
      "Basic outreach drafts",
      "Visual pipeline board",
    ],
    cta: "Get Started Now",
    bgColor: "bg-[#06201b]",
    textColor: "text-white",
    iconColor: "text-lime-500",
    linkColor: "text-lime-500",
    image: "/images/real-estate-agent/building2.png",
  },
  {
    name: "PROFESSIONAL",
    price: "$79",
    suffix: "/month",
    features: [
      "Unlimited investor discovery",
      "Advanced AI matching & scoring",
      "Personalized outreach at scale",
      "Full analytics & reporting",
    ],
    cta: "Get Started Now",
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[4px] md:gap-[8px] lg:gap-[25px]">
          <div className="ltr:xl:pr-[20px] rtl:xl:pl-[20px]">
            <div className="md:flex lg:block xl:flex items-center justify-between bg-[#06201b] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px] xl:px-[40px] xl:py-[50px] lg:sticky top-[100px]">
              <div>
                <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[12px] md:mb-[14px] lg:mb-[16px]">
                  {plans[0].name}
                </span>
                <div className="leading-none text-white font-black text-[34px] md:text-5xl lg:text-[46px] -tracking-[0.14px] md:-tracking-[0.18px] lg:-tracking-[0.22px]">
                  {plans[0].price}{" "}
                  <span className="text-sm md:text-base -tracking-[0.14px] font-medium text-[#9E948E]">
                    {plans[0].suffix}
                  </span>
                </div>
                <ul className="text-[#E3E3E3] my-[20px] md:my-[25px] xl:my-[30px] text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
                  {plans[0].features.map((feature, i) => (
                    <li
                      key={i}
                      className="relative mb-[10px] last:mb-0 ltr:pl-[26px] rtl:pr-[26px]"
                    >
                      <i className="ri-checkbox-circle-fill absolute top-1/2 -translate-y-1/2 ltr:left-0 rtl:right-0 text-[#FFCB33] text-lg"></i>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="inline-block relative font-medium text-[#FFC813] text-base md:text-[15px] lg:text-md -tracking-[0.16px] transition-all hover:underline md:-mt-[5px]"
                >
                  {plans[0].cta} <i className="ri-arrow-right-long-line"></i>
                </Link>
              </div>
              <div className="text-center flex-none mt-[20px] md:mt-0 lg:mt-[25px] xl:mt-0">
                <Image
                  src={plans[0].image}
                  className="inline-block"
                  alt="starter-plan"
                  width={120}
                  height={120}
                />
              </div>
            </div>
          </div>
          <div className="ltr:xl:pl-[20px] rtl:xl:pr-[20px]">
            <div className="mt-[30px] md:mt-[40px] lg:mt-0 mb-[30px] md:mb-[40px] lg:mb-[50px]">
              <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
                Pricing
              </span>
              <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
                Flexible{" "}
                <span className="font-semibold italic">Pricing Plans</span>{" "}
                Designed to Fit Every Founder
              </h2>
            </div>
            <div className="md:flex lg:block xl:flex items-center justify-between bg-[#D15616] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px] xl:px-[40px] xl:py-[50px]">
              <div>
                <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-black mb-[12px] md:mb-[14px] lg:mb-[16px]">
                  {plans[1].name}
                </span>
                <div className="leading-none text-white font-black text-[34px] md:text-5xl lg:text-[46px] -tracking-[0.14px] md:-tracking-[0.18px] lg:-tracking-[0.22px]">
                  {plans[1].price}{" "}
                  <span className="text-sm md:text-base -tracking-[0.14px] font-medium">
                    {plans[1].suffix}
                  </span>
                </div>
                <ul className="text-white/80 my-[20px] md:my-[25px] xl:my-[30px] text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
                  {plans[1].features.map((feature, i) => (
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
                  {plans[1].cta} <i className="ri-arrow-right-long-line"></i>
                </Link>
              </div>
              <div className="text-center flex-none mt-[20px] md:mt-0 lg:mt-[25px] xl:mt-0">
                <Image
                  src={plans[1].image}
                  className="inline-block"
                  alt="professional-plan"
                  width={120}
                  height={120}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
