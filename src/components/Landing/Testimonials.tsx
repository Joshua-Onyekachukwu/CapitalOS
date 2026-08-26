"use client";

import React from "react";

const Testimonials: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="text-center mx-auto lg:max-w-[800px] mb-[30px] md:mb-[40px] lg:mb-[50px]">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
            Why Founders Choose Capital OS
          </span>
          <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            Raise Capital{" "}
            <span className="font-semibold italic">Without the Stress</span>
          </h2>
          <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] mt-[15px] text-gray-500 dark:text-gray-400">
            Founders who use Capital OS spend less time on research and more
            time closing rounds.
          </p>
        </div>

        <div className="bg-[#E9DFDA] dark:bg-[#06201b] rounded-[20px] p-[30px] md:p-[50px] lg:p-[60px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[30px] md:gap-[40px]">
            <div className="text-center">
              <div className="w-[60px] h-[60px] rounded-full bg-lime-500 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-magic-line text-2xl text-black"></i>
              </div>
              <h3 className="!font-semibold !text-lg md:!text-xl !mb-[8px]">
                Discover the Right Investors
              </h3>
              <p className="text-[14px] md:text-[15px] text-gray-500 dark:text-gray-400 !mb-0">
                We find and score investors who match your stage, sector, and
                geography. No more scrolling through PitchBook for hours.
              </p>
            </div>
            <div className="text-center">
              <div className="w-[60px] h-[60px] rounded-full bg-lime-500 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-mail-send-line text-2xl text-black"></i>
              </div>
              <h3 className="!font-semibold !text-lg md:!text-xl !mb-[8px]">
                Outreach That Gets Replies
              </h3>
              <p className="text-[14px] md:text-[15px] text-gray-500 dark:text-gray-400 !mb-0">
                We draft personalized emails that reference each investor&apos;s
                thesis and portfolio. You review and approve before anything goes
                out.
              </p>
            </div>
            <div className="text-center">
              <div className="w-[60px] h-[60px] rounded-full bg-lime-500 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-line-chart-line text-2xl text-black"></i>
              </div>
              <h3 className="!font-semibold !text-lg md:!text-xl !mb-[8px]">
                Close Your Round Faster
              </h3>
              <p className="text-[14px] md:text-[15px] text-gray-500 dark:text-gray-400 !mb-0">
                Track every investor from first touch to signed term sheet. See
                what&apos;s working, what&apos;s not, and what needs your
                attention next.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-[30px] md:mt-[40px] bg-[#06201b] rounded-[16px] p-[30px] md:p-[40px] text-center">
          <p className="text-[18px] md:text-[22px] text-white !mb-[8px]">
            &ldquo;We built Capital OS because founders shouldn&apos;t need a
            $20K PitchBook subscription and a team of analysts to find the right
            investors.&rdquo;
          </p>
          <p className="text-[14px] text-gray-400 !mb-0">
            — The Capital OS Team
          </p>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
