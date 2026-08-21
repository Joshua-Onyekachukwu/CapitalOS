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

const getMarginClass = (index: number) => {
  if (index === 1) return "ltr:lg:ml-[90px] rtl:lg:mr-[90px]";
  if (index === 2) return "ltr:lg:ml-[180px] rtl:lg:mr-[180px]";
  return "";
};

const TargetUsers: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] text-center mx-auto md:max-w-[450px]">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[25px] items-center">
          {/* Placeholder illustration */}
          <div className="text-center ltr:lg:text-right rtl:lg:text-left ltr:lg:-mr-[70px] rtl:lg:-ml-[70px]">
            <div className="inline-block w-full max-w-[280px] aspect-[9/20] rounded-[20px] bg-[#ebebe0] dark:bg-[#0a0e19] flex items-center justify-center">
              <div className="text-center px-[20px]">
                <i className="ri-user-star-line text-[#06201b]/15 dark:text-white/15 text-[50px] block mb-[10px]"></i>
                <span className="text-[#7a857d] text-[12px]">Founder</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 ltr:lg:ml-[125px] rtl:lg:mr-[125px]">
            {idealUsersData.map((user, index) => (
              <div
                key={user.id}
                className={`border-b border-[#ebebe0] dark:border-gray-800 pb-[20px] md:pb-[25px] lg:pb-[35px] mb-[20px] md:mb-[25px] lg:mb-[35px] last:border-b-0 last:pb-0 last:mb-0 xl:max-w-[545px] ${getMarginClass(
                  index
                )}`}
              >
                <div className="flex items-center justify-center w-[42px] h-[42px] rounded-full bg-[#06201b] text-lime-500 text-[20px]">
                  <i className={user.icon}></i>
                </div>
                <h3 className="!font-medium !text-md md:!text-lg lg:!text-[20px] !text-[#06201B] dark:!text-white !mb-[10px] mt-[22px]">
                  {user.title}
                </h3>
                <p className="lg:max-w-[385px] text-[#7a857d]">
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
