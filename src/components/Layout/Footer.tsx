"use client";

import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  return (
    <>
      <div className="py-[60px] md:py-[70px] lg:py-[80px] xl:py-[90px] 2xl:py-[100px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[25px]">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="inline-block mb-[15px] md:mb-[18px]">
                <span className="text-xl font-bold text-[#0f172a] dark:text-white">
                  Capital<span className="text-primary-500">OS</span>
                </span>
              </Link>
              <p className="text-[14px] text-gray-500 !leading-[1.6] max-w-[280px]">
                AI-powered fundraising operating system that helps founders
                discover investors, manage outreach, and close deals — all from
                one platform.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="!text-[14px] md:!text-[15px] !mb-[15px] !font-semibold !text-[#0f172a] dark:!text-white uppercase tracking-wider">
                Product
              </h3>
              <ul className="space-y-[10px]">
                <li>
                  <Link href="/#features" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Log In
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="!text-[14px] md:!text-[15px] !mb-[15px] !font-semibold !text-[#0f172a] dark:!text-white uppercase tracking-wider">
                Resources
              </h3>
              <ul className="space-y-[10px]">
                <li>
                  <Link href="/dashboard/copilot" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    AI Copilot
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/investors/discover" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Discover Investors
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/pipeline" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Pipeline
                  </Link>
                </li>
                <li>
                  <a href="https://github.com/Joshua-Onyekachukwu/CapitalOS" target="_blank" rel="noopener noreferrer" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="!text-[14px] md:!text-[15px] !mb-[15px] !font-semibold !text-[#0f172a] dark:!text-white uppercase tracking-wider">
                Company
              </h3>
              <ul className="space-y-[10px]">
                <li>
                  <a href="#" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[14px] text-gray-500 transition-all hover:text-primary-600">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="py-[20px] md:py-[25px] border-t border-[#f1f5f9] dark:border-gray-900">
          <div className="flex flex-col md:flex-row items-center justify-between gap-[10px]">
            <p className="text-[13px] text-gray-400 !mb-0">
              &copy; {new Date().getFullYear()}{" "}
              <span className="text-[#0f172a] dark:text-white font-medium">Capital OS</span>. All rights
              reserved.
            </p>
            <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
              Built with AI. Controlled by founders.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Footer;
