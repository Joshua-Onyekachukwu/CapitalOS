"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const HeroBanner: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="bg-[#0f172a] rounded-[20px] md:rounded-[30px] py-[60px] px-[20px] md:py-[80px] md:px-[40px] lg:py-[90px] lg:px-[50px] xl:py-[75px] xl:px-[110px] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[30px] items-center">
            <div>
              <h1 className="!font-medium !text-[#f1f5f9] !text-4xl md:!text-[46px] lg:!text-[52px] xl:!text-[58px] !leading-[1.15] md:-tracking-[1.5px] !mb-[15px] lg:!mb-[20px]">
                Your AI{" "}
                <span className="italic text-primary-500">Fundraising</span>{" "}
                Department
              </h1>

              <p className="text-[#f1f5f9]/80 md:text-[15px] lg:text-[17px] xl:text-lg xl:max-w-[420px] leading-relaxed">
                Find the right investors, understand why they are relevant,
                reach out intelligently, and manage the entire fundraising
                process — all from one place.
              </p>

              <div className="mt-[22px] md:mt-[30px] lg:mt-[40px]">
                <Link
                  href="/signup"
                  className="inline-block font-medium md:text-base rounded-[7px] bg-primary-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 ltr:mr-[15px] rtl:ml-[15px]"
                >
                  Start Fundraising
                </Link>
                <Link
                  href="/#how-it-works"
                  className="inline-block font-medium rounded-[7px] border border-primary-500 text-base text-primary-500 py-[8.5px] md:py-[10.5px] px-[22px] md:px-[25px] transition-all hover:text-black hover:bg-primary-500 hover:border-primary-500"
                >
                  See How It Works
                </Link>
              </div>

              <div className="mt-[22px] md:mt-[35px] lg:mt-[50px] xl:mt-[70px] flex flex-wrap gap-[15px] text-[#f1f5f9]/50 text-[13px] md:text-[14px]">
                <span className="flex items-center gap-[6px]">
                  <i className="ri-shield-check-fill text-primary-500"></i>
                  No credit card required
                </span>
                <span className="flex items-center gap-[6px]">
                  <i className="ri-time-fill text-primary-500"></i>
                  Setup in under 10 minutes
                </span>
                <span className="flex items-center gap-[6px]">
                  <i className="ri-lock-fill text-primary-500"></i>
                  Your data stays private
                </span>
              </div>
            </div>

            {/* Real Photography */}
            <div className="text-center ltr:lg:-ml-[50px] rtl:lg:-mr-[50px] ltr:xl:-ml-[100px] rtl:xl:-mr-[100px]">
              <div className="relative inline-block w-full max-w-[420px] lg:max-w-none aspect-[4/3] rounded-[20px] overflow-hidden">
                <Image
                  src="/images/landing/hero-founder.jpg"
                  alt="Startup founder working on laptop with team, planning fundraising strategy"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 420px, 500px"
                  priority
                />
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/40 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroBanner;
