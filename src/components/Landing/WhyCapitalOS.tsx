"use client";

import React from "react";
import Image from "next/image";

const whyItems = [
  {
    title: "AI-Powered Investor Intelligence",
    description:
      "Make data-driven decisions with AI that researches, classifies, and scores investors based on your specific startup profile.",
  },
  {
    title: "All-in-One Fundraising Platform",
    description:
      "Manage investor discovery, outreach, pipeline, and meetings — all from one powerful, intuitive dashboard.",
  },
  {
    title: "Personalized Outreach at Scale",
    description:
      "Keep every investor interaction organized with AI-drafted, thesis-aligned emails that you review and approve.",
  },
  {
    title: "Mobile-Ready, Always Accessible",
    description:
      "Whether you're at your desk or in a meeting, Capital OS travels with you — fully responsive and optimized for any device.",
  },
  {
    title: "Secure & Scalable",
    description:
      "Bank-level data security with Supabase RLS and a system that grows with your business, from solo founder to full team.",
  },
  {
    title: "Dedicated Support",
    description:
      "Our team is here when you need us — with onboarding assistance, live support, and real humans who care about your success.",
  },
];

const WhyCapitalOS: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
          {/* Text content — second on mobile, first on desktop */}
          <div className="order-2 lg:order-1 mt-[50px] lg:mt-0 ltr:xl:pr-[35px] rtl:xl:pl-[35px]">
            <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
              WHY CAPITAL OS
            </span>
            <h2 className="!mb-[15px] md:!mb-[20px] lg:!mb-[25px] !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
              Discover What Makes{" "}
              <span className="font-semibold italic">Capital OS</span> the
              Ultimate Fundraising Platform for{" "}
              <span className="font-semibold italic">Founders</span>
            </h2>
            <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
              Capital OS is not just another tool — we're your partner in
              fundraising. Designed with input from real founders, investors,
              and advisors.
            </p>
            <div className="mt-[25px] lg:mt-[40px] xl:max-w-[545px]">
              {whyItems.map((item, index) => (
                <div
                  key={index}
                  className="mb-[25px] md:mb-[30px] last:mb-0"
                >
                  <div className="mb-[12px] md:mb-[15px] flex items-center gap-[8px] md:gap-[12px]">
                    <div className="w-[45px] h-[36px] flex-none relative z-[1] flex items-center justify-end text-lime-500 text-xl">
                      <i className="ri-check-double-line rtl:-scale-x-100"></i>
                      <span className="block absolute top-0 ltr:left-0 rtl:right-0 bottom-0 w-[36px] bg-[#ECE3DE] dark:bg-[#06201b] -z-[1] rounded-full"></span>
                    </div>
                    <h3 className="!font-normal -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-0">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {/* Image — first on mobile, second on desktop */}
          <div className="order-1 lg:order-2 pt-[20px] lg:pt-0">
            <div className="text-center relative lg:sticky top-[100px] ltr:lg:pl-[50px] rtl:lg:pr-[50px] ltr:xl:pl-[80px] rtl:xl:pr-[80px]">
              <Image
                src="/images/real-estate-agent/why-trezo.jpg"
                className="inline-block rounded-[15px]"
                alt="why-capital-os"
                width={500}
                height={600}
              />
              <div className="absolute bottom-[60px] ltr:left-0 rtl:right-0 max-w-[80px] xl:max-w-[140px] hidden lg:block">
                <Image
                  src="/images/real-estate-agent/cube.png"
                  className="inline-block"
                  alt="cube"
                  width={140}
                  height={140}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhyCapitalOS;
