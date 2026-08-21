"use client";

import React from "react";
import Link from "next/link";

const HeroBanner: React.FC = () => {
  return (
    <>
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="bg-[#06201b] rounded-[20px] md:rounded-[30px] py-[60px] px-[20px] md:py-[80px] md:px-[40px] lg:py-[90px] lg:px-[50px] xl:py-[75px] xl:px-[110px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[30px] items-center">
            <div>
              <h1 className="!font-medium !text-[#ebebe0] !text-4xl md:!text-[46px] lg:!text-[52px] xl:!text-[58px] !leading-[1.15] md:-tracking-[1.5px] !mb-[15px] lg:!mb-[20px]">
                Your AI{" "}
                <span className="italic text-lime-500">Fundraising</span>{" "}
                Department
              </h1>

              <p className="text-[#ebebe0]/80 md:text-[15px] lg:text-[17px] xl:text-lg xl:max-w-[420px] leading-relaxed">
                Find the right investors, understand why they are relevant,
                reach out intelligently, and manage the entire fundraising
                process — all from one place.
              </p>

              <div className="mt-[22px] md:mt-[30px] lg:mt-[40px]">
                <Link
                  href="/signup"
                  className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 ltr:mr-[15px] rtl:ml-[15px]"
                >
                  Start Fundraising
                </Link>
                <Link
                  href="/#how-it-works"
                  className="inline-block font-medium rounded-[7px] border border-lime-500 text-base text-lime-500 py-[8.5px] md:py-[10.5px] px-[22px] md:px-[25px] transition-all hover:text-black hover:bg-lime-500 hover:border-lime-500"
                >
                  See How It Works
                </Link>
              </div>

              <div className="mt-[22px] md:mt-[35px] lg:mt-[50px] xl:mt-[70px] flex flex-wrap gap-[15px] text-[#ebebe0]/50 text-[13px] md:text-[14px]">
                <span className="flex items-center gap-[6px]">
                  <i className="ri-shield-check-fill text-lime-500"></i>
                  No credit card required
                </span>
                <span className="flex items-center gap-[6px]">
                  <i className="ri-time-fill text-lime-500"></i>
                  Setup in under 10 minutes
                </span>
                <span className="flex items-center gap-[6px]">
                  <i className="ri-lock-fill text-lime-500"></i>
                  Your data stays private
                </span>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="text-center ltr:lg:-ml-[50px] rtl:lg:-mr-[50px] ltr:xl:-ml-[100px] rtl:xl:-mr-[100px]">
              <div className="inline-block w-full max-w-[400px] lg:max-w-none">
                {/* Mini dashboard card */}
                <div className="bg-[#0a3d2e] rounded-[20px] p-[20px] md:p-[25px]">
                  {/* Header bar */}
                  <div className="flex items-center justify-between mb-[16px]">
                    <div className="flex items-center gap-[8px]">
                      <div className="w-[8px] h-[8px] rounded-full bg-red-400"></div>
                      <div className="w-[8px] h-[8px] rounded-full bg-yellow-400"></div>
                      <div className="w-[8px] h-[8px] rounded-full bg-green-400"></div>
                    </div>
                    <div className="text-[#ebebe0]/20 text-[11px]">CapitalOS Dashboard</div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-[10px] mb-[16px]">
                    {[
                      { label: "Investors", value: "127", color: "bg-lime-500/20" },
                      { label: "Sent", value: "34", color: "bg-blue-500/20" },
                      { label: "Replies", value: "12", color: "bg-purple-500/20" },
                    ].map((stat) => (
                      <div key={stat.label} className={`${stat.color} rounded-[10px] p-[12px] text-center`}>
                        <div className="text-[#ebebe0]/60 text-[10px] mb-[4px]">{stat.label}</div>
                        <div className="text-[#ebebe0] font-bold text-[18px]">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mini pipeline */}
                  <div className="bg-[#06201b] rounded-[10px] p-[14px]">
                    <div className="text-[#ebebe0]/40 text-[10px] mb-[10px] uppercase tracking-wider font-medium">
                      Pipeline
                    </div>
                    <div className="flex gap-[6px]">
                      {["Discovered", "Qualified", "Contacted", "Replied", "Meeting"].map((stage, i) => (
                        <div key={stage} className="flex-1 text-center">
                          <div className={`h-[3px] rounded-full mb-[6px] ${
                            i < 3 ? "bg-lime-500" : i === 3 ? "bg-lime-500/50" : "bg-[#ebebe0]/10"
                          }`}></div>
                          <div className="text-[#ebebe0]/30 text-[8px] md:text-[9px]">{stage}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroBanner;
