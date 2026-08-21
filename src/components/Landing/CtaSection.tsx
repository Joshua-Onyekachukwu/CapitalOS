"use client";

import React from "react";
import Link from "next/link";

const CtaSection: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="dark:bg-[#0a0e19] rounded-[15px] md:rounded-[30px] relative z-[1] pt-[50px] px-[20px] md:px-[40px] ltr:xl:pl-[110px] rtl:xl:pr-[110px] pb-[50px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
            <div className="md:max-w-[485px] xl:pt-[20px] lg:-mt-[10px] xl:mt-0">
              <h2 className="!font-medium md:-tracking-[1px] !text-2xl md:!text-3xl lg:!text-4xl xl:!text-5xl !leading-[1.2] !mb-[12px] md:!mb-[15px] xl:!mb-[20px]">
                Ready to Fundraise Smarter?
              </h2>

              <p className="md:text-[15px] lg:text-md">
                Join founders who are using AI to find the right investors,
                craft personalized outreach, and manage their entire
                fundraising process — all from one platform.
              </p>

              <span className="mt-[17px] md:mt-[20px] xl:mt-[25px] flex items-center font-medium text-gray-900 dark:text-white gap-[10px]">
                <i className="ri-check-fill flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#00ba00] text-white flex-none"></i>
                No credit card required. Get started in minutes.
              </span>

              <Link
                href="/signup"
                className="inline-block font-medium md:text-base rounded-[7px] bg-primary-500 text-white py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 mt-[20px] md:mt-[25px] xl:mt-[45px]"
              >
                Get Started Free
              </Link>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="grid grid-cols-2 gap-[15px] max-w-[350px]">
                <div className="p-[20px] bg-white dark:bg-dark rounded-[15px] border border-gray-200 dark:border-gray-800 text-center">
                  <i className="ri-radar-line text-primary-500 text-[28px] mb-[8px] block"></i>
                  <span className="block text-[13px] md:text-[14px] font-medium">
                    Smart Discovery
                  </span>
                </div>
                <div className="p-[20px] bg-white dark:bg-dark rounded-[15px] border border-gray-200 dark:border-gray-800 text-center">
                  <i className="ri-brain-line text-primary-500 text-[28px] mb-[8px] block"></i>
                  <span className="block text-[13px] md:text-[14px] font-medium">
                    AI Matching
                  </span>
                </div>
                <div className="p-[20px] bg-white dark:bg-dark rounded-[15px] border border-gray-200 dark:border-gray-800 text-center">
                  <i className="ri-mail-star-line text-primary-500 text-[28px] mb-[8px] block"></i>
                  <span className="block text-[13px] md:text-[14px] font-medium">
                    Personal Outreach
                  </span>
                </div>
                <div className="p-[20px] bg-white dark:bg-dark rounded-[15px] border border-gray-200 dark:border-gray-800 text-center">
                  <i className="ri-dashboard-3-line text-primary-500 text-[28px] mb-[8px] block"></i>
                  <span className="block text-[13px] md:text-[14px] font-medium">
                    Full Pipeline
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="absolute top-0 left-0 right-0 bottom-0 rounded-[15px] md:rounded-[30px] -z-[1] bg-center bg-no-repeat bg-cover dark:hidden"
            style={{
              backgroundImage: "url(/images/landing/cta-bg.jpg)",
            }}
          ></div>
        </div>
      </div>
    </>
  );
};

export default CtaSection;
