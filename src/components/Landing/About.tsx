"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const About: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] relative z-[1]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="ltr:lg:ml-auto rtl:lg:mr-auto lg:max-w-[1178px] mb-[25px] md:mb-[35px]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-[25px] xl:gap-[80px] items-center">
            <div className="text-center lg:max-w-[186px] hidden md:block">
              <Image
                src="/images/real-estate-agent/about1.jpg"
                className="inline-block rounded-[10px]"
                alt="about-capital-os"
                width={186}
                height={240}
              />
            </div>
            <div className="md:col-span-3 ltr:xl:-ml-[45px] rtl:xl:-mr-[45px]">
              <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
                The Problem
              </span>
              <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px] xl:max-w-[821px]">
                Fundraising Is Broken. <span className="font-semibold italic">Founders Know It.</span>
              </h2>
              <div className="h-px bg-[#06201b]/5 dark:bg-gray-900 mt-[25px] md:mt-[30px] lg:mt-[40px]"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px] xl:gap-[100px] items-center">
          <div className="relative text-center ltr:pl-[105px] rtl:pr-[105px]">
            <div className="md:max-w-[495px] lg:max-w-[260px] xl:max-w-[319px] ltr:md:ml-auto rtl:md:mr-auto">
              <Image
                src="/images/real-estate-agent/about4.jpg"
                className="rounded-[10px] inline-block"
                alt="about-image"
                width={319}
                height={400}
              />
            </div>
            <div className="max-w-[90px] md:max-w-[175px] absolute top-0 ltr:left-0 rtl:right-0 ltr:xl:left-[63px] rtl:xl:right-[63px]">
              <Image
                src="/images/real-estate-agent/about2.jpg"
                className="rounded-[10px] inline-block"
                alt="about-image"
                width={175}
                height={220}
              />
            </div>
          </div>
          <div>
            <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] mb-[16px]">
              Most founders spend <strong>20+ hours per week</strong> on investor
              research — digging through spreadsheets, scanning PitchBook, copying
              email addresses, and writing cold emails that get ignored.
            </p>
            <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] mb-[16px]">
              The tools available today are either too expensive (PitchBook at
              $20K+/year), too generic (CRMs that weren&apos;t built for fundraising),
              or too manual (Google Sheets with 500 rows of investor data).
            </p>
            <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] mb-[20px] lg:mb-[25px]">
              We built Capital OS because <strong>founders deserve better</strong>.
              A single platform that gives you a real investor database, AI-powered
              matching, and personalized outreach — without the spreadsheet chaos.
            </p>
            <Link
              href="/signup"
              className="inline-block uppercase font-bold tracking-[1.8px] bg-[#06201b] text-white rounded-[60px] text-xs py-[15px] md:py-[16px] lg:py-[17px] px-[25px] md:px-[29px] transition-all hover:bg-lime-500 hover:text-black mt-[5px] md:mt-[10px]"
            >
              <span className="inline-block relative ltr:pl-[28px] rtl:pr-[28px] ltr:lg:pl-[32px] rtl:lg:pr-[32px]">
                <i className="ri-rocket-2-line text-md absolute top-1/2 -translate-y-1/2 ltr:left-0 rtl:right-0"></i>
                EXPLORE DASHBOARD
              </span>
            </Link>
          </div>
        </div>
      </div>
      <div className="absolute top-[120px] ltr:left-0 rtl:right-0 -z-[1] rtl:-scale-x-100 hidden xl:block">
        <Image
          src="/images/real-estate-agent/home.png"
          className="inline-block"
          alt="home"
          width={200}
          height={300}
        />
      </div>
    </div>
  );
};

export default About;
