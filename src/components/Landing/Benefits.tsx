"use client";

import React from "react";
import Image from "next/image";

const benefits = [
  {
    number: "1",
    title: "Stop Wasting Hours on Investor Research",      description:
      "Stop spending your evenings scrolling through PitchBook and LinkedIn. Tell Capital OS what you're building, and it finds the investors who actually care about your space. Filter by stage, sector, geography, and check size, all from one search.",
    image: "/images/real-estate-agent/benefits/benefit1.png",
    bgColor: "bg-[#06201b]",
    numberBg: "bg-lime-500",
    numberColor: "text-black",
    textColor: "!text-white",
    bottomPadding: true,
  },
  {
    number: "2",
    title: "Send Emails That Actually Get Replies",      description:
      "No more staring at a blank email wondering what to write. We draft messages that speak to each investor's thesis and recent activity. You review, edit if you want, and approve. That's it. Nothing goes out without your say-so.",
    image: "/images/real-estate-agent/benefits/benefit2.png",
    bgColor: "bg-[#E9DFDA] dark:bg-[#0a0e19]",
    numberBg: "bg-[#D15616]",
    numberColor: "text-white",
    textColor: "",
  },
  {
    number: "3",
    title: "Track Every Conversation in One Place",      description:
      "Watch your fundraise come together on one visual board. See who's been contacted, who's replied, and what needs your attention next. No more guessing where things stand.",
    image: "/images/real-estate-agent/benefits/benefit3.png",
    bgColor: "bg-lime-500",
    numberBg: "bg-[#06201b]",
    numberColor: "text-white",
    textColor: "text-black",
  },
];

const Benefits: React.FC = () => {
  return (
    <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px] pb-[60px] md:pb-[80px] lg:pb-[100px] xl:pb-[120px]">
      <div className="text-center mx-auto xl:max-w-[920px] mb-[30px] md:mb-[40px] lg:mb-[50px]">
        <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
          Outcomes
        </span>
        <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
          What Founders{" "}
          <span className="font-semibold italic">Actually Get</span> from{" "}
          <span className="font-semibold italic">Capital OS</span>
        </h2>
      </div>
      <div className="relative">
        {benefits.map((benefit, index) => (
          <div
            key={index}
            className={`${benefit.bgColor} rounded-[20px] pt-[20px] md:pt-[40px] lg:pt-[100px] xl:pt-[120px] lg:sticky mb-[30px] md:mb-[40px] lg:mb-[50px] last:mb-0`}
            style={{ top: `${100 + index * 20}px` }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
              <div className="xl:pt-[25px] px-[20px] md:px-[40px] ltr:lg:pl-[60px] rtl:lg:pr-[60px] ltr:xl:pl-[70px] rtl:xl:pr-[70px] ltr:lg:pr-0 rtl:lg:pl-0">
                <div
                  className={`flex items-center justify-center italic ${benefit.numberColor} w-[50px] h-[50px] md:w-[64px] md:h-[64px] rounded-full ${benefit.numberBg} text-[22px] md:text-xl font-semibold mb-[22px] md:mb-[27px] lg:mb-[40px]`}
                >
                  {benefit.number}
                </div>
                <h3
                  className={`!font-normal ${benefit.textColor || "text-black"} dark:text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[15px] md:!mb-[20px] lg:!mb-[25px]`}
                >
                  {benefit.title}
                </h3>
                <p
                  className={`${benefit.textColor || ""} ${benefit.textColor ? "" : "text-[#9E948E]"} text-base md:text-[15px] lg:text-md -tracking-[0.16px] xl:max-w-[400px]`}
                >
                  {benefit.description}
                </p>
              </div>
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="absolute -inset-[6px] rounded-[24px] border border-white/10 dark:border-white/5 pointer-events-none" />
                  <div className="absolute -top-[3px] -left-[3px] w-[24px] h-[24px] border-t-2 border-l-2 border-lime-500/40 rounded-tl-[10px] pointer-events-none z-10" />
                  <div className="absolute -bottom-[3px] -right-[3px] w-[24px] h-[24px] border-b-2 border-r-2 border-[#D15616]/40 rounded-br-[10px] pointer-events-none z-10" />
                  <Image
                    src={benefit.image}
                    className={`inline-block ltr:rounded-br-[20px] rtl:rounded-bl-[20px] ltr:rounded-bl-[20px] rtl:rounded-br-[20px] ltr:lg:rounded-bl-none rtl:lg:rounded-br-none relative z-[1]`}
                    alt="benefit-image"
                    width={500}
                    height={350}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Benefits;
