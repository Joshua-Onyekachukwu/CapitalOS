"use client";

import React from "react";
import Link from "next/link";

const HeroBanner: React.FC = () => {
  return (
    <>
      <div className="dark:bg-[#0a0e19] relative z-[1] pt-[155px] md:pt-[200px] lg:pt-[230px] xl:pt-[250px] pb-[70px] md:pb-[80px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="text-center mx-auto lg:max-w-[850px]">
            <div className="inline-block mb-[12px] md:mb-[15px]">
              <span className="flex items-center gap-[10px] rounded-[30px] bg-white dark:bg-gray-900 border border-primary-100 dark:border-gray-800 py-[3.5px] px-[14px]">
                <i className="ri-sparkling-2-fill text-primary-500 text-[18px]"></i>
                AI-Powered Fundraising
              </span>
            </div>

            <h1 className="!font-medium !text-4xl md:!text-[50px] lg:!text-[60px] md:-tracking-[3px] !leading-[1.2] !mb-[10px] md:!mb-[15px] lg:!mb-[20px]">
              Your AI{" "}
              <span className="text-primary-500">Fundraising</span>{" "}
              Department
            </h1>

            <p className="md:text-[15px] lg:text-md max-w-[600px] mx-auto">
              Find the right investors, understand why they are relevant, reach
              out intelligently, and manage the entire fundraising process — all
              from one place.
            </p>

            <div className="mt-[25px] md:mt-[35px] lg:mt-[50px]">
              <Link
                href="/signup"
                className="inline-block font-medium md:text-base rounded-[7px] bg-primary-500 text-white py-[11.5px] md:py-[13.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 mx-[8px]"
              >
                Start Fundraising
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-block font-medium md:text-base rounded-[7px] text-primary-500 border border-primary-500 py-[10.5px] md:py-[12.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 hover:border-primary-600 hover:text-white mx-[8px]"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-[30px] md:mt-[50px] lg:mt-[65px] xl:mt-[85px] flex flex-wrap items-center justify-center gap-[20px] md:gap-[40px] text-gray-400 dark:text-gray-600">
            <span className="flex items-center gap-[8px] text-[13px] md:text-[14px]">
              <i className="ri-shield-check-fill text-success-500"></i>
              No credit card required
            </span>
            <span className="flex items-center gap-[8px] text-[13px] md:text-[14px]">
              <i className="ri-time-fill text-success-500"></i>
              Setup in under 10 minutes
            </span>
            <span className="flex items-center gap-[8px] text-[13px] md:text-[14px]">
              <i className="ri-lock-fill text-success-500"></i>
              Your data stays private
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroBanner;
