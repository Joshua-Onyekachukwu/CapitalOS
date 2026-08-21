import "material-symbols";
import "remixicon/fonts/remixicon.css";
import "swiper/css";
import "swiper/css/bundle";

import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import GoTop from "@/components/Layout/GoTop";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Capital OS — AI-Powered Fundraising Operating System",
  description:
    "Discover the right investors, understand why they are relevant, reach out intelligently, and manage the entire fundraising process from one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased !bg-white dark:!bg-dark`}>
        <Navbar />

        {children}

        <Footer />

        <GoTop />
      </body>
    </html>
  );
}
