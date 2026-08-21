"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
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
        className="real-estate-agent-navbar fixed top-0 right-0 left-0 transition-all h-auto z-[5] py-[15px] md:py-[20px] lg:py-[25px] xl:py-[30px]"
        id="navbar"
      >
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1430px] 2xl:max-w-[1745px] mx-auto px-[12px]">
          <div className="flex items-center relative flex-wrap lg:flex-nowrap justify-between lg:justify-start">
            {/* Logo */}
            <Link href="/" className="inline-block w-[110px]">
              <span className="text-xl font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-lime-500">OS</span>
              </span>
            </Link>

            {/* Mobile burger */}
            <button
              type="button"
              id="navbar-burger-menu"
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
              {/* Pill nav container */}
              <ul className="flex mx-auto flex-row bg-white/40 dark:bg-dark/40 rounded-[40px] p-[5px]">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`font-semibold rounded-[70px] text-base block py-[9.5px] xl:py-[11.5px] px-[20px] xl:px-[26px] transition-all ${
                          isActive
                            ? "bg-lime-500 text-black"
                            : "text-black dark:text-white hover:bg-lime-500 hover:text-black"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Right side: Login + Get Started */}
              <div className="flex items-center gap-[20px] xl:gap-[30px]">
                <Link
                  href="/login"
                  className="text-[#D15616] font-black text-xs uppercase tracking-[1.2px] xl:tracking-[1.8px] transition-all underline underline-offset-2 hover:text-lime-500"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-[10px]"
                >
                  <div className="flex-none flex items-center justify-center rounded-full bg-[#06201b] dark:bg-dark text-lime-500 text-lg w-[45px] h-[45px] xl:w-[50px] xl:h-[50px] transition-all hover:bg-lime-500 hover:text-black">
                    <i className="ri-rocket-2-fill"></i>
                  </div>
                  <div className="pt-[3px] hidden xl:block">
                    <span className="block uppercase tracking-[1.8px] text-xs font-semibold mb-px">
                      GET STARTED
                    </span>
                    <span className="inline-block tracking-[0.18px] font-bold text-base md:text-[15px] lg:text-md xl:text-lg text-black dark:text-white transition-all hover:text-lime-500">
                      Start Free Trial
                    </span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Mobile Navigation */}
            <div
              className={`bg-white dark:bg-[#06201b] rounded-[15px] border border-gray-200 dark:border-gray-900 mt-[15px] p-[20px] md:p-[30px] w-full hidden lg:!hidden ${
                isActiveMobileMenu ? "" : "active"
              }`}
              id="navbar-collapse"
            >
              <ul>
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li
                      key={item.href}
                      className="my-[15px] md:my-[17px] first:mt-0 last:mb-0"
                    >
                      <Link
                        href={item.href}
                        className={`font-semibold text-base block transition-all ${
                          isActive
                            ? "text-lime-500"
                            : "text-black dark:text-white hover:text-lime-500"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="sm:flex items-center gap-[25px] mt-[15px] md:mt-[17px]">
                <Link
                  href="/signup"
                  className="inline-block font-medium text-base rounded-[7px] bg-lime-500 text-black py-[10px] md:py-[11px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 text-center"
                >
                  Get Started
                </Link>
                <Link
                  href="/login"
                  className="text-[#D15616] font-black text-xs uppercase tracking-[1.2px] xl:tracking-[1.8px] transition-all underline underline-offset-2 hover:text-lime-500"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
