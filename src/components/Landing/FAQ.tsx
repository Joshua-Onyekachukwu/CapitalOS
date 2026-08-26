"use client";

import React, { useState } from "react";
import Image from "next/image";

const faqData = [
  {
    question: "What is Capital OS and who is it for?",
    answer:
      "Capital OS is an AI-powered fundraising operating system designed to help founders discover relevant investors, understand their investment thesis, prepare personalized outreach, and manage the entire fundraising process from one platform.",
  },
  {
    question: "Do I need technical experience to use Capital OS?",
    answer:
      "Not at all. Capital OS is designed for founders, not engineers. Simply upload your pitch deck or describe your startup, and our AI handles the rest, from investor discovery to email drafting.",
  },
  {
    question: "How does the AI investor matching work?",
    answer:
      "We use a multi-layer approach: SQL filters narrow by stage, sector, and geography. Then semantic embeddings find investors whose thesis aligns with your startup. A reranker refines the top candidates, and a reasoning model produces a scored, explained ranking.",
  },
  {
    question: "What's included in the Professional plan?",
    answer:
      "The Professional plan includes unlimited investor discovery, advanced AI matching and scoring, personalized outreach at scale, full analytics and reporting, priority support, and access to all future features.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes! All plans come with a 14-day free trial. No credit card required. You'll have full access to all features during your trial period.",
  },
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] relative z-[1]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="text-center mb-[30px] md:mb-[40px] lg:mb-[50px]">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
            FAQ
          </span>
          <h2 className="!mb-0 !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            Got <span className="font-semibold italic">Questions?</span>{" "}
            We&apos;ve Got <span className="font-semibold italic">Answers</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px] items-center">
          <div className="relative ltr:xl:pr-[15px] rtl:xl:pl-[15px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[25px]">
              <div>
                <div className="relative rounded-[10px] overflow-hidden" style={{ aspectRatio: "3/4" }}>
                  <Image
                    src="/images/real-estate-agent/faq-custom-1.jpg"
                    className="object-cover w-full h-full"
                    alt="faq-image"
                    fill
                    sizes="(max-width: 639px) 100vw, 50vw"
                  />
                </div>
              </div>
              <div>
                <div className="lg:mt-[110px] relative rounded-[10px] overflow-hidden" style={{ aspectRatio: "3/4" }}>
                  <Image
                    src="/images/real-estate-agent/faq-custom-2.jpg"
                    className="object-cover w-full h-full"
                    alt="faq-image"
                    fill
                    sizes="(max-width: 639px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>
            <div className="max-w-[203px] absolute top-[15px] lg:top-0 xl:top-[35px] ltr:right-[15px] rtl:left-[15px] ltr:lg:right-0 rtl:lg:left-0 ltr:xl:right-[45px] rtl:xl:left-[45px]">
              <Image
                src="/images/real-estate-agent/union2.png"
                className="inline-block"
                alt="union"
                width={203}
                height={100}
              />
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 px-[20px]">
                <h3 className="!mb-[8px] italic !leading-none !text-[30px] md:!text-4xl -tracking-[1.08px] !text-black">
                  57K+
                </h3>
                <span className="block uppercase font-bold tracking-[1.95px] text-xs md:text-sm text-[#8F3E13]">
                  Investors
                </span>
              </div>
            </div>
            <div className="max-w-[203px] absolute bottom-[15px] lg:bottom-0 xl:bottom-[35px] ltr:left-[15px] rtl:right-[15px] ltr:lg:left-0 rtl:lg:right-0 ltr:xl:left-[155px] rtl:xl:right-[155px]">
              <Image
                src="/images/real-estate-agent/union1.png"
                className="inline-block"
                alt="union"
                width={203}
                height={100}
              />
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 px-[20px]">
                <h3 className="!mb-[8px] italic !leading-none !text-[30px] md:!text-4xl -tracking-[1.08px] !text-white">
                  SEC
                </h3>
                <span className="block uppercase font-bold tracking-[1.95px] text-xs md:text-sm text-white">
                  Sourced
                </span>
              </div>
            </div>
          </div>
          <div className="ltr:xl:pl-[30px] rtl:xl:pr-[30px]">
            {faqData.map((item, index) => (
              <div
                key={index}
                className={`border-b border-[#7D6B61]/10 dark:border-white/10 pb-[20px] md:pb-[25px] xl:pb-[30px] mb-[20px] md:mb-[25px] xl:mb-[30px] last:mb-0 ${index === 0 ? 'pt-[10px]' : ''}`}
              >
                <button
                  className="text-black dark:text-white font-normal text-lg md:text-[20px] lg:text-[22px] xl:text-xl -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] flex items-center justify-between w-full ltr:text-left rtl:text-right"
                  type="button"
                  onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                >
                  {`${index + 1}. ${item.question}`}
                  <span className="block leading-none text-[20px] md:text-xl flex-none ml-[10px]">
                    <i
                      className={`ri-arrow-down-s-line transition-transform duration-200 ${openIndex === index ? "rotate-180" : ""}`}
                    ></i>
                  </span>
                </button>
                <div
                  className={`mt-[12px] md:mt-[15px] text-base md:text-[15px] lg:text-md -tracking-[0.16px] ${openIndex === index ? "" : "hidden"}`}
                >
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute top-0 left-0 right-0 bottom-0 -z-[1] bg-[#E9DFDA] dark:bg-[#06201b] lg:rounded-t-[30px] lg:mx-[10px] xl:mx-[20px]"></div>
    </div>
  );
};

export default FAQ;
