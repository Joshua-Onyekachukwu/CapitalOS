"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
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
        className="capital-navbar fixed top-0 right-0 left-0 transition-all h-auto z-[5] py-[15px] md:py-[25px] lg:py-[30px]"
        id="navbar"
      >
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1450px] 2xl:max-w-[1645px] mx-auto px-[12px]">
          <div className="bg-white dark:bg-black border border-[#EBEBEB] dark:border-gray-800 p-[15px] md:p-[20px] lg:px-[12px] lg:py-[18px] rounded-[100px] flex items-center relative flex-wrap lg:flex-nowrap justify-between lg:justify-start">
            <Link
              href="/"
              className="inline-block w-[145px] ltr:lg:ml-[12px] rtl:lg:mr-[12px]"
            >
              <span className="text-xl font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-orange-500">OS</span>
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
              <ul className="navbar-nav flex mx-auto flex-row gap-[25px] xl:gap-[50px]">
                {menuItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`lg:text-[15px] xl:text-md transition-all hover:text-orange-500 ${
                        pathname === item.href
                          ? "text-orange-500"
                          : "text-black dark:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-[30px]">
                <Link
                  href="/login"
                  className="inline-block text-black dark:text-white lg:text-[15px] xl:text-md transition-all hover:text-primary-500"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="inline-block text-center bg-primary-500 border border-primary-500 rounded-[50px] text-white font-medium md:text-[15px] lg:text-md xl:text-[17px] py-[8.5px] px-[19px] transition-all hover:bg-orange-500 hover:border-orange-500"
                >
                  <span className="inline-block relative ltr:pr-[27px] rtl:pl-[27px]">
                    Get Started{" "}
                    <i className="ri-arrow-right-long-line text-[20px] absolute top-1/2 -translate-y-1/2 ltr:-right-[2px] rtl:-left-[2px]"></i>
                  </span>
                </Link>
              </div>
            </div>

            {/* Mobile Navigation */}
            <div
              className={`bg-white dark:bg-[#0a0e19] rounded-[15px] border border-gray-100 dark:border-gray-800 p-[20px] md:p-[30px] w-full hidden lg:!hidden absolute top-[100%] left-0 right-0 ${
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
                      className={`lg:text-[15px] xl:text-md transition-all hover:text-orange-500 ${
                        pathname === item.href
                          ? "text-orange-500"
                          : "text-black dark:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-[15px] md:gap-[30px] mt-[15px]">
                <Link
                  href="/login"
                  className="inline-block text-black dark:text-white lg:text-[15px] xl:text-md transition-all hover:text-primary-500"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="inline-block text-center bg-primary-500 border border-primary-500 rounded-[50px] text-white font-medium md:text-[15px] lg:text-md xl:text-[17px] py-[8.5px] px-[19px] transition-all hover:bg-orange-500 hover:border-orange-500"
                >
                  <span className="inline-block relative ltr:pr-[27px] rtl:pl-[27px]">
                    Get Started{" "}
                    <i className="ri-arrow-right-long-line text-[20px] absolute top-1/2 -translate-y-1/2 ltr:-right-[2px] rtl:-left-[2px]"></i>
                  </span>
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
