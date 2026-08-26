import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Capital OS",
  description: "Capital OS Privacy Policy. Learn how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0e19]">
      <div className="max-w-[800px] mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-flex items-center gap-1">
          <i className="ri-arrow-left-line"></i> Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: August 26, 2026</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Introduction</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Capital OS (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Information We Collect</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p><strong>Account Information:</strong> When you create an account, we collect your name, email address, and authentication credentials.</p>
              <p><strong>Startup Profile:</strong> Information you provide about your company, including industry, stage, funding details, and team members.</p>
              <p><strong>Investor Data:</strong> We aggregate publicly available investor information from SEC filings, venture databases, and public sources to provide our investor intelligence database.</p>
              <p><strong>Usage Data:</strong> We collect information about how you interact with the platform, including features used, pages viewed, and actions taken.</p>
              <p><strong>Email Data:</strong> When you connect an email account, we access your email solely to send outreach on your behalf, detect replies, and track delivery status. We do not read, store, or share your personal email content.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. How We Use Your Information</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p>To provide and improve our fundraising platform services.</p>
              <p>To generate personalized investor recommendations and outreach emails using AI.</p>
              <p>To track email delivery, opens, and replies for your outreach campaigns.</p>
              <p>To communicate with you about your account, updates, and support.</p>
              <p>To detect and prevent fraud, abuse, and security issues.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Data Sharing</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p>We do not sell your personal information to third parties.</p>
              <p>We may share data with service providers who assist in operating our platform (hosting, email delivery, AI processing) under strict data protection agreements.</p>
              <p>We may disclose information if required by law or to protect our legal rights.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Data Security</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We implement industry-standard security measures including encryption at rest and in transit, access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Your Rights</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p>You can access, update, or delete your account information at any time through your Settings.</p>
              <p>You can disconnect your email accounts at any time.</p>
              <p>You can request a copy of your data or account deletion by contacting us at hello@capitalos.io.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Contact</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              For questions about this Privacy Policy, contact us at{" "}
              <a href="mailto:hello@capitalos.io" className="text-lime-600 hover:underline">hello@capitalos.io</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
