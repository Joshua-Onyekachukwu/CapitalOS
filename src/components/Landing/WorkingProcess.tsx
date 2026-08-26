"use client";

import React from "react";
import Image from "next/image";

const steps = [
  {
    number: "1",
    title: "Discover Investors",
    description: "We find and score investors that match your stage, sector, and geography.",
  },
  {
    number: "2",
    title: "Review & Personalize",
    description: "We draft personalized emails. You review, edit, and approve before sending.",
  },
  {
    number: "3",
    title: "Track & Close",
    description: "Monitor every conversation from first contact to signed term sheet.",
  },
];

const WorkingProcess: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
          <div>
            <div className="text-center ltr:xl:-mr-[5px] rtl:xl:-ml-[5px] lg:sticky xl:relative top-0">
              <Image
                src="/images/real-estate-agent/working-process-new.png"
                className="inline-block rtl:-scale-x-100"
                alt="working-process"
                width={500}
                height={500}
              />

            </div>
          </div>
          <div className="ltr:xl:pl-[30px] rtl:xl:pr-[30px]">
            <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
              Working Process
            </span>
            <h2 className="!mb-[15px] md:!mb-[20px] lg:!mb-[25px] !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px] ltr:xl:pr-[45px] rtl:xl:pl-[45px]">
              A Simple, Streamlined{" "}
              <span className="font-semibold italic">Workflow</span> That
              Actually Works for{" "}
              <span className="font-semibold italic">Founders</span>
            </h2>
            <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] xl:max-w-[530px]">
              Capital OS is built to streamline the way you fundraise, from
              the first investor discovery to the final signed term sheet.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[25px] mt-[25px] md:mt-[30px] lg:mt-[30px] xl:mt-[75px] ltr:xl:-ml-[267px] rtl:xl:-mr-[267px]">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-[#E9DFDA] dark:bg-[#06201b] rounded-[10px] p-[20px] md:py-[25px]"
                >
                  <div className="mb-[16px] md:mb-[20px] xl:mb-[30px] leading-none italic text-black dark:text-white font-semibold text-xl">
                    {step.number}
                  </div>
                  <h3 className="!font-normal -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[12px] xl:mb-[20px] xl:max-w-[120px]">
                    {step.title}
                  </h3>
                  <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px]">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingProcess;
