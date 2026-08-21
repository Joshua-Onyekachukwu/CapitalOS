"use client";

import React from "react";

const Feedbacks: React.FC = () => {
  return (
    <>
      <div className="pb-[60px] md:pb-[80px] lg:pb-[100px] xl:pb-[120px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] text-center mx-auto lg:max-w-[872px]">
            <span className="inline-block border border-[#EBEBEB] dark:border-gray-800 rounded-[30px] py-[4px] md:py-[7px] px-[15px] md:px-[20px] text-black dark:text-white">
              What founders say
            </span>
          </div>

          <div className="text-center">
            <p className="font-bold text-lg md:text-xl lg:text-2xl xl:text-4xl text-black dark:text-white !leading-[1.4] xl:!leading-[1.2] xl:max-w-[1096px] mx-auto">
              &ldquo;Capital OS gave us real-time investor intelligence we never
              had before. Our team now makes faster, smarter fundraising
              decisions. It&apos;s a total game-changer for startup growth.&rdquo;
            </p>

            <div className="bg-white dark:bg-dark inline-block px-[20px] md:px-[40px]">
              <div className="w-[80px] h-[80px] rounded-full bg-primary-500 text-white flex items-center justify-center mx-auto text-2xl font-bold">
                S
              </div>
              <h3 className="!text-md md:!text-lg mt-[20px] md:mt-[25px] !mb-[9px]">
                Sarah Chen
              </h3>
              <span className="block lg:text-[15px] xl:text-md">
                CEO, TechVenture AI
              </span>
            </div>
            <div className="h-px bg-[#E3E2E7] dark:bg-gray-800 mt-[60px] md:mt-[70px]"></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Feedbacks;
