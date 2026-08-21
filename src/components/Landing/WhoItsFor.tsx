"use client";

import React from "react";
import Image from "next/image";

interface TargetAudienceItem {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  bgColorClass: string;
}

const WhoItsFor: React.FC = () => {
  const targetAudience: TargetAudienceItem[] = [
    {
      id: 1,
      title: "Solo Founders",
      description:
        "Raising pre-seed, seed, or Series A without a dedicated fundraising team. You need an AI partner that does the research, drafting, and tracking while you stay in control.",
      imageSrc: "/images/landing/founder-working.jpg",
      bgColorClass: "bg-[#C6CBFB]",
    },
    {
      id: 2,
      title: "Small Startup Teams",
      description:
        "2–20 person teams where fundraising is shared across founders. Capital OS gives everyone a single source of truth for investor relationships.",
      imageSrc: "/images/landing/startup-team.jpg",
      bgColorClass: "bg-[#BCD5CE]",
    },
    {
      id: 3,
      title: "Accelerators & Advisors",
      description:
        "Help your portfolio companies fundraise smarter. Future support for accelerator programs and advisory workflows.",
      imageSrc: "/images/landing/team-meeting.jpg",
      bgColorClass: "bg-[#FCE88D]",
    },
  ];

  return (
    <>
      <div className="pt-[60px] md:pt-[80px] lg:pt-[100px] xl:pt-[120px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px]">
            <span className="inline-block border border-[#EBEBEB] dark:border-gray-800 rounded-[30px] mb-[12px] md:mb-[15px] lg:mb-[20px] py-[4px] md:py-[7px] px-[15px] md:px-[20px] text-black dark:text-white">
              Who it&apos;s for
            </span>
            <h2 className="!mb-0 !text-[26px] md:!text-3xl lg:!text-4xl">
              Built for Founders Who Want to Fundraise Smarter
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[25px]">
            {targetAudience.map((item) => (
              <div
                key={item.id}
                className={`${item.bgColorClass} dark:bg-[#0a0e19] rounded-[15px] px-[20px] md:px-[25px] lg:px-[30px] pt-[20px] md:pt-[25px] lg:pt-[30px]`}
              >
                <h3 className="!text-md md:!text-lg lg:!text-[22px] xl:!text-xl !mb-[12px] md:!mb-[15px]">
                  {item.title}
                </h3>
                <p className="text-black dark:text-white lg;text-[15px] xl:text-md">
                  {item.description}
                </p>
                <div className="text-center mt-[20px] md:mt-[25px]">
                  <Image
                    src={item.imageSrc}
                    alt={`${item.title.toLowerCase().replace(/\s+/g, "-")}-image`}
                    className="inline-block rounded-[10px]"
                    width={393}
                    height={288}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default WhoItsFor;
