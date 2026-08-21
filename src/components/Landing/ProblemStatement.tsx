"use client";

import React from "react";
import Link from "next/link";

const ProblemStatement: React.FC = () => {
  const features = [
    "AI-powered investor discovery and matching",
    "Personalized outreach based on investor intelligence",
    "Visual pipeline from discovery to close",
    "Automated reply classification and follow-ups",
  ];

  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px] items-center">
          <div className="md:max-w-[430px]">
            <span className="inline-block font-medium text-[#7a857d] rounded-[30px] border border-[#ebebe0] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
              About Capital OS
            </span>

            <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
              AI That Actually Understands Fundraising
            </h2>

            <p className="md:text-[15px] lg:text-md text-[#7a857d]">
              Capital OS is not just another investor database. It is an
              AI-powered fundraising operating system that researches,
              qualifies, prepares, and manages your outreach — while you
              stay in control.
            </p>

            <div className="my-[20px] md:my-[25px] lg:my-[35px] xl:my-[45px]">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="mb-[15px] md:mb-[20px] lg:mb-[25px] last:mb-0 flex items-center font-medium !text-[#06201B] dark:!text-white text-[14px] md:text-md lg:text-lg gap-[12px]"
                >
                  <span className="flex items-center justify-center w-[25px] md:w-[30px] h-[25px] md:h-[30px] rounded-full bg-[#00ba00] text-white text-[18px] md:text-[22px] flex-none">
                    <i className="ri-check-fill"></i>
                  </span>
                  {feature}
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="inline-block font-medium md:text-base rounded-[7px] bg-[#06201b] text-white py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-500 hover:text-black mt-[5px] md:mt-[10px] xl:mt-[15px]"
            >
              Start Fundraising
            </Link>
          </div>

          <div className="text-center">
            <div className="inline-block w-full max-w-[400px] rounded-[20px] md:rounded-[35px] bg-[#ebebe0] dark:bg-[#0a0e19] aspect-[4/3] flex items-center justify-center">
              <div className="text-center px-[20px]">
                <i className="ri-radar-line text-[#06201b]/20 dark:text-white/20 text-[60px] md:text-[80px] block mb-[15px]"></i>
                <span className="text-[#7a857d] text-[13px] md:text-[14px]">
                  Investor Discovery
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProblemStatement;
