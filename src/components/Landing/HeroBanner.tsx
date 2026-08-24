"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const HeroBanner: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="relative bg-[#06201b] rounded-[20px] md:rounded-[30px] overflow-hidden min-h-[560px] md:min-h-[620px] lg:min-h-[660px] xl:min-h-[700px]">
          {/* Left: Copy — vertically centered with more top padding */}
          <div className="relative z-10 pt-[60px] pb-[40px] px-[20px] md:pt-[70px] md:px-[40px] lg:pt-[80px] lg:px-[50px] xl:pt-[90px] xl:px-[80px] lg:absolute lg:inset-y-0 lg:left-0 lg:w-[50%] lg:flex lg:flex-col lg:justify-center">
            <h1 className="!font-medium !text-[#ebebe0] !text-[32px] md:!text-[44px] lg:!text-[50px] xl:!text-[58px] !leading-[1.15] md:-tracking-[1.5px] !mb-[12px] lg:!mb-[16px]">
              Your AI{" "}
              <span className="italic text-lime-500">Fundraising</span>{" "}
              Department
            </h1>

            <p className="text-[#ebebe0] text-[14px] md:text-[15px] lg:text-md xl:text-lg xl:max-w-[420px] leading-relaxed">
              Find the right investors, understand why they are relevant,
              reach out intelligently, and manage the entire fundraising
              process — all from one place.
            </p>

            <div className="mt-[18px] md:mt-[24px] lg:mt-[30px]">
              <Link
                href="/signup"
                className="inline-block font-medium text-[14px] md:text-base rounded-[7px] bg-lime-500 text-black py-[10px] md:py-[11.5px] px-[20px] md:px-[25px] transition-all hover:bg-lime-600 ltr:mr-[12px] rtl:ml-[12px]"
              >
                Start Fundraising
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-block font-medium rounded-[7px] border border-lime-500 text-[14px] md:text-base text-lime-500 py-[8.5px] md:py-[10.5px] px-[20px] md:px-[25px] transition-all hover:text-black hover:bg-lime-500 hover:border-lime-500"
              >
                See How It Works
              </Link>
            </div>

            <div className="mt-[18px] md:mt-[30px] lg:mt-[40px] flex flex-wrap gap-[12px] md:gap-[15px] text-[#ebebe0]/60 text-[12px] md:text-[13px] lg:text-[14px]">
              <span className="flex items-center gap-[6px]">
                <i className="ri-shield-check-fill text-lime-500"></i>
                No credit card required
              </span>
              <span className="flex items-center gap-[6px]">
                <i className="ri-time-fill text-lime-500"></i>
                Setup in under 10 minutes
              </span>
              <span className="flex items-center gap-[6px]">
                <i className="ri-lock-fill text-lime-500"></i>
                Your data stays private
              </span>
            </div>
          </div>

          {/* Right: Hero Image — absolutely positioned to touch bottom edge */}
          <div className="hidden lg:block absolute right-0 bottom-0 w-[55%] h-full">
            <Image
              src="/images/real-estate-agent/hero-main.png"
              alt="Capital OS Dashboard"
              fill
              className="object-contain object-bottom"
              sizes="58vw"
              priority
            />
          </div>

          {/* Mobile: Hero Image — visible below text on small screens */}
          <div className="lg:hidden relative w-full px-[20px]">
            <Image
              src="/images/real-estate-agent/hero-main.png"
              alt="Capital OS Dashboard"
              width={800}
              height={640}
              className="w-full h-auto block"
              style={{
                objectFit: "contain",
                objectPosition: "bottom center",
              }}
              sizes="100vw"
              priority
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroBanner;
