"use client";

import React from "react";
import Link from "next/link";

const CtaSection: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="bg-[#06201b] rounded-[20px] md:rounded-[35px] py-[70px] px-[20px] md:py-[90px] md:px-[50px] lg:py-[100px] lg:px-[80px] xl:py-[110px] xl:px-[110px] relative z-[1]">
          <div className="md:max-w-[415px]">
            <h2 className="!text-[#ebebe0] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] md:-tracking-[1px] !mb-[15px] md:!mb-[18px]">
              Ready to <span className="text-lime-500">Fundraise</span>{" "}
              Smarter?
            </h2>

            <p className="md:text-[15px] lg:text-md text-[#ebebe0]">
              Join founders who are using AI to find the right investors,
              craft personalized outreach, and manage their entire
              fundraising process — all from one platform.
            </p>

            <div className="mt-[20px] md:mt-[25px] flex items-center gap-[11px] font-medium text-[#ebebe0]">
              <span className="block rounded-full w-[18px] h-[18px] bg-lime-500 text-black flex items-center justify-center flex-none">
                <i className="ri-check-fill"></i>
              </span>
              No credit card required. Get started in minutes.
            </div>

            <Link
              href="/signup"
              className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 mt-[25px] md:mt-[45px]"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default CtaSection;
