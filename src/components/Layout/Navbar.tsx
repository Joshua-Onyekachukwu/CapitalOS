"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

const publicMenuItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/#about" },
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

const authMenuItems = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Investors", href: "/dashboard/investors" },
  { label: "Campaigns", href: "/dashboard/campaigns" },
];

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signedIn } = useUser();

  useEffect(() => {
    const elementId = document.getElementById("navbar");
    const handleScroll = () => {
      if (window.scrollY > 100) {
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
  const [signingOut, setSigningOut] = useState(false);

  const handleToggleMobileMenu = (): void => {
    setActiveMobileMenu(!isActiveMobileMenu);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  // During loading, show the public nav to avoid flash of wrong content
  const displayItems = loading ? publicMenuItems : signedIn ? authMenuItems : publicMenuItems;

  return (
    <>
      <div
        className="sales-navbar bg-white dark:bg-dark fixed top-0 right-0 left-0 transition-all h-auto z-[5] py-[20px] md:py-[30px] lg:py-[35px]"
        id="navbar"
      >
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="flex items-center relative flex-wrap lg:flex-nowrap justify-between lg:justify-start">
            {/* Logo */}
            <Link href={signedIn ? "/dashboard" : "/"} className="inline-block w-[150px] ltr:mr-[15px] rtl:ml-[15px]">
              <span className="text-xl font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-lime-500">OS</span>
              </span>
            </Link>

            {/* Mobile burger */}
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
                {displayItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`font-medium transition-all hover:text-[#06201b] ${
                        pathname === item.href ? "text-[#06201b]" : ""
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-[12px]">
                {loading ? (
                  /* Loading skeleton */
                  <div className="flex items-center gap-[12px]">
                    <div className="w-[80px] h-[40px] bg-gray-100 rounded-[7px] animate-pulse"></div>
                    <div className="w-[100px] h-[40px] bg-gray-100 rounded-[7px] animate-pulse"></div>
                  </div>
                ) : signedIn ? (
                  /* Authenticated: Dashboard + Account */
                  <>
                    <Link
                      href="/dashboard"
                      className="inline-block font-medium md:text-base rounded-[7px] text-[#06201b] border border-[#06201b] py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-[#06201b] hover:text-white"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600"
                    >
                      {user?.email?.split("@")[0] || "Account"}
                    </Link>
                  </>
                ) : (
                  /* Visitor: Log In + Get Started */
                  <>
                    <Link
                      href="/login"
                      className="inline-block font-medium md:text-base rounded-[7px] text-[#06201b] border border-[#06201b] py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-[#06201b] hover:text-white"
                    >
                      Log In
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600"
                    >
                      Get Started
                    </Link>
                  </>
                )}
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
                {displayItems.map((item) => (
                  <li
                    key={item.href}
                    className="my-[14px] md:my-[16px] first:mt-0 last:mb-0"
                  >
                    <Link
                      href={item.href}
                      className={`font-medium transition-all hover:text-[#06201b] ${
                        pathname === item.href ? "text-[#06201b]" : ""
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-[10px] mt-[20px]">
                {loading ? (
                  <div className="space-y-[10px]">
                    <div className="h-[44px] bg-gray-100 rounded-[7px] animate-pulse"></div>
                    <div className="h-[44px] bg-gray-100 rounded-[7px] animate-pulse"></div>
                  </div>
                ) : signedIn ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="inline-block font-medium md:text-base rounded-[7px] text-[#06201b] border border-[#06201b] py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-[#06201b] hover:text-white text-center"
                    >
                      Go to Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 text-center"
                    >
                      {signingOut ? "Signing out..." : "Sign Out"}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-block font-medium md:text-base rounded-[7px] text-[#06201b] border border-[#06201b] py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-[#06201b] hover:text-white text-center"
                    >
                      Log In
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-block font-medium md:text-base rounded-[7px] bg-lime-500 text-black py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] transition-all hover:bg-lime-600 text-center"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
