"use client";

import React, { useState } from "react";
import Image from "next/image";

const Faqs = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const faqData = [
    {
      id: 1,
      question: "What is Capital OS?",
      answer:
        "Capital OS is an AI-powered fundraising operating system that helps founders discover relevant investors, understand their investment thesis, prepare personalized outreach, and manage the entire fundraising process from one platform.",
    },
    {
      id: 2,
      question: "How does the AI investor matching work?",
      answer:
        "We use a multi-layer approach: SQL filters narrow by stage, sector, and geography. Then semantic embeddings find investors whose thesis aligns with your startup. A reranker refines the top candidates, and a reasoning model produces a scored, explained ranking.",
    },
    {
      id: 3,
      question: "Do investors get contacted automatically?",
      answer:
        "No. Every first-contact email requires your explicit approval. AI drafts personalized emails based on investor intelligence, but you review, edit, and approve each one before it is sent. You stay in control of all outreach.",
    },
    {
      id: 4,
      question: "What information do I need to get started?",
      answer:
        "Just upload your pitch deck or describe your startup. Our AI will extract your profile, identify what is missing, and ask targeted questions to fill the gaps. Most founders have a complete profile within 10 minutes.",
    },
    {
      id: 5,
      question: "Is my data secure?",
      answer:
        "Yes. We use Supabase with Row Level Security, encrypted storage, and server-side API keys. Your startup data, investor notes, and emails are fully isolated and never exposed to other users.",
    },
    {
      id: 6,
      question: "Do you offer onboarding support?",
      answer:
        "Absolutely! Our onboarding specialists will guide you through setup and ensure a smooth transition. We're here to answer any questions along the way.",
    },
  ];

  return (
    <>
      <div className="pt-[60px] md:pt-[80px] lg:pt-[100px] xl:pt-[120px]" id="faq">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[25px]">
            <div className="lg:col-span-1">
              <span className="inline-block border border-[#EBEBEB] dark:border-gray-800 rounded-[30px] mb-[12px] md:mb-[15px] lg:mb-[20px] py-[4px] md:py-[7px] px-[15px] md:px-[20px] text-black dark:text-white">
                FAQ
              </span>
              <h2 className="!mb-[15px] lg:!mb-[50px] xl:!mb-[85px] !text-[26px] md:!text-3xl lg:!text-4xl">
                Have Questions? We are Glad You Asked
              </h2>
              <Image
                src="/images/landing/hero-founder.jpg"
                className="mb-[15px] md:mb-[20px] lg:mb-[25px] rounded-[15px]"
                alt="faq-image"
                width={424}
                height={308}
              />
              <p className="lg:text-[15px] xl:text-md">
                Our support team answers 95% of inquiries within 30 minutes
                during business hours.
              </p>
            </div>

            <div className="lg:col-span-2 toc-accordion">
              <div className="xl:max-w-[760px] ltr:xl:ml-auto rtl:xl:mr-auto">
                {faqData.map((item, index) => (
                  <div
                    key={index}
                    className="toc-accordion-item mb-[20px] last:mb-0 bg-[#F9FAFB] dark:bg-[#0a0e19] rounded-[15px]"
                  >
                    <button
                      className={`toc-accordion-button ${
                        openIndex === index ? "open" : ""
                      } text-base md:text-md lg:text-lg font-bold px-[15px] md:px-[20px] lg:px-[25px] xl:px-[30px] py-[14px] md:py-[18px] lg:py-[20px] flex items-center w-full ltr:text-left rtl:text-right relative text-black dark:text-white`}
                      type="button"
                      onClick={() => setOpenIndex(index)}
                      aria-expanded={openIndex === index}
                      aria-controls={`collapse-${index}`}
                    >
                      {item.question}
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
                      className={`toc-accordion-collapse -mt-[2px] px-[15px] md:px-[20px] lg:px-[25px] xl:px-[30px] pb-[15px] md:pb-[18px] lg:pb-[22px] ${
                        openIndex === index ? "" : "hidden"
                      }`}
                      role="region"
                      aria-labelledby={`button-${index}`}
                    >
                      <p>{item.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Faqs;
