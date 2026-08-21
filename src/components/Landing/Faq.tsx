"use client";

import React, { useState } from "react";

interface AccordionItem {
  question: string;
  answer: string;
}

const AccordionItem: React.FC<{
  item: AccordionItem;
  isOpen: boolean;
  onClick: () => void;
}> = ({ item, isOpen, onClick }) => {
  return (
    <div className="bg-[#ebebe0] dark:bg-[#0a0e19] rounded-[15px] mb-[20px] last:mb-0">
      <button
        className={`text-[16px] md:text-lg lg:text-[20px] px-[20px] md:px-[30px] py-[20px] md:py-[25px] flex items-center justify-between w-full ltr:text-left rtl:text-right font-medium relative text-[#06201B] dark:text-white ${
          isOpen ? "open" : ""
        }`}
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        {item.question}
        <span className="block w-[35px] h-[35px] md:w-[44px] md:h-[44px] rounded-full bg-white dark:bg-dark flex items-center justify-center text-[24px] md:text-[28px] transition-transform duration-200 flex-none">
          <i
            className={`ri-arrow-down-s-line transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          ></i>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "opacity-100 -mt-[5px] md:-mt-[10px]" : "opacity-0 hidden"
        }`}
      >
        <div className="px-[20px] md:px-[30px] pb-[20px] md:pb-[30px] text-[#7a857d]">
          <p>{item.answer}</p>
        </div>
      </div>
    </div>
  );
};

const Faq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqItems: AccordionItem[] = [
    {
      question: "What is Capital OS?",
      answer:
        "Capital OS is an AI-powered fundraising operating system that helps founders discover relevant investors, understand their investment thesis, prepare personalized outreach, and manage the entire fundraising process from one platform.",
    },
    {
      question: "How does the AI investor matching work?",
      answer:
        "We use a multi-layer approach: SQL filters narrow by stage, sector, and geography. Then semantic embeddings find investors whose thesis aligns with your startup. A reranker refines the top candidates, and a reasoning model produces a scored, explained ranking.",
    },
    {
      question: "Do investors get contacted automatically?",
      answer:
        "No. Every first-contact email requires your explicit approval. AI drafts personalized emails based on investor intelligence, but you review, edit, and approve each one before it is sent. You stay in control of all outreach.",
    },
    {
      question: "What information do I need to get started?",
      answer:
        "Just upload your pitch deck or describe your startup. Our AI will extract your profile, identify what is missing, and ask targeted questions to fill the gaps. Most founders have a complete profile within 10 minutes.",
    },
    {
      question: "Is my data secure?",
      answer:
        "Yes. We use Supabase with Row Level Security, encrypted storage, and server-side API keys. Your startup data, investor notes, and emails are fully isolated and never exposed to other users.",
    },
  ];

  return (
    <>
      <div className="py-[70px] md:py-[90px] lg:py-[100px] xl:py-[120px] 2xl:py-[140px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] xl:mb-[60px] text-center mx-auto md:max-w-[415px]">
            <span className="inline-block font-medium text-[#7a857d] rounded-[30px] border border-[#ebebe0] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
              Frequently Asked Questions
            </span>
            <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
              Got Questions? We&apos;ve Got Answers
            </h2>
            <p className="md:text-[15px] lg:text-md text-[#7a857d]">
              Everything you need to know about using Capital OS to
              fundraise smarter.
            </p>
          </div>

          <div className="mx-auto max-w-[848px]">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={index}
                item={item}
                isOpen={openIndex === index}
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Faq;
