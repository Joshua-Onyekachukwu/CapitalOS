"use client";

import React from "react";

const HowItWorks: React.FC = () => {
  const checklistItems = [
    { id: 1, text: "Upload your pitch deck or describe your startup" },
    { id: 2, text: "AI discovers and scores relevant investors" },
    { id: 3, text: "Review and approve personalized email drafts" },
    { id: 4, text: "Track every conversation on a visual pipeline" },
  ];

  return (
    <div className="py-[70px] md:py-[90px] lg:py-[100px] xl:py-[120px] 2xl:py-[140px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="bg-[#06201b] rounded-[20px] md:rounded-[35px] py-[70px] px-[20px] md:py-[90px] md:px-[50px] lg:py-[100px] xl:py-[110px] xl:px-[110px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px] items-center">
            <div className="text-center ltr:xl:mr-[25px] rtl:xl:ml-[25px]">
              <div className="inline-block w-full max-w-[350px] aspect-square rounded-[20px] bg-[#0a3d2e] flex items-center justify-center">
                <div className="text-center px-[20px]">
                  <i className="ri-dashboard-3-line text-lime-500/30 text-[60px] md:text-[80px] block mb-[15px]"></i>
                  <span className="text-[#ebebe0]/30 text-[13px] md:text-[14px]">
                    Pipeline View
                  </span>
                </div>
              </div>
            </div>

            <div className="ltr:xl:pl-[90px] rtl:xl:pr-[90px]">
              <span className="inline-block font-medium text-lime-500 rounded-[30px] border border-lime-500 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
                How It Works
              </span>
              <h2 className="!text-[#ebebe0] md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
                From Pitch Deck to Funded
              </h2>
              <p className="md:text-[15px] lg:text-md text-[#ebebe0] md:max-w-[415px]">
                Four steps between where you are and where you want to be.
              </p>

              <div className="my-[20px] md:my-[25px] lg:my-[35px] xl:my-[45px]">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="mb-[15px] md:mb-[20px] lg:mb-[25px] last:mb-0 flex items-center font-medium text-[#ebebe0] text-[14px] md:text-md lg:text-lg gap-[12px]"
                  >
                    <span className="flex items-center justify-center w-[25px] md:w-[30px] h-[25px] md:h-[30px] rounded-full bg-[#00ba00] text-black text-[18px] md:text-[22px] flex-none">
                      <i className="ri-check-fill"></i>
                    </span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
