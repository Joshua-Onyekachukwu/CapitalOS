"use client";

import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  return (
    <>
      <footer className="bg-[#0D1427] pt-[60px] md:pt-[80px] lg:pt-[100px] xl:pt-[120px]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[25px]">
            <div className="lg:max-w-[380px] xl:max-w-[425px]">
              <Link href="/" className="inline-block">
                <span className="text-xl font-bold text-white">
                  Capital<span className="text-orange-500">OS</span>
                </span>
              </Link>

              <form className="mt-[15px] md:mt-[20px] lg:mt-[35px] relative">
                <label className="text-white block lg:text-[15px] xl:text-md mb-[10px]">
                  Sign up to our news letter
                </label>
                <input
                  type="text"
                  className="block w-full outline-0 border border-[#64748B] bg-[#171E31] rounded-[5px] h-[50px] px-[15px] md:px-[20px] text-sm md:text-base lg:text-[15px] xl:text-md text-white placeholder:text-[#64748B] transition-all focus:border-primary-500"
                  placeholder="Your email"
                />
                <button
                  type="submit"
                  className="absolute ltr:right-[15px] rtl:left-[15px] ltr:md:right-[20px] rtl:md:left-[20px] text-xl top-[38px] md:top-[43px] text-white transition-all hover:text-primary-500"
                >
                  <i className="ri-arrow-right-long-line"></i>
                </button>
              </form>
            </div>

            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[25px] xl:max-w-[520px] ltr:ml-auto rtl:mr-auto">
                <div>
                  <h3 className="!mb-[20px] lg:!mb-[25px] !text-white !text-md md:!text-lg">
                    Quick Links
                  </h3>
                  <ul className="lg:text-[15px] xl:text-md">
                    <li className="mb-[12px] last:mb-0">
                      <Link
                        href="/"
                        className="inline-block text-white transition-all hover:text-primary-500"
                      >
                        Home
                      </Link>
                    </li>
                    <li className="mb-[12px] last:mb-0">
                      <Link
                        href="/#features"
                        className="inline-block text-white transition-all hover:text-primary-500"
                      >
                        Features
                      </Link>
                    </li>
                    <li className="mb-[12px] last:mb-0">
                      <Link
                        href="/#faq"
                        className="inline-block text-white transition-all hover:text-primary-500"
                      >
                        FAQ
                      </Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="!mb-[20px] lg:!mb-[25px] !text-white !text-md md:!text-lg">
                    Get in Touch
                  </h3>
                  <ul className="lg:text-[15px] xl:text-md text-white">
                    <li className="mb-[12px] last:mb-0">
                      Email:{" "}
                      <span className="text-primary-500">
                        hello@capitalos.io
                      </span>
                    </li>
                    <li className="mb-[12px] last:mb-0">
                      <Link
                        href="https://github.com/Joshua-Onyekachukwu/CapitalOS"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white transition-all hover:text-primary-500"
                      >
                        GitHub
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-[60px] md:pt-[80px] lg:pt-[100px] xl:pt-[120px]"></div>

          <div className="border-t border-[#28384F] py-[20px] md:py-[30px] lg:py-[40px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-[25px]">
              <div className="text-center ltr:lg:text-left rtl:lg:text-right">
                <p className="text-white lg:text-[15px] xl:text-md">
                  &copy; {new Date().getFullYear()}{" "}
                  <span className="text-primary-500">Capital OS</span>. All
                  rights reserved.
                </p>
              </div>
              <div className="text-center lg:flex items-center justify-end gap-[15px] md:gap-[20px] lg:text-[15px] xl:text-md">
                <Link
                  href="#"
                  className="transition-all hover:text-primary-500 text-[#64748B] inline-block mt-[10px] lg:mt-0 mx-[7px] lg:mx-0"
                >
                  Terms of Service
                </Link>
                <div className="w-[1px] h-[15px] bg-[#28384F] hidden lg:block"></div>
                <Link
                  href="#"
                  className="transition-all hover:text-primary-500 text-[#64748B] inline-block mt-[10px] lg:mt-0 mx-[7px] lg:mx-0"
                >
                  Privacy Policy
                </Link>
                <div className="w-[1px] h-[15px] bg-[#28384F] hidden lg:block"></div>
                <Link
                  href="#"
                  className="transition-all hover:text-primary-500 text-[#64748B] inline-block mt-[10px] lg:mt-0 mx-[7px] lg:mx-0"
                >
                  Cookie Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
