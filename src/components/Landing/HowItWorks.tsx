"use client";

import React from "react";
import Image from "next/image";

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
        <div className="bg-[#0f172a] rounded-[20px] md:rounded-[35px] py-[60px] px-[20px] md:py-[80px] md:px-[50px] lg:py-[90px] xl:py-[100px] xl:px-[110px] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[40px] items-center">
            {/* Steps */}
            <div>
              <span className="inline-block font-medium text-primary-500 rounded-[30px] border border-primary-500 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
                How It Works
              </span>
              <h2 className="!text-[#f1f5f9] md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
                From Pitch Deck to Funded
              </h2>
              <p className="md:text-[15px] lg:text-md text-[#f1f5f9]/70 mb-[30px] lg:mb-[40px]">
                Four steps between where you are and where you want to be.
              </p>

              <div className="space-y-[20px] md:space-y-[25px]">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex gap-[16px] items-start"
                  >
                    <div className="w-[42px] h-[42px] rounded-full bg-primary-500 text-black flex items-center justify-center flex-none font-bold text-[16px]">
                      {step.id}
                    </div>
                    <div>
                      <h3 className="!text-[#f1f5f9] !font-semibold !text-[15px] md:!text-[16px] !mb-[4px]">
                        {step.title}
                      </h3>
                      <p className="text-[#f1f5f9]/60 text-[13px] md:text-[14px] !mb-0">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Real Photography */}
            <div className="text-center hidden lg:block">
              <div className="relative w-full max-w-[420px] aspect-square rounded-[20px] overflow-hidden mx-auto">
                <Image
                  src="/images/landing/collaboration.jpg"
                  alt="Team collaborating on startup fundraising strategy around a shared workspace"
                  fill
                  className="object-cover"
                  sizes="420px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/30 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
