"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const HeroBanner: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="bg-[#06201b] rounded-[20px] md:rounded-[30px] py-[70px] px-[20px] md:py-[90px] md:px-[40px] lg:py-[100px] lg:px-[50px] xl:py-[75px] xl:px-[110px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px] items-center">
            <div>
              <h1 className="!font-medium !text-[#ebebe0] !text-4xl md:!text-[50px] lg:!text-[56px] xl:!text-[62px] !leading-[1.2] md:-tracking-[1.5px] !mb-[15px] lg:!mb-[20px]">
                Your AI{" "}
                <span className="italic text-lime-500">Fundraising</span>{" "}
                Department
              </h1>

              <p className="text-[#ebebe0] md:text-[15px] lg:text-md xl:text-lg xl:max-w-[400px]">
                Find the right investors, understand why they are relevant,
                reach out intelligently, and manage the entire fundraising
                process — all from one place.
              </p>

              <div className="mt-[22px] md:mt-[30px] lg:mt-[40px]">
                <Link
                  href="/signup"
                  className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 ltr:mr-[15px] rtl:ml-[15px]"
                >
                  Start Fundraising
                </Link>
                <Link
                  href="/#how-it-works"
                  className="inline-block font-medium rounded-[7px] border border-lime-500 text-base text-lime-500 py-[8.5px] md:py-[10.5px] px-[22px] md:px-[25px] transition-all hover:text-black hover:bg-lime-500 hover:border-lime-500"
                >
                  See How It Works
                </Link>
              </div>

              <div className="mt-[22px] md:mt-[35px] lg:mt-[50px] xl:mt-[80px] flex flex-wrap gap-[15px] text-[#ebebe0]/60 text-[13px] md:text-[14px]">
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

            {/* Banner Image */}
            <div className="text-center ltr:lg:-ml-[70px] rtl:lg:-mr-[70px] ltr:xl:-ml-[120px] rtl:xl:-mr-[120px]">
              <Image
                src="/images/real-estate-agent/banner.png"
                className="inline-block"
                alt="Capital OS Dashboard Preview"
                width={468}
                height={400}
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroBanner;
