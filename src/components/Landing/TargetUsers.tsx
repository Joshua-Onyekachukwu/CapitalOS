"use client";

import React from "react";

const idealUsersData = [
  {
    id: 1,
    icon: "ri-user-star-line",
    title: "Solo Founders",
    description:
      "Raising pre-seed, seed, or Series A without a dedicated fundraising team. You need an AI partner that does the research, drafting, and tracking while you stay in control.",
  },
  {
    id: 2,
    icon: "ri-team-line",
    title: "Small Startup Teams",
    description:
      "2–20 person teams where fundraising is shared across founders. Capital OS gives everyone a single source of truth for investor relationships.",
  },
  {
    id: 3,
    icon: "ri-building-2-line",
    title: "Accelerators & Advisors",
    description:
      "Help your portfolio companies fundraise smarter. Future support for accelerator programs and advisory workflows.",
  },
];

const TargetUsers: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] text-center mx-auto md:max-w-[500px]">
          <span className="inline-block font-medium text-[#7a857d] rounded-[30px] border border-[#ebebe0] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
            Built For Founders
          </span>
          <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
            Whether You&apos;re Raising Pre-Seed or Series A
          </h2>
          <p className="md:text-[15px] lg:text-md text-[#7a857d]">
            Capital OS is designed for founders who want to fundraise
            intelligently without the overhead of a full fundraising team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-[25px]">
          {idealUsersData.map((user) => (
            <div
              key={user.id}
              className="rounded-[15px] md:rounded-[20px] bg-[#ebebe0] dark:bg-[#0a0e19] p-[25px] md:p-[30px] text-center hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-[#06201b] text-lime-500 text-[22px] mx-auto mb-[18px]">
                <i className={user.icon}></i>
              </div>
              <h3 className="!font-semibold !text-[16px] md:!text-lg !text-[#06201B] dark:!text-white !mb-[10px]">
                {user.title}
              </h3>
              <p className="text-[#7a857d] text-[14px] md:text-[15px] !mb-0 leading-relaxed">
                {user.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TargetUsers;
