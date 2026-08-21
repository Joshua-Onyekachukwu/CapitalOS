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
        <span className="inline-block font-medium text-[#7a857d] rounded-[30px] border border-[#ebebe0] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
          Why Capital OS
        </span>
        <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
          Built Different From Day One
        </h2>
        <p className="md:text-[15px] lg:text-md text-[#7a857d]">
          Every component is designed to help you fundraise more effectively — not just collect data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]">
        {capabilities.map((item, index) => (
          <div
            key={index}
            className="rounded-[15px] md:rounded-[20px] bg-[#ebebe0] dark:bg-[#0a0e19] p-[25px] md:p-[30px] text-center hover:shadow-md transition-shadow"
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#06201b] flex items-center justify-center mx-auto mb-[18px]">
              <i className={`${item.icon} text-lime-500 text-[22px]`}></i>
            </div>
            <h3 className="!text-[#06201B] dark:!text-white !font-semibold !text-[15px] md:!text-[16px] !mb-[8px]">
              {item.title}
            </h3>
            <p className="text-[#7a857d] text-[13px] md:text-[14px] !mb-0">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
