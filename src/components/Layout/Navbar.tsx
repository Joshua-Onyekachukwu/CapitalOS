"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
];

const Navbar: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    const elementId = document.getElementById("navbar");
    const handleScroll = () => {
      if (window.scrollY > 80) {
        elementId?.classList.add("is-sticky");
      } else {
        elementId?.classList.remove("is-sticky");
      }
    };

    document.addEventListener("scroll", handleScroll);
    return () => {
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const [isActiveMobileMenu, setActiveMobileMenu] = useState<boolean>(true);

  const handleToggleMobileMenu = (): void => {
    setActiveMobileMenu(!isActiveMobileMenu);
  };

  return (
    <>
      <div
        className="landing-navbar fixed top-0 right-0 left-0 transition-all h-auto z-[5] py-[20px] md:py-[30px] lg:py-[40px] xl:py-[60px]"
        id="navbar"
      >
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1345px] 2xl:max-w-[1705px] mx-auto px-[12px]">
          <div className="inner-navbar bg-white dark:bg-[#1c1c1c] rounded-[15px] py-[15px] md:py-[18px] px-[15px] md:px-[25px] lg:px-[30px] transition-all">
            <div className="flex items-center relative flex-wrap lg:flex-nowrap justify-between lg:justify-start">
              <Link href="/" className="inline-block w-[150px] ltr:mr-[15px] rtl:ml-[15px]">
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  Capital<span className="text-gray-900 dark:text-white">OS</span>
                </span>
              </Link>

              <button
                type="button"
                className="inline-block relative leading-none lg:hidden"
                onClick={handleToggleMobileMenu}
                aria-label="Toggle menu"
              >
                <span className="h-[3px] w-[30px] my-[5px] block bg-dark dark:bg-white"></span>
                <span className="h-[3px] w-[30px] my-[5px] block bg-dark dark:bg-white"></span>
                <span className="h-[3px] w-[30px] my-[5px] block bg-dark dark:bg-white"></span>
              </button>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center grow basis-full">
                <ul className="flex mx-auto flex-row gap-[30px] xl:gap-[40px]">
                  {menuItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`font-medium transition-all hover:text-primary-600 ${
                          pathname === item.href ? "text-primary-600" : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-[12px]">
                  <Link
                    href="/login"
                    className="inline-block font-medium md:text-base rounded-[7px] text-primary-500 border border-primary-500 py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 hover:border-primary-600 hover:text-white"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-block font-medium md:text-base rounded-[7px] bg-primary-500 text-white py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600"
                  >
                    Start Free
                  </Link>
                </div>
              </div>

              {/* Mobile Navigation */}
              <div
                className={`bg-white dark:bg-[#0a0e19] rounded-[15px] border border-gray-200 dark:border-[#202c4b] mt-[20px] p-[20px] md:p-[30px] w-full hidden lg:!hidden ${
                  isActiveMobileMenu ? "" : "active"
                }`}
                id="navbar-collapse"
              >
                <ul>
                  {menuItems.map((item) => (
                    <li
                      key={item.href}
                      className="my-[14px] md:my-[16px] first:mt-0 last:mb-0"
                    >
                      <Link
                        href={item.href}
                        className={`font-medium transition-all hover:text-primary-600 ${
                          pathname === item.href ? "text-primary-600" : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-[10px] mt-[20px]">
                  <Link
                    href="/login"
                    className="inline-block font-medium md:text-base rounded-[7px] text-primary-500 border border-primary-500 py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 hover:border-primary-600 hover:text-white text-center"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-block font-medium md:text-base rounded-[7px] bg-primary-500 text-white py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-primary-600 text-center"
                  >
                    Start Free
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
