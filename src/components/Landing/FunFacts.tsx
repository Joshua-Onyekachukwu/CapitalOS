"use client";

import React from "react";
import Link from "next/link";

interface FunFactItem {
  id: number;
  value: string;
  label: string;
}

const FunFacts: React.FC = () => {
  const funFacts: FunFactItem[] = [
    {
      id: 1,
      value: "10+",
      label: "Integrated Data Sources",
    },
    {
      id: 2,
      value: "24/7",
      label: "Live Market Updates",
    },
    {
      id: 3,
      value: "95%",
      label: "Faster Reporting",
    },
    {
      id: 4,
      value: "#1",
      label: "Rated Fundraising App",
    },
  ];

  return (
    <>
      <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="mb-[60px] md:mb-[80px] lg:mb-[100px] xl:mb-[120px] text-center mx-auto lg:max-w-[872px]">
            <h2 className="!mb-0 !text-[26px] md:!text-3xl lg:!text-4xl">
              Ready To Transform Your Fundraising?
            </h2>

            <Link
              href="/signup"
              className="inline-block text-center bg-orange-500 border border-orange-500 rounded-[50px] text-white font-medium md:text-[15px] lg:text-md xl:text-[17px] py-[8.5px] px-[19px] transition-all hover:bg-primary-500 hover:border-primary-500 mt-[20px] md:mt-[30px] lg:mt-[40px]"
            >
              <span className="inline-block relative ltr:pr-[27px] rtl:pl-[27px]">
                Start Free Trial - No Credit Card Needed{" "}
                <i className="ri-arrow-right-long-line text-[20px] absolute top-1/2 -translate-y-1/2 ltr:-right-[2px] rtl:-left-[2px]"></i>
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-[25px]">
            {funFacts.map((fact) => (
              <div key={fact.id} className="text-center lg:-mt-[5px]">
                <div className="leading-none text-black dark:text-white font-bold text-[38px] md:text-[60px] lg:text-[80px] xl:text-[90px] mb-[8px] md:mb-[12px]">
                  {fact.value}
                </div>
                <span className="block lg:text-md xl:text-lg">
                  {fact.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default FunFacts;
