"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const Footer: React.FC = () => {
  return (
    <>
      <footer className="pt-[60px] md:pt-[80px] lg:pt-[100px] xl:pt-[120px] lg:mb-[10px] xl:mb-[20px] relative z-[1]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[25px]">
            <div className="lg:max-w-[250px] xl:max-w-[330px] md:col-span-2 lg:col-span-1">
              <Link href="/" className="inline-block mb-[15px] lg:mb-[85px]">
                <span className="text-xl font-bold text-[#06201b] dark:text-white">
                  Capital<span className="text-lime-500">OS</span>
                </span>
              </Link>
              <p className="!leading-[1.5] font-light text-[#89837F] -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] text-lg md:text-[20px] lg:text-[22px] xl:text-xl">
                The AI fundraising platform for startup founders.
              </p>
            </div>
            <div className="ltr:lg:-ml-[35px] rtl:lg:-mr-[35px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-[25px]">
                <div>
                  <h3 className="!font-normal !text-black dark:!text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[18px] md:!mb-[22px] lg:!mb-[25px]">
                    Important Links
                  </h3>
                  <ul className="font-medium -tracking-[0.14px]">
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/#about"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        About
                      </Link>
                    </li>
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/#features"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        Features
                      </Link>
                    </li>
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/#how-it-works"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        How It Works
                      </Link>
                    </li>
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/#pricing"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        Pricing
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="!font-normal !text-black dark:!text-white -tracking-[.2px] md:-tracking-[.3px] lg:-tracking-[.4px] !text-lg md:!text-[20px] lg:!text-[22px] xl:!text-xl !mb-[18px] md:!mb-[22px] lg:!mb-[25px]">
                    Quick Links
                  </h3>
                  <ul className="font-medium -tracking-[0.14px]">
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/#faq"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        FAQ
                      </Link>
                    </li>
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/signup"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        Get Started
                      </Link>
                    </li>
                    <li className="mb-[12px] md:mb-[15px] last:mb-0">
                      <Link
                        href="/login"
                        className="text-black dark:text-white transition-all hover:text-[#D15616]"
                      >
                        Log In
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <h3 className="!mb-[20px] md:!mb-[30px] !leading-none !text-black dark:!text-white !font-semibold !text-xl md:!text-2xl xl:!text-4xl -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px] underline">
                <a
                  href="mailto:hello@capitalos.io"
                  className="text-black dark:text-white transition-all hover:text-[#D15616]"
                >
                  hello@capitalos.io
                </a>
              </h3>
              <div className="mt-[25px] md:mt-[35px] xl:mt-[60px] text-[20px] leading-none ltr:-ml-[5px] rtl:-mr-[5px]">
                <a
                  href="https://github.com/Joshua-Onyekachukwu/CapitalOS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[#D15616] transition-all hover:text-[#06201b] dark:hover:text-white ltr:mr-[5px] ltr:md:mr-[10px] rtl:ml-[5px] rtl:md:ml-[10px]"
                >
                  <i className="ri-github-fill"></i>
                </a>
                <a
                  href="#"
                  target="_blank"
                  className="inline-block text-[#D15616] transition-all hover:text-[#06201b] dark:hover:text-white ltr:mr-[5px] ltr:md:mr-[10px] rtl:ml-[5px] rtl:md:ml-[10px]"
                >
                  <i className="ri-twitter-x-fill"></i>
                </a>
                <a
                  href="#"
                  target="_blank"
                  className="inline-block text-[#D15616] transition-all hover:text-[#06201b] dark:hover:text-white ltr:mr-[5px] ltr:md:mr-[10px] rtl:ml-[5px] rtl:md:ml-[10px]"
                >
                  <i className="ri-linkedin-fill"></i>
                </a>
              </div>
            </div>
          </div>
          <div className="pt-[60px] md:pt-[80px] lg:pt-[100px] xl:pt-[120px]"></div>
          <div className="text-center py-[20px] md:py-[25px] lg:py-[30px] border-t border-[#06201b]/10 dark:border-white/10">
            <p className="font-medium -tracking-[0.14px]">
              © <span className="text-[#D15616]">Capital OS</span>. All rights
              reserved. Built for founders, by founders.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
