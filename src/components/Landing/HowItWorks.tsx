"use client";

import React from "react";

interface Step {
  id: number;
  number: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    id: 1,
    number: "01",
    title: "Upload Your Pitch Deck",
    description:
      "Upload your deck, one-pager, or any materials. Our AI extracts your startup profile, identifies what is missing, and asks the right questions.",
  },
  {
    id: 2,
    number: "02",
    title: "AI Finds the Right Investors",
    description:
      "We search thousands of investors, filter by stage and sector, match semantically, rerank with precision, and score each one — so you see the best first.",
  },
  {
    id: 3,
    number: "03",
    title: "Personalized Outreach",
    description:
      "AI drafts personalized emails for each investor based on their thesis, portfolio, and recent activity. You review, edit, and approve before anything is sent.",
  },
  {
    id: 4,
    number: "04",
    title: "Manage Your Pipeline",
    description:
      "Track every investor from discovery to close on a visual pipeline. AI classifies replies, recommends follow-ups, and prepares meeting briefs.",
  },
];

const HowItWorks: React.FC = () => {
  return (
    <>
      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] 2xl:mb-[70px] text-center mx-auto md:max-w-[600px]">
            <span className="inline-block rounded-[30px] bg-primary-500 text-white py-[4.5px] px-[14px] mb-[12px] md:mb-[15px]">
              How It Works
            </span>
            <h2 className="!font-medium md:-tracking-[1px] !text-2xl md:!text-3xl lg:!text-4xl xl:!text-5xl !leading-[1.2] !mb-[12px]">
              From Pitch Deck to Funded
            </h2>
            <p className="md:text-[15px] lg:text-md">
              Four steps between where you are and where you want to be.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[25px]">
            {steps.map((step) => (
              <div
                key={step.id}
                className="relative p-[25px] md:p-[30px] xl:p-[40px] bg-white dark:bg-dark rounded-[15px] md:rounded-[25px] border border-gray-200 dark:border-gray-800"
              >
                <span className="inline-block !text-primary-500 !font-medium -tracking-[1.5px] !text-3xl md:!text-4xl lg:!text-5xl !mb-[15px] md:mb-[20px] opacity-30">
                  {step.number}
                </span>
                <h3 className="!text-lg md:!text-xl !mb-[10px] !font-semibold">
                  {step.title}
                </h3>
                <p className="md:text-[15px] lg:text-md !mb-0">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default HowItWorks;
