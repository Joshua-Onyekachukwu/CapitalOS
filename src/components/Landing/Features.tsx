"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const features = [
  {
    icon: "ri-radar-line",
    title: "Investor Intelligence Database",
    description:
      "57,000+ investors sourced from SEC filings, venture databases, and curated profiles. Filter by stage, sector, geography, check size, and investment activity.",
  },
  {
    icon: "ri-brain-line",
    title: "AI Fit Scoring",
    description:
      "Multi-factor scoring across 10+ dimensions — stage match, sector alignment, geography, check size, and investment recency. Every score comes with a clear explanation.",
  },
  {
    icon: "ri-mail-star-line",
    title: "AI-Drafted Outreach",
    description:
      "AI generates personalized emails that reference each investor's thesis, portfolio, and recent activity. You review, edit, and approve before anything is sent.",
  },
  {
    icon: "ri-dashboard-3-line",
    title: "Fundraising Pipeline",
    description:
      "Visual pipeline to track every investor from discovery through qualification, outreach, meetings, and close — all in one view.",
  },
];

const Features: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] relative z-[1]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="text-center mx-auto lg:max-w-[900px] mb-[30px] md:mb-[40px] lg:mb-[50px]">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#06201b] mb-[10px]">
            CAPABILITIES
          </span>
          <h2 className="!mb-0 !text-white !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            What Capital OS{" "}
            <span className="font-semibold italic">Actually Does</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px] xl:items-center">
          <div className="sm:order-1 xl:order-1">
            <div className="relative bg-white/10 rounded-[10px] p-[20px] md:p-[25px] lg:p-[30px] xl:py-[35px] mb-[25px] xl:mb-[100px] last:mb-0">
              <div className="absolute ltr:-right-[178px] rtl:-left-[178px] top-[115px] hidden xl:block">
                <Image
                  src="/images/real-estate-agent/icons/arrow-down-right.png"
                  alt="arrow"
                  width={178}
                  height={80}
                />
              </div>
              <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-lime-500 text-black text-xl mb-[22px] md:mb-[25px] lg:mb-[27px]">
                <i className={features[0].icon}></i>
              </div>
              <h3 className="!font-normal !text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[12px] md:!mb-[15px]">
                {features[0].title}
              </h3>
              <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] text-[#9E948E]">
                {features[0].description}
              </p>
            </div>
            <div className="relative bg-white/10 rounded-[10px] p-[20px] md:p-[25px] lg:p-[30px] xl:py-[35px] mb-[25px] xl:mb-[100px] last:mb-0">
              <div className="absolute ltr:-right-[182px] rtl:-left-[182px] top-[42px] hidden xl:block">
                <Image
                  src="/images/real-estate-agent/icons/arrow-up-right.png"
                  alt="arrow"
                  width={182}
                  height={80}
                />
              </div>
              <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-lime-500 text-black text-xl mb-[22px] md:mb-[25px] lg:mb-[27px]">
                <i className={features[1].icon}></i>
              </div>
              <h3 className="!font-normal !text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[12px] md:!mb-[15px]">
                {features[1].title}
              </h3>
              <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] text-[#9E948E]">
                {features[1].description}
              </p>
            </div>
          </div>
          <div className="text-center sm:col-span-2 xl:px-[25px] sm:order-3 xl:order-2">
            <Image
              src="/images/real-estate-agent/dashboard.jpg"
              className="inline-block rounded-[10px]"
              alt="dashboard-image"
              width={500}
              height={350}
            />
          </div>
          <div className="sm:order-2 xl:order-3">
            <div className="relative bg-white/10 rounded-[10px] p-[20px] md:p-[25px] lg:p-[30px] xl:py-[35px] mb-[25px] xl:mb-[100px] last:mb-0">
              <div className="absolute ltr:-left-[85px] rtl:-right-[85px] top-[100px] hidden xl:block">
                <Image
                  src="/images/real-estate-agent/icons/arrow-down-left.png"
                  alt="arrow"
                  width={85}
                  height={80}
                />
              </div>
              <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-lime-500 text-black text-xl mb-[22px] md:mb-[25px] lg:mb-[27px]">
                <i className={features[2].icon}></i>
              </div>
              <h3 className="!font-normal !text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[12px] md:!mb-[15px]">
                {features[2].title}
              </h3>
              <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] text-[#9E948E]">
                {features[2].description}
              </p>
            </div>
            <div className="relative bg-white/10 rounded-[10px] p-[20px] md:p-[25px] lg:p-[30px] xl:py-[35px] mb-[25px] xl:mb-[100px] last:mb-0">
              <div className="absolute ltr:-left-[75px] rtl:-right-[75px] top-[95px] hidden xl:block">
                <Image
                  src="/images/real-estate-agent/icons/arrow-up-left.png"
                  alt="arrow"
                  width={75}
                  height={80}
                />
              </div>
              <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-lime-500 text-black text-xl mb-[22px] md:mb-[25px] lg:mb-[27px]">
                <i className={features[3].icon}></i>
              </div>
              <h3 className="!font-normal !text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[12px] md:!mb-[15px]">
                {features[3].title}
              </h3>
              <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] text-[#9E948E]">
                {features[3].description}
              </p>
            </div>
          </div>
        </div>
        <div className="text-center mx-auto max-w-[500px] mt-[25px] xl:mt-[30px]">
          <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] text-[#9E948E]">
            Replace your stack of spreadsheets, PitchBook, and cold email tools
            with one platform.{" "}
            <Link
              href="/signup"
              className="text-lime-500 font-semibold transition-all hover:underline"
            >
              Start Free <i className="ri-arrow-right-long-line"></i>
            </Link>
          </p>
        </div>
      </div>
      <div className="absolute top-0 left-0 right-0 bottom-0 -z-[1] bg-[#06201b] lg:rounded-[30px] lg:mx-[10px] xl:mx-[20px]"></div>
    </div>
  );
};

export default Features;
