import React from "react";
import Link from "next/link";
import Image from "next/image";

const capabilities = [
  {
    number: "01",
    title: "Investor Intelligence",
    description:
      "AI researches investors across stage, sector, geography, and check size — then explains why each one matters to your specific startup.",
  },
  {
    number: "02",
    title: "Personalized Outreach",
    description:
      "Emails drafted from each investor's thesis, portfolio, and recent activity. You review, edit, and approve before anything is sent.",
  },
  {
    number: "03",
    title: "Visual Pipeline",
    description:
      "Every investor tracked from first discovery through meeting to close, on a single board you can act on.",
  },
];

export default function ProblemStatement() {
  return (
    <section>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        {/* Top: Asymmetric hero — headline + photo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[30px] lg:gap-[40px] items-start mb-[60px] md:mb-[80px] lg:mb-[100px]">
          {/* Left: Headline + explanation */}
          <div className="lg:col-span-7">
            <p className="text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.12em] text-[#7a857d] !mb-[16px] md:!mb-[20px]">
              About Capital OS
            </p>

            <h2 className="!text-[#06201B] dark:!text-white !font-medium !text-[28px] md:!text-[36px] lg:!text-[42px] !leading-[1.1] !mb-[20px] md:!mb-[24px]">
              Fundraising doesn&apos;t have
              <br className="hidden md:block" />
              {" "}to be a guessing game.
            </h2>

            <p className="text-[#7a857d] text-[15px] md:text-[16px] lg:text-[17px] leading-[1.7] max-w-[520px] !mb-[28px] md:!mb-[32px]">
              Capital OS is the operating system behind modern fundraising.
              It finds the right investors, prepares personalized outreach,
              and manages every conversation — so you can focus on the part
              that matters: building relationships.
            </p>

            <Link
              href="/signup"
              className="inline-block font-medium rounded-[7px] bg-[#06201b] text-white py-[11px] md:py-[12px] px-[24px] md:px-[28px] text-[14px] md:text-[15px] transition-all hover:bg-lime-500 hover:text-black"
            >
              Start Fundraising
            </Link>
          </div>

          {/* Right: Photography */}
          <div className="lg:col-span-5 lg:mt-[10px]">
            <div className="relative aspect-[4/5] rounded-[12px] overflow-hidden">
              <Image
                src="/images/landing/hero-founder.jpg"
                alt="Startup founder collaborating with team on fundraising strategy"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 400px"
              />
            </div>
          </div>
        </div>

        {/* Bottom: Three capabilities — clean, editorial */}
        <div className="border-t border-[#ebebe0] dark:border-gray-800">
          {capabilities.map((cap, index) => (
            <div
              key={cap.number}
              className={`grid grid-cols-1 md:grid-cols-12 gap-[16px] md:gap-[30px] py-[28px] md:py-[35px] ${
                index < capabilities.length - 1
                  ? "border-b border-[#ebebe0] dark:border-gray-800"
                  : ""
              }`}
            >
              {/* Number */}
              <div className="md:col-span-1">
                <span className="text-[12px] font-mono text-[#7a857d]">
                  {cap.number}
                </span>
              </div>

              {/* Title */}
              <div className="md:col-span-3">
                <h3 className="!text-[#06201B] dark:!text-white !font-semibold !text-[16px] md:!text-[17px] !mb-0">
                  {cap.title}
                </h3>
              </div>

              {/* Description */}
              <div className="md:col-span-8">
                <p className="text-[#7a857d] text-[14px] md:text-[15px] leading-[1.7] !mb-0">
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
