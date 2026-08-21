"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const HeroBanner: React.FC = () => {
  return (
    <>
      <div className="bg-[#06201b]">
        <div className="xl:max-w-[1920px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div
              className="text-center relative bg-cover bg-no-repeat bg-center h-[400px] sm:h-[600px] md:h-[700px] lg:h-full ltr:lg:mr-[100px] rtl:lg:ml-[100px] ltr:xl:mr-[215px] rtl:xl:ml-[215px]"
              style={{
                backgroundImage: "url(/images/landing/hero-founder.jpg)",
              }}
            ></div>

            <div className="relative py-[60px] md:py-[80px] lg:pt-[300px] lg:pb-[190px] ltr:lg:pl-[60px] rtl:lg:pr-[60px] ltr:xl:pl-0 rtl:xl:pr-0 ltr:2xl:pl-[95px] rtl:2xl:pr-[95px]">
              <div className="px-[12px] 2xl:px-0 mx-auto 2xl:mx-0 sm:max-w-[540px] md:max-w-[720px] lg:max-w-full 2xl:max-w-[720px]">
                <h1 className="!mb-[15px] lg:!mb-[20px] !text-white !font-light !text-[35px] md:!text-[50px] lg:!text-[60px] xl:!text-[80px] 2xl:!text-[90px] !leading-[1.1]">
                  Your AI{" "}
                  <span className="font-bold">Fundraising</span>{" "}
                  Department
                </h1>

                <p className="lg:text-md xl:text-lg text-white/80">
                  Find the right investors, understand why they are relevant,
                  reach out intelligently, and manage the entire fundraising
                  process — all from one place.
                </p>

                <Link
                  href="/signup"
                  className="inline-block text-center bg-orange-500 border border-orange-500 rounded-[50px] text-white font-medium md:text-[15px] lg:text-md xl:text-[17px] py-[8.5px] px-[19px] transition-all hover:bg-primary-500 hover:border-primary-500 mt-[5px] md:mt-[10px] lg:mt-[15px] xl:mt-[20px]"
                >
                  <span className="inline-block relative ltr:pr-[27px] rtl:pl-[27px]">
                    Start Free 14-Day Trial{" "}
                    <i className="ri-arrow-right-long-line text-[20px] absolute top-1/2 -translate-y-1/2 ltr:-right-[2px] rtl:-left-[2px]"></i>
                  </span>
                </Link>

                <div className="mt-[25px] lg:mt-[50px] flex items-center gap-[10px] md:gap-[15px] border border-white/20 bg-white/10 rounded-[100px] p-[10px] md:p-[15px] max-w-[272px] md:max-w-[321px] lg:max-w-[372px]">
                  <div className="flex items-center">
                    <div className="inline-block rounded-full border-[2px] border-white w-[45px] md:w-[50px] lg:w-[55px] ltr:-mr-[20px] rtl:-ml-[20px] bg-primary-500 text-white flex items-center justify-center font-bold text-lg">
                      J
                    </div>
                    <div className="inline-block rounded-full border-[2px] border-white w-[45px] md:w-[50px] lg:w-[55px] ltr:-mr-[20px] rtl:-ml-[20px] bg-orange-500 text-white flex items-center justify-center font-bold text-lg">
                      S
                    </div>
                    <div className="inline-block rounded-full border-[2px] border-white w-[45px] md:w-[50px] lg:w-[55px] ltr:-mr-[20px] rtl:-ml-[20px] bg-success-500 text-white flex items-center justify-center font-bold text-lg">
                      A
                    </div>
                    <div className="flex items-center justify-center w-[45px] h-[45px] md:w-[50px] md:h-[50px] lg:w-[55px] lg:h-[55px] rounded-full border-[2px] border-white bg-primary-500 text-white text-xl">
                      <i className="ri-add-line"></i>
                    </div>
                  </div>
                  <span className="block lg:text-md text-white ltr:mr-[10px] rtl:ml-[10px] ltr:md:mr-[15px] rtl:md:ml-[15px]">
                    4.9/5 Stars Rating
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroBanner;
