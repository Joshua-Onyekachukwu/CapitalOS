"use client";

import React from "react";
import Image from "next/image";

const whyItems = [
  {
    title: "Real Investor Data, Not Just Names",
    description:
      "57,000+ investors sourced from SEC 13F filings, Form D, venture databases, and curated profiles. Each record includes investment history, check sizes, sectors, and portfolio companies.",
  },
  {
    title: "AI That Scores, Not Just Searches",
    description:
      "Multi-factor scoring across 10+ dimensions — stage match, sector alignment, geography, check size, investment recency, and more. Every score comes with a clear explanation of why.",
  },
  {
    title: "Outreach That Actually Gets Replies",
    description:
      "AI drafts emails that reference each investor's thesis, portfolio, and recent activity. Not generic templates — personalized messages that show you've done your homework.",
  },
  {
    title: "One Platform, Not Five Tools",
    description:
      "Replace PitchBook for research, Google Sheets for tracking, Apollo.io for outreach, and HubSpot for pipeline. Everything in one place, built specifically for fundraising.",
  },
  {
    title: "You Stay in Control",
    description:
      "Every AI-generated action requires your review and approval. The AI does the research and writing — you make the decisions. Nothing goes out without your say-so.",
  },
  {
    title: "Built for Founders, Not Enterprises",
    description:
      "Designed for the founder who's raising their first round or their fifth. Simple enough to start in minutes, powerful enough to manage complex multi-round fundraising.",
  },
];

const WhyCapitalOS: React.FC = () => {
  return (
    <div className="pt-[60px] pb-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
          {/* Text content — second on mobile, first on desktop */}
          <div className="order-2 lg:order-1 mt-[85px] lg:mt-0 ltr:xl:pr-[35px] rtl:xl:pl-[35px]">
            <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
              WHY CAPITAL OS
            </span>
            <h2 className="!mb-[15px] md:!mb-[20px] lg:!mb-[25px] !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
              What Capital OS Does{" "}
              <span className="font-semibold italic">That Spreadsheets</span>{" "}
              Can&apos;t
            </h2>
            <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
              Most founders use 3-5 different tools to raise capital. Capital OS
              replaces them all with one platform built specifically for
              fundraising.
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
          <div className="order-1 lg:order-2 pt-[0px] pb-[12px] lg:pt-0 lg:pb-0">
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
