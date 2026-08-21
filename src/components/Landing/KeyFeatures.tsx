"use client";

import React from "react";

interface FeatureItem {
  id: number;
  icon: string;
  title: string;
  description: string;
}

const features: FeatureItem[] = [
  {
    id: 1,
    icon: "ri-radar-line",
    title: "Investor Discovery",
    description:
      "AI searches across databases, web sources, and public records to find investors that match your stage, sector, and geography.",
  },
  {
    id: 2,
    icon: "ri-brain-line",
    title: "AI Matching & Scoring",
    description:
      "Multi-layer matching — SQL filters, semantic embeddings, reranking, and reasoning — produces ranked investor lists with clear explanations.",
  },
  {
    id: 3,
    icon: "ri-mail-star-line",
    title: "Personalized Outreach",
    description:
      "AI drafts emails tailored to each investor's thesis, portfolio, and recent activity. You review and approve before anything is sent.",
  },
  {
    id: 4,
    icon: "ri-dashboard-3-line",
    title: "Fundraising Pipeline",
    description:
      "Visual Kanban board to move investors from discovery through qualification, outreach, meetings, and close — all in one view.",
  },
];

const KeyFeatures: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] text-center mx-auto md:max-w-[500px]">
          <span className="inline-block font-medium text-[#64748b] rounded-[30px] border border-[#f1f5f9] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
            Features
          </span>
          <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
            Everything You Need to Raise
          </h2>
          <p className="md:text-[15px] lg:text-md text-[#64748b]">
            A complete fundraising operating system — not just another
            investor database.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="rounded-[15px] md:rounded-[20px] bg-[#f1f5f9] dark:bg-[#0f1629] p-[25px] md:p-[30px] hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-[#0f172a] mb-[20px] md:mb-[25px]">
                <i className={`${feature.icon} text-primary-500 text-[22px]`}></i>
              </div>
              <h3 className="!text-[#06201B] dark:!text-white !font-semibold !text-[15px] md:!text-[16px] !mb-[8px] md:!mb-[10px]">
                {feature.title}
              </h3>
              <p className="text-[#64748b] text-[13px] md:text-[14px] !mb-0 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default KeyFeatures;
