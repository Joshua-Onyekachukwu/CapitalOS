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
    <div className={`rounded-[12px] mb-[12px] last:mb-0 transition-colors ${
      isOpen
        ? "bg-[#f1f5f9] dark:bg-[#0f1629]"
        : "bg-[#f1f5f9]/60 dark:bg-[#0f1629]/60 hover:bg-[#f1f5f9] dark:hover:bg-[#0f1629]"
    }`}>
      <button
        className={`text-[15px] md:text-[16px] px-[20px] md:px-[25px] py-[16px] md:py-[18px] flex items-center justify-between w-full ltr:text-left rtl:text-right font-medium text-[#06201B] dark:text-white`}
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        {item.question}
        <span className="block w-[28px] h-[28px] md:w-[32px] md:h-[32px] rounded-full bg-white dark:bg-dark flex items-center justify-center text-[18px] md:text-[20px] transition-transform duration-200 flex-none ml-[12px]">
          <i
            className={`ri-add-line transition-transform duration-200 ${
              isOpen ? "rotate-45" : ""
            }`}
          ></i>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "opacity-100 max-h-[200px]" : "opacity-0 max-h-0"
        }`}
      >
        <div className="px-[20px] md:px-[25px] pb-[16px] md:pb-[18px] text-[#64748b] text-[14px] md:text-[15px] leading-relaxed">
          {item.answer}
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
      <div className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[90px] 2xl:py-[100px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[30px] md:mb-[40px] lg:mb-[50px] text-center mx-auto md:max-w-[500px]">
            <span className="inline-block font-medium text-[#64748b] rounded-[30px] border border-[#f1f5f9] dark:border-gray-800 py-[5.5px] px-[18px] mb-[12px] md:mb-[15px]">
              FAQ
            </span>
            <h2 className="!text-[#06201B] dark:!text-white md:-tracking-[1px] !font-medium !text-2xl md:!text-3xl lg:!text-4xl !leading-[1.2] !mb-[12px] md:!mb-[15px]">
              Got Questions? We&apos;ve Got Answers
            </h2>
            <p className="md:text-[15px] lg:text-md text-[#64748b]">
              Everything you need to know about using Capital OS to
              fundraise smarter.
            </p>
          </div>

          <div className="mx-auto max-w-[780px]">
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
