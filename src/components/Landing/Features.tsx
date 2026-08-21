"use client";

import React, { useState } from "react";
import Image from "next/image";

const Features = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const accordionData = [
    {
      title: "Investor Discovery",
      content: [
        {
          type: "paragraph" as const,
          text: "AI searches across databases, web sources, and public records to find investors that match your stage, sector, and geography.",
        },
        {
          type: "list" as const,
          items: [
            "Multi-layer scoring with SQL filters, embeddings, and reasoning",
            "Explains why each investor matters to your specific startup",
            "Tracks investor activity and recent investment history",
          ],
        },
      ],
    },
    {
      title: "AI Matching & Scoring",
      content: [
        {
          type: "paragraph" as const,
          text: "Multi-layer matching produces ranked investor lists with clear explanations. SQL filters narrow by stage, sector, and geography. Semantic embeddings find investors whose thesis aligns with your startup. A reranker refines the top candidates.",
        },
      ],
    },
    {
      title: "Personalized Outreach",
      content: [
        {
          type: "paragraph" as const,
          text: "AI drafts emails tailored to each investor's thesis, portfolio, and recent activity. You review, edit, and approve each one before anything is sent. Every email is personalized based on investor intelligence.",
        },
      ],
    },
    {
      title: "Fundraising Pipeline",
      content: [
        {
          type: "paragraph" as const,
          text: "Visual Kanban board to move investors from discovery through qualification, outreach, meetings, and close — all in one view. Track every conversation and never lose sight of an opportunity.",
        },
      ],
    },
    {
      title: "Startup Profile & Deck Analysis",
      content: [
        {
          type: "paragraph" as const,
          text: "Upload your pitch deck or describe your startup. AI extracts your profile, identifies what is missing, and asks targeted questions to fill the gaps. Most founders have a complete profile within 10 minutes.",
        },
      ],
    },
    {
      title: "AI Copilot",
      content: [
        {
          type: "paragraph" as const,
          text: "Your personal fundraising assistant that helps you craft messages, research investors, and strategize your approach. Ask questions, get recommendations, and make informed decisions faster.",
        },
      ],
    },
  ];

  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1450px] 2xl:max-w-[1645px] mx-auto px-[12px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
          <div>
            <span className="inline-block border border-[#EBEBEB] dark:border-gray-800 rounded-[30px] mb-[12px] md:mb-[15px] lg:mb-[20px] py-[4px] md:py-[7px] px-[15px] md:px-[20px] text-black dark:text-white">
              Powerful features
            </span>
            <h2 className="!mb-[45px] !text-[26px] md:!text-3xl lg:!text-4xl">
              Everything You Need to Fundraise Smarter
            </h2>
            <div className="relative w-full aspect-[4/3] rounded-[15px] overflow-hidden bg-[#ebebe0]">
              <Image
                src="/images/landing/collaboration.jpg"
                alt="Team collaborating on fundraising strategy"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>

          <div className="toc-accordion" id="tablesOfContentAccordion">
            {accordionData.map((item, index) => (
              <div
                key={index}
                className="toc-accordion-item mb-[15px] md:mb-[20px] lg:mb-[25px] last:mb-0 bg-[#F9FAFB] dark:bg-[#0a0e19] rounded-[15px]"
              >
                <button
                  className={`toc-accordion-button ${
                    openIndex === index ? "open" : ""
                  } text-md md:text-lg lg:text-[22px] xl:text-xl font-bold px-[15px] md:px-[20px] lg:px-[25px] xl:px-[30px] py-[14px] md:py-[18px] lg:py-[20px] xl:py-[22px] flex items-center w-full ltr:text-left rtl:text-right relative text-black dark:text-white`}
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  aria-expanded={openIndex === index}
                  aria-controls={`collapse-${index}`}
                >
                  {item.title}
                  <span className="text-orange-500 text-[22px]">
                    <i
                      className={
                        openIndex === index
                          ? "ri-arrow-up-s-line"
                          : "ri-arrow-down-s-line"
                      }
                    ></i>
                  </span>
                </button>
                <div
                  id={`collapse-${index}`}
                  className={`toc-accordion-collapse lg:text-[15px] xl:text-md -mt-[5px] px-[15px] md:px-[20px] lg:px-[25px] xl:px-[30px] pb-[15px] md:pb-[18px] lg:pb-[22px] ${
                    openIndex === index ? "" : "hidden"
                  }`}
                  role="region"
                  aria-labelledby={`button-${index}`}
                >
                  {item.content.map((contentItem, contentIndex) => {
                    if (contentItem.type === "paragraph") {
                      return <p key={contentIndex}>{contentItem.text}</p>;
                    } else if (contentItem.type === "list") {
                      return (
                        <ul
                          key={contentIndex}
                          className="list-disc list-inside"
                        >
                          {contentItem.items?.map((listItem, i) => (
                            <li key={i} className="mb-[10px] last:mb-0">
                              {listItem}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Features;
