import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Unsubscribe — Capital OS",
  description: "Unsubscribe from Capital OS emails.",
};

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0e19] flex items-center justify-center px-6">
      <div className="max-w-[500px] text-center">
        <div className="w-[60px] h-[60px] bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="ri-check-line text-green-600 text-[28px]"></i>
        </div>
        
        <h1 className="text-[24px] font-bold text-gray-900 dark:text-white mb-3">
          You&apos;ve been unsubscribed
        </h1>
        
        <p className="text-[14px] text-gray-500 leading-relaxed mb-8">
          You will no longer receive marketing or outreach emails from Capital OS. 
          Transactional emails (account security, billing) may still be sent as needed.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-lime-500 text-black text-[14px] font-medium rounded-[8px] hover:bg-lime-600 transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[14px] font-medium rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Resubscribe
          </Link>
        </div>

        <p className="text-[12px] text-gray-400 mt-8">
          Capital OS • 1603 Capitol Ave, Suite 310, Cheyenne, WY 82001, USA
        </p>
      </div>
    </div>
  );
}
