"use client";

import React from "react";

const steps = [
  {
    id: 1,
    icon: "ri-upload-cloud-2-line",
    title: "Upload Your Deck",
    description: "Drop your pitch deck or describe your startup. AI extracts your profile in minutes.",
  },
  {
    id: 2,
    icon: "ri-radar-line",
    title: "Discover Investors",
    description: "AI finds and scores investors that match your stage, sector, and geography.",
  },
  {
    id: 3,
    icon: "ri-quill-pen-line",
    title: "Review & Approve",
    description: "AI drafts personalized emails. You review, edit, and approve before anything is sent.",
  },
  {
    id: 4,
    icon: "ri-kanban-view",
    title: "Track Everything",
    description: "Manage every conversation on a visual pipeline from first contact to close.",
  },
];

const HowItWorks: React.FC = () => {
  return (
    <div className="py-[70px] md:py-[90px] lg:py-[100px] xl:py-[120px] 2xl:py-[140px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="bg-[#06201b] rounded-[20px] md:rounded-[35px] py-[60px] px-[20px] md:py-[80px] md:px-[50px] lg:py-[90px] xl:py-[100px] xl:px-[110px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[40px] items-center">
            {/* Steps */}
            <div>
              <span className="inline-block font-medium text-lime-500 rounded-[30px] border border-lime-500 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
                How It Works
              </span>
              <h2 className="!text-[#ebebe0] md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
                From Pitch Deck to Funded
              </h2>
              <p className="md:text-[15px] lg:text-md text-[#ebebe0]/70 mb-[30px] lg:mb-[40px]">
                Four steps between where you are and where you want to be.
              </p>

              <div className="space-y-[20px] md:space-y-[25px]">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex gap-[16px] items-start"
                  >
                    <div className="w-[42px] h-[42px] rounded-full bg-lime-500 text-black flex items-center justify-center flex-none font-bold text-[16px]">
                      {step.id}
                    </div>
                    <div>
                      <h3 className="!text-[#ebebe0] !font-semibold !text-[15px] md:!text-[16px] !mb-[4px]">
                        {step.title}
                      </h3>
                      <p className="text-[#ebebe0]/60 text-[13px] md:text-[14px] !mb-0">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual */}
            <div className="text-center hidden lg:block">
              <div className="inline-block w-full max-w-[380px] aspect-square rounded-[20px] bg-[#0a3d2e] flex items-center justify-center">
                <div className="grid grid-cols-2 gap-[12px] p-[30px]">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className="bg-[#06201b] rounded-[12px] p-[16px] text-center"
                    >
                      <i className={`${step.icon} text-lime-500/50 text-[24px] block mb-[8px]`}></i>
                      <span className="text-[#ebebe0]/40 text-[11px] block">
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
