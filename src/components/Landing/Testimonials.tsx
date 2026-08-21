"use client";

import React from "react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "CEO, TechVenture AI",
    stars: 5,
    quote:
      "Capital OS gave us real-time investor intelligence we never had before. Our team now makes faster, smarter fundraising decisions. It's a total game-changer for startup growth.",
  },
  {
    name: "Marcus Williams",
    role: "Founder, GreenScale",
    stars: 4.5,
    quote:
      "As a founder overseeing fundraising across multiple portfolio companies, Capital OS has been a game changer. I can track investor outreach, monitor pipeline, and ensure nothing slips through.",
  },
  {
    name: "Priya Patel",
    role: "CEO, NeuralPath",
    stars: 4,
    quote:
      "Capital OS completely transformed the way I manage fundraising. I used to juggle multiple spreadsheets for investors, follow-ups, and pipeline tracking. Now everything is in one place.",
  },
];

const Testimonials: React.FC = () => {
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="lg:max-w-[746px] mb-[30px] md:mb-[40px] lg:mb-[40px] xl:mb-0">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
            TESTIMONIAL
          </span>
          <h2 className="!mb-[13px] md:!mb-[16px] lg:!mb-[20px] !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            <span className="font-semibold italic">Trusted</span> by Founders
            Who Get Results — See What Professionals Are{" "}
            <span className="font-semibold italic">Saying</span> About Capital
            OS
          </h2>
          <p className="text-base md:text-[15px] lg:text-md -tracking-[0.16px] md:max-w-[550px]">
            At Capital OS, we believe the best proof of our platform's value
            comes from the professionals who use it every day.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[25px] xl:-mt-[272px]">
          {testimonials.map((item, index) => (
            <div key={index}>
              <div
                className={`${index === 0 ? "xl:mt-[580px]" : index === 1 ? "xl:mt-[290px]" : ""} bg-[#F4F2F0] dark:bg-[#06201b] rounded-[15px] p-[20px] md:p-[25px] lg:p-[30px] xl:py-[40px] xl:sticky top-[100px]`}
              >
                <div className="leading-none mb-[14px] md:mb-[16px] lg:mb-[18px] xl:mb-[22px] flex items-center text-orange-400 text-md lg:text-lg xl:text-[20px] gap-[2px] lg:gap-[4px]">
                  {Array.from({ length: Math.floor(item.stars) }).map(
                    (_, i) => (
                      <i key={i} className="ri-star-fill"></i>
                    )
                  )}
                  {item.stars % 1 !== 0 && (
                    <i className="ri-star-half-line"></i>
                  )}
                </div>
                <p className="text-black dark:text-white font-light !leading-[1.6] -tracking-[.3px] !text-md md:!text-lg">
                  {item.quote}
                </p>
                <div className="mt-[16px] md:mt-[18px] lg:mt-[22px] xl:mt-[25px]">
                  <span className="block font-bold uppercase text-xs text-black dark:text-white tracking-[1.8px] mb-[5px]">
                    {item.name}
                  </span>
                  <span className="block -tracking-[0.14px]">{item.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
