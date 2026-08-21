"use client";

import React from "react";

interface PlatformFeature {
  id: number;
  title: string;
  description: string;
  icon: string;
}

const Platform: React.FC = () => {
  const platformFeatures: PlatformFeature[] = [
    {
      id: 1,
      title: "Faster Onboarding",
      description:
        "Get set up in minutes, not days. Upload your deck or describe your startup, and AI builds your profile automatically.",
      icon: "ri-rocket-2-line",
    },
    {
      id: 2,
      title: "Bank-Level Security",
      description:
        "Supabase with Row Level Security, encrypted storage, and server-side API keys. Your data stays private and isolated.",
      icon: "ri-shield-check-line",
    },
    {
      id: 3,
      title: "Live Support",
      description:
        "Real humans answer your questions quickly. No bots, no ticket queues — just direct help when you need it.",
      icon: "ri-customer-service-2-line",
    },
    {
      id: 4,
      title: "Proven Results",
      description:
        "Founders using Capital OS close their rounds faster with better-matched investors and smarter outreach strategies.",
      icon: "ri-trophy-line",
    },
  ];

  return (
    <>
      <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] text-center mx-auto lg:max-w-[872px]">
            <span className="inline-block border border-[#EBEBEB] dark:border-gray-800 rounded-[30px] mb-[12px] md:mb-[15px] lg:mb-[20px] py-[4px] md:py-[7px] px-[15px] md:px-[20px] text-black dark:text-white">
              Choose our platform
            </span>
            <h2 className="!mb-0 !text-[26px] md:!text-3xl lg:!text-4xl">
              We Built the Fundraising Dashboard We Wished Existed When We Were Starting Out
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px]">
            {platformFeatures.map((feature) => (
              <div
                key={feature.id}
                className="bg-[#F9FAFB] dark:bg-[#0a0e19] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px]"
              >
                <div className="mb-[20px] md:mb-[25px] text-center">
                  <div className="w-[80px] h-[80px] rounded-full bg-primary-500 text-white flex items-center justify-center mx-auto text-[32px]">
                    <i className={feature.icon}></i>
                  </div>
                </div>
                <h3 className="!text-md md:!text-lg lg:!text-[22px] xl:!text-xl !mb-[12px]">
                  {feature.title}
                </h3>
                <p className="lg:text-[15px] xl:text-md">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Platform;
