"use client";

import React from "react";
import Link from "next/link";

const CtaSection: React.FC = () => {
  return (
    <>
      <div className="relative z-[1]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="rounded-[15px] dark:bg-black relative z-[1] py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] px-[20px] md:px-[40px] lg:px-[60px] xl:px-[80px] text-center">
            <h2 className="!mb-[12px] md:!mb-[15px] !text-[26px] md:!text-3xl lg:!text-4xl">
              Ready To Transform Your Fundraising?
            </h2>

            <p className="text-black dark:text-white lg:text-[15px] xl:text-md">
              Join founders who are using AI to find the right investors,
              craft personalized outreach, and manage their entire
              fundraising process — all from one platform.
            </p>

            <Link
              href="/signup"
              className="inline-block text-center bg-orange-500 border border-orange-500 rounded-[50px] text-white font-medium md:text-[15px] lg:text-md xl:text-[17px] py-[8.5px] px-[19px] transition-all hover:bg-primary-500 hover:border-primary-500 mt-[5px] md:mt-[10px] lg:mt-[25px]"
            >
              <span className="inline-block relative ltr:pr-[27px] rtl:pl-[27px]">
                Start Free 14-Day Trial{" "}
                <i className="ri-arrow-right-long-line text-[20px] absolute top-1/2 -translate-y-1/2 ltr:-right-[2px] rtl:-left-[2px]"></i>
              </span>
            </Link>

            <ul className="mt-[15px] md:mt-[20px] lg:mt-[25px] lg:text-[15px] xl:text-md">
              <li className="mx-[10px] md:mx-[15px] ltr:first:ml-0 rtl:first:mr-0 ltr:last:mr-0 rtl:last:ml-0 inline-block relative ltr:pl-[15px] rtl:pr-[15px]">
                <span className="w-[6px] h-[6px] ltr:left-0 rtl:right-0 rounded-full bg-primary-500 absolute top-1/2 -translate-y-1/2"></span>
                No credit card required
              </li>

              <li className="mx-[10px] md:mx-[15px] ltr:first:ml-0 rtl:first:mr-0 ltr:last:mr-0 rtl:last:ml-0 inline-block relative ltr:pl-[15px] rtl:pr-[15px]">
                <span className="w-[6px] h-[6px] ltr:left-0 rtl:right-0 rounded-full bg-primary-500 absolute top-1/2 -translate-y-1/2"></span>
                Get set up in 5 minutes
              </li>

              <li className="mx-[10px] md:mx-[15px] ltr:first:ml-0 rtl:first:mr-0 ltr:last:mr-0 rtl:last:ml-0 inline-block relative ltr:pl-[15px] rtl:pr-[15px]">
                <span className="w-[6px] h-[6px] ltr:left-0 rtl:right-0 rounded-full bg-primary-500 absolute top-1/2 -translate-y-1/2"></span>
                Cancel anytime
              </li>
            </ul>

            <div
              className="absolute top-0 left-0 right-0 bottom-0 -z-[1] rounded-[15px] dark:hidden"
              style={{
                background:
                  "radial-gradient(49.42% 65.08% at 50% 100%, #FFF 0%, #BCD5CE 100%)",
              }}
            ></div>
          </div>
        </div>

        <div className="absolute bottom-0 h-[50%] left-0 right-0 -z-[1] bg-[#0D1427]"></div>
      </div>
    </>
  );
};

export default CtaSection;
