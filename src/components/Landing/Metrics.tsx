"use client";

import React from "react";

const capabilities = [
  {
    icon: "ri-database-2-line",
    title: "Investor Intelligence",
    description: "Research investors across stage, sector, geography, and check size.",
  },
  {
    icon: "ri-brain-line",
    title: "AI Matching",
    description: "Multi-layer scoring with semantic embeddings, reranking, and reasoning.",
  },
  {
    icon: "ri-mail-star-line",
    title: "Smart Outreach",
    description: "Personalized drafts based on each investor's thesis and portfolio.",
  },
  {
    icon: "ri-kanban-view",
    title: "Visual Pipeline",
    description: "Track every investor from discovery through close on a Kanban board.",
  },
];

export default function Metrics() {
  return (
    <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
      <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] text-center mx-auto md:max-w-[500px]">
        <span className="inline-block font-medium text-[#64748b] rounded-[30px] border border-[#f1f5f9] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
          Why Capital OS
        </span>
        <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
          Built Different From Day One
        </h2>
        <p className="md:text-[15px] lg:text-md text-[#64748b]">
          Every component is designed to help you fundraise more effectively — not just collect data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]">
        {capabilities.map((item, index) => (
          <div
            key={index}
            className="rounded-[15px] md:rounded-[20px] bg-[#f1f5f9] dark:bg-[#0f1629] p-[25px] md:p-[30px] text-center hover:shadow-md transition-shadow"
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#0f172a] flex items-center justify-center mx-auto mb-[18px]">
              <i className={`${item.icon} text-primary-500 text-[22px]`}></i>
            </div>
            <h3 className="!text-[#06201B] dark:!text-white !font-semibold !text-[15px] md:!text-[16px] !mb-[8px]">
              {item.title}
            </h3>
            <p className="text-[#64748b] text-[13px] md:text-[14px] !mb-0">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
