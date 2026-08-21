"use client";

import React from "react";
import Link from "next/link";

const ProblemStatement: React.FC = () => {
  const problems = [
    "Finding the right investors takes weeks of manual research",
    "Cold outreach without context gets ignored",
    "Spreadsheets can't track conversations across hundreds of investors",
    "No intelligence on who is actively investing right now",
  ];

  const solutions = [
    "AI-powered investor discovery and matching",
    "Personalized outreach based on investor intelligence",
    "Visual pipeline from discovery to close",
    "Automated reply classification and follow-ups",
  ];

  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="mb-[40px] md:mb-[50px] lg:mb-[60px] text-center mx-auto md:max-w-[600px]">
          <span className="inline-block font-medium text-[#64748b] rounded-[30px] border border-[#f1f5f9] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
            About Capital OS
          </span>
          <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
            Fundraising Is Broken. We Fix It.
          </h2>
          <p className="md:text-[15px] lg:text-md text-[#64748b]">
            Founders spend weeks on manual research, generic outreach, and spreadsheet tracking.
            Capital OS replaces that with an intelligent system that does the work while you stay in control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[25px] md:gap-[30px]">
          {/* The Problem */}
          <div className="rounded-[15px] md:rounded-[20px] bg-[#f1f5f9] dark:bg-[#0f1629] p-[25px] md:p-[30px]">
            <div className="flex items-center gap-[10px] mb-[20px]">
              <div className="w-[36px] h-[36px] rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500 text-[18px]">
                <i className="ri-close-circle-line"></i>
              </div>
              <h3 className="!font-semibold !text-[16px] md:!text-lg !text-[#06201B] dark:!text-white !mb-0">
                Without Capital OS
              </h3>
            </div>
            <div className="space-y-[14px]">
              {problems.map((problem, index) => (
                <div key={index} className="flex items-start gap-[10px]">
                  <i className="ri-close-line text-red-400 text-[16px] mt-[2px] flex-none"></i>
                  <span className="text-[#64748b] text-[14px] md:text-[15px]">{problem}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The Solution */}
          <div className="rounded-[15px] md:rounded-[20px] bg-[#f1f5f9] dark:bg-[#0f1629] p-[25px] md:p-[30px]">
            <div className="flex items-center gap-[10px] mb-[20px]">
              <div className="w-[36px] h-[36px] rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 text-[18px]">
                <i className="ri-check-double-line"></i>
              </div>
              <h3 className="!font-semibold !text-[16px] md:!text-lg !text-[#06201B] dark:!text-white !mb-0">
                With Capital OS
              </h3>
            </div>
            <div className="space-y-[14px]">
              {solutions.map((solution, index) => (
                <div key={index} className="flex items-start gap-[10px]">
                  <i className="ri-check-line text-primary-600 text-[16px] mt-[2px] flex-none"></i>
                  <span className="text-[#64748b] text-[14px] md:text-[15px]">{solution}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-[30px] md:mt-[40px]">
          <Link
            href="/signup"
            className="inline-block font-medium md:text-base rounded-[7px] bg-[#0f172a] text-white py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-500 hover:text-black"
          >
            Start Fundraising
          </Link>
        </div>
      </div>
    </>
  );
};

export default ProblemStatement;
