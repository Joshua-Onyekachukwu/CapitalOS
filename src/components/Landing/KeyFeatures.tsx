"use client";

import React from "react";

interface Feature {
  id: number;
  icon: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    id: 1,
    icon: "ri-radar-line",
    title: "Investor Discovery",
    description:
      "AI searches across databases, web sources, and public records to find investors that match your stage, sector, and geography.",
  },
  {
    id: 2,
    icon: "ri-brain-line",
    title: "AI Matching & Scoring",
    description:
      "Multi-layer matching — SQL filters, semantic embeddings, reranking, and reasoning — produces ranked investor lists with clear explanations.",
  },
  {
    id: 3,
    icon: "ri-mail-star-line",
    title: "Personalized Outreach",
    description:
      "AI drafts emails tailored to each investor's thesis, portfolio, and recent activity. You review and approve before anything is sent.",
  },
  {
    id: 4,
    icon: "ri-dashboard-3-line",
    title: "Fundraising Pipeline",
    description:
      "Visual Kanban board to move investors from discovery through qualification, outreach, meetings, and close — all in one view.",
  },
  {
    id: 5,
    icon: "ri-chat-quote-line",
    title: "Reply Intelligence",
    description:
      "AI classifies incoming replies, detects interest levels, flags opt-outs, and recommends your next action automatically.",
  },
  {
    id: 6,
    icon: "ri-calendar-check-line",
    title: "Meeting Management",
    description:
      "AI generates meeting briefs before calls, summarizes notes after, and creates follow-up action items so nothing falls through the cracks.",
  },
];

const KeyFeatures: React.FC = () => {
  return (
    <>
      <div className="dark:bg-[#0a0e19] py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px] relative z-[1]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] 2xl:mb-[70px] text-center mx-auto md:max-w-[600px]">
            <span className="inline-block rounded-[30px] bg-primary-500 text-white py-[4.5px] px-[14px] mb-[12px] md:mb-[15px]">
              Features
            </span>
            <h2 className="!font-medium md:-tracking-[1px] !text-2xl md:!text-3xl lg:!text-4xl xl:!text-5xl !leading-[1.2] !mb-[12px]">
              Everything You Need to Raise
            </h2>
            <p className="md:text-[15px] lg:text-md">
              A complete fundraising operating system — not just another
              investor database.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[25px]">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="p-[25px] md:p-[30px] xl:p-[35px] bg-white dark:bg-dark rounded-[15px] md:rounded-[25px] border border-gray-200 dark:border-gray-800 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
              >
                <div className="flex items-center justify-center w-[50px] h-[50px] rounded-[12px] bg-primary-50 dark:bg-primary-900/20 text-primary-500 text-[24px] mb-[18px] md:mb-[22px]">
                  <i className={feature.icon}></i>
                </div>
                <h3 className="!text-lg md:!text-xl !mb-[10px] !font-semibold">
                  {feature.title}
                </h3>
                <p className="md:text-[15px] lg:text-md !mb-0">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="absolute top-0 left-0 right-0 bottom-0 lg:rounded-[30px] -z-[1] bg-center bg-no-repeat bg-cover lg:mx-[15px] xl:mx-[30px] dark:hidden"
          style={{
            backgroundImage: "url(/images/landing/features-bg.jpg)",
          }}
        ></div>
      </div>
    </>
  );
};

export default KeyFeatures;
