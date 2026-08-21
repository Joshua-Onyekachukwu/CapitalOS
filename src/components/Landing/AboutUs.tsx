"use client";

import React from "react";
import Image from "next/image";

const AboutUs: React.FC = () => {
  return (
    <>
      <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] bg-[#0D1427]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[25px]">
            <div className="lg:col-span-1 ltr:xl:pr-[25px] rtl:xl:pl-[25px]">
              <span className="inline-block border border-white/25 rounded-[30px] mb-[15px] md:mb-[20px] lg:mb-[30px] xl:mb-[40px] py-[4px] md:py-[7px] px-[15px] md:px-[20px] text-white">
                About
              </span>
              <Image
                src="/images/landing/hero-founder.jpg"
                alt="about-capital-os"
                width={494}
                height={469}
                className="rounded-[15px] object-cover"
              />
            </div>

            <div className="lg:col-span-2">
              <h2 className="!mb-0 !text-[26px] md:!text-3xl lg:!text-4xl !text-white">
                After Years of Watching Founders Struggle With Manual
                Fundraising Processes, We Built a Smarter Way Forward.
              </h2>

              <div className="pb-[30px] md:pb-[40px] lg:pb-[50px]"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-[25px]">
                <div>
                  <h3 className="!text-md md:!text-lg lg:!text-[22px] xl:!text-xl !text-white !mb-[12px] md:!mb-[15px]">
                    Our Mission
                  </h3>
                  <p className="lg:text-[15px] xl:text-md text-white">
                    Empower founders with AI-driven intelligence that
                    transforms fundraising from guesswork into a strategic,
                    data-informed process.
                  </p>
                </div>
                <div>
                  <h3 className="!text-md md:!text-lg lg:!text-[22px] xl:!text-xl !text-white !mb-[12px] md:!mb-[15px]">
                    Our Impact
                  </h3>
                  <p className="lg:text-[15px] xl:text-md text-white">
                    Founders using Capital OS close their rounds faster with
                    better-matched investors and more personalized outreach
                    strategies.
                  </p>
                </div>
              </div>

              <div className="mt-[30px] md:mt-[40px] lg:mt-[50px] rounded-[15px] bg-[#1C2336] p-[20px] md:p-[25px] lg:p-[30px] xl:p-[50px]">
                <p className="text-white lg:text-md xl:text-lg font-bold">
                  <q>
                    We believe every founder deserves the same level of
                    fundraising intelligence that large corporations take for
                    granted — AI that works for you, not the other way around.
                  </q>
                </p>
                <div className="mt-[20px] md:mt-[25px] flex items-center gap-[15px] md:gap-[20px]">
                  <div className="rounded-full w-[70px] h-[70px] bg-primary-500 text-white flex items-center justify-center font-bold text-xl flex-none">
                    J
                  </div>
                  <div>
                    <h4 className="!text-white !text-md md:!text-lg !mb-[8px]">
                      Joshua Onyekachukwu
                    </h4>
                    <span className="block text-white">
                      Founder & CEO, Capital OS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutUs;
