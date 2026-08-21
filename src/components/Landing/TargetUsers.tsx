"use client";

import React from "react";

interface TargetUser {
  id: number;
  icon: string;
  title: string;
  description: string;
}

const targetUsers: TargetUser[] = [
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
      <div className="py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] 2xl:mb-[70px] text-center mx-auto md:max-w-[600px]">
            <span className="inline-block rounded-[30px] bg-primary-500 text-white py-[4.5px] px-[14px] mb-[12px] md:mb-[15px]">
              Built For Founders
            </span>
            <h2 className="!font-medium md:-tracking-[1px] !text-2xl md:!text-3xl lg:!text-4xl xl:!text-5xl !leading-[1.2] !mb-[12px]">
              Whether You&apos;re Raising Pre-Seed or Series A
            </h2>
            <p className="md:text-[15px] lg:text-md">
              Capital OS is designed for founders who want to fundraise
              intelligently without the overhead of a full fundraising team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[25px]">
            {targetUsers.map((user) => (
              <div
                key={user.id}
                className="p-[25px] md:p-[30px] xl:p-[40px] bg-white dark:bg-dark rounded-[15px] md:rounded-[25px] border border-gray-200 dark:border-gray-800 text-center"
              >
                <div className="flex items-center justify-center w-[60px] h-[60px] rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-500 text-[28px] mx-auto mb-[20px] md:mb-[25px]">
                  <i className={user.icon}></i>
                </div>
                <h3 className="!text-lg md:!text-xl !mb-[10px] !font-semibold">
                  {user.title}
                </h3>
                <p className="md:text-[15px] lg:text-md !mb-0">
                  {user.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default TargetUsers;
