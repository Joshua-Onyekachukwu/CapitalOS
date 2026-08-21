"use client";

import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  return (
    <>
      <div className="py-[70px] md:py-[90px] lg:py-[100px] xl:py-[120px] 2xl:py-[140px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[25px]">
            {/* Brand */}
            <div className="ltr:lg:-mr-[50px] rtl:lg:-ml-[50px] ltr:xl:-mr-[100px] rtl:xl:-ml-[100px]">
              <Link href="/" className="inline-block max-w-[132px] mb-[20px] md:mb-[23px]">
                <span className="text-xl font-bold text-[#06201b] dark:text-white">
                  Capital<span className="text-lime-500">OS</span>
                </span>
              </Link>
              <p className="!leading-[1.6]">
                AI-powered fundraising operating system that helps founders
                discover investors, manage outreach, and close deals — all from
                one platform.
              </p>
            </div>

            {/* Product */}
            <div className="ltr:lg:pl-[60px] rtl:lg:pr-[60px] ltr:xl:pl-[200px] rtl:xl:pr-[200px]">
              <h3 className="!leading-[1.2] !text-[16px] md:!text-lg !mb-[18px] !font-semibold !text-gray-700 dark:!text-gray-100">
                Product
              </h3>
              <ul>
                <li className="mb-[10px] last:mb-0">
                  <Link href="/#features" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    Features
                  </Link>
                </li>
                <li className="mb-[10px] last:mb-0">
                  <Link href="/#how-it-works" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    How It Works
                  </Link>
                </li>
                <li className="mb-[10px] last:mb-0">
                  <Link href="/signup" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    Get Started
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div className="ltr:lg:pl-[20px] rtl:lg:pr-[20px] ltr:xl:pl-[135px] rtl:xl:pr-[135px]">
              <h3 className="!leading-[1.2] !text-[16px] md:!text-lg !mb-[18px] !font-semibold !text-gray-700 dark:!text-gray-100">
                Resources
              </h3>
              <ul>
                <li className="mb-[10px] last:mb-0">
                  <a href="#" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    Documentation
                  </a>
                </li>
                <li className="mb-[10px] last:mb-0">
                  <a href="#" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    Help Center
                  </a>
                </li>
                <li className="mb-[10px] last:mb-0">
                  <a href="#" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div className="ltr:xl:pl-[80px] rtl:xl:pr-[80px]">
              <h3 className="!leading-[1.2] !text-[16px] md:!text-lg !mb-[18px] !font-semibold !text-gray-700 dark:!text-gray-100">
                Company
              </h3>
              <ul>
                <li className="mb-[10px] last:mb-0">
                  <a href="#" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    About
                  </a>
                </li>
                <li className="mb-[10px] last:mb-0">
                  <a href="#" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
                    Privacy Policy
                  </a>
                </li>
                <li className="mb-[10px] last:mb-0">
                  <a href="#" className="lg:text-[15px] xl:text-[16px] inline-block text-gray-500 dark:text-gray-400 transition-all hover:text-lime-600">
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
        <div className="py-[25px] md:py-[30px] border-t border-[#ebebe0] dark:border-gray-900">
          <div className="text-center lg:text-left">
            <p className="!leading-[1.6]">
              &copy; {new Date().getFullYear()}{" "}
              <span className="text-[#06201b] dark:text-white">Capital OS</span>. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Footer;
