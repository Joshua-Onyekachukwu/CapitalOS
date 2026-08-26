"use client";

import React from "react";

const stats = [
  {
    value: "57,000+",
    label: "Investors in Database",
    description: "Sourced from SEC filings, venture firms, and curated profiles",
  },
  {
    value: "10+",
    label: "Scoring Dimensions",
    description: "Stage, sector, geography, check size, recency, and more",
  },
  {
    value: "3-Step",
    label: "Outreach Process",
    description: "Discover → Draft → Send, with AI at every step",
  },
  {
    value: "100%",
    label: "Human Approval",
    description: "Every AI-generated email requires your review before sending",
  },
];

const Testimonials: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="text-center mx-auto lg:max-w-[800px] mb-[30px] md:mb-[40px] lg:mb-[50px]">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
            By The Numbers
          </span>
          <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            Real Data.{" "}
            <span className="font-semibold italic">Real Investors.</span>{" "}
            Real Platform.
          </h2>
          <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] mt-[15px] text-gray-500 dark:text-gray-400">
            We don&apos;t make claims we can&apos;t back up. Here&apos;s what
            Capital OS actually contains.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] md:gap-[25px]">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-[#E9DFDA] dark:bg-[#06201b] rounded-[12px] p-[24px] md:p-[30px] text-center"
            >
              <p className="text-[32px] md:text-[38px] font-bold text-[#06201b] dark:text-white !mb-[4px]">
                {stat.value}
              </p>
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
                {stat.label}
              </p>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 !mb-0">
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-[30px] md:mt-[40px] bg-[#06201b] rounded-[16px] p-[30px] md:p-[40px] text-center">
          <p className="text-[18px] md:text-[22px] text-white !mb-[8px]">
            &ldquo;We built Capital OS because founders shouldn&apos;t need a
            $20K PitchBook subscription and a team of analysts to find the right
            investors.&rdquo;
          </p>
          <p className="text-[14px] text-gray-400 !mb-0">
            — The Capital OS Team
          </p>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
