"use client";

import React from "react";

interface PainPoint {
  id: number;
  icon: string;
  title: string;
  description: string;
}

const painPoints: PainPoint[] = [
  {
    id: 1,
    icon: "ri-search-eye-line",
    title: "Finding Investors Is Exhausting",
    description:
      "Hours spent searching Google, LinkedIn, and VC websites — with no guarantee the investors are relevant to your startup.",
  },
  {
    id: 2,
    icon: "ri-mail-send-line",
    title: "Outreach Feels Like Guesswork",
    description:
      "Cold emails that go unanswered because they are generic, untimed, or sent to the wrong person at the wrong firm.",
  },
  {
    id: 3,
    icon: "ri-file-list-3-line",
    title: "Tracking Is a Spreadsheet Nightmare",
    description:
      "Juggling spreadsheets, notes, and emails to remember who you contacted, what you said, and what to do next.",
  },
  {
    id: 4,
    icon: "ri-brain-line",
    title: "No Intelligence Behind the Process",
    description:
      "No way to know which investors actually align with your thesis, stage, or traction — or why they should care.",
  },
];

const ProblemStatement: React.FC = () => {
  return (
    <>
      <div className="dark:bg-[#0a0e19] py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px] relative z-[1]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] 2xl:mb-[70px] text-center mx-auto md:max-w-[600px]">
            <span className="inline-block rounded-[30px] bg-primary-500 text-white py-[4.5px] px-[14px] mb-[12px] md:mb-[15px]">
              The Problem
            </span>
            <h2 className="!font-medium md:-tracking-[1px] !text-2xl md:!text-3xl lg:!text-4xl xl:!text-5xl !leading-[1.2] !mb-[12px]">
              Fundraising Is Broken for Founders
            </h2>
            <p className="md:text-[15px] lg:text-md">
              Solo founders and small teams spend more time managing
              spreadsheets and sending cold emails than actually building their
              company.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[25px]">
            {painPoints.map((point) => (
              <div
                key={point.id}
                className="p-[25px] md:p-[30px] xl:p-[40px] bg-white dark:bg-dark rounded-[15px] md:rounded-[25px] border border-gray-200 dark:border-gray-800"
              >
                <div className="flex items-center justify-center w-[50px] h-[50px] rounded-[12px] bg-primary-50 dark:bg-primary-900/20 text-primary-500 text-[24px] mb-[18px] md:mb-[22px]">
                  <i className={point.icon}></i>
                </div>
                <h3 className="!text-lg md:!text-xl !mb-[10px] !font-semibold">
                  {point.title}
                </h3>
                <p className="md:text-[15px] lg:text-md !mb-0">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="absolute top-0 left-0 right-0 bottom-0 lg:rounded-[30px] -z-[1] bg-center bg-no-repeat bg-cover lg:mx-[15px] xl:mx-[30px] dark:hidden"
          style={{
            backgroundImage: "url(/images/landing/problem-bg.jpg)",
          }}
        ></div>
      </div>
    </>
  );
};

export default ProblemStatement;
