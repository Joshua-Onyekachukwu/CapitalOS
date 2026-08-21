"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const CtaSection: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="relative rounded-[20px] md:rounded-[30px] py-[50px] px-[20px] md:py-[70px] md:px-[50px] lg:py-[80px] lg:px-[80px] xl:py-[90px] xl:px-[100px] overflow-hidden">
          {/* Background Photo */}
          <div className="absolute inset-0">
            <Image
              src="/images/landing/pitch-deck.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-[#06201b]/90"></div>
          </div>

          {/* Content */}
          <div className="relative z-[1] md:max-w-[480px]">
            <h2 className="!text-[#ebebe0] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] md:-tracking-[1px] !mb-[12px] md:!mb-[15px]">
              Ready to <span className="text-lime-500">Fundraise</span>{" "}
              Smarter?
            </h2>

            <p className="md:text-[15px] lg:text-md text-[#ebebe0]/70">
              Join founders who are using AI to find the right investors,
              craft personalized outreach, and manage their entire
              fundraising process — all from one platform.
            </p>

            <div className="mt-[18px] md:mt-[22px] flex items-center gap-[10px] font-medium text-[#ebebe0]/80 text-[14px]">
              <span className="block rounded-full w-[18px] h-[18px] bg-lime-500 text-black flex items-center justify-center flex-none">
                <i className="ri-check-fill text-[12px]"></i>
              </span>
              No credit card required. Get started in minutes.
            </div>

            <Link
              href="/signup"
              className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 mt-[22px] md:mt-[35px]"
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
