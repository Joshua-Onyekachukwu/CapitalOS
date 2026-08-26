import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Capital OS",
  description: "Capital OS Terms of Service. Read our terms and conditions.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0e19]">
      <div className="max-w-[800px] mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-flex items-center gap-1">
          <i className="ri-arrow-left-line"></i> Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: August 26, 2026</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              By accessing or using Capital OS, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Description of Service</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Capital OS is an AI-powered fundraising platform that helps startup founders discover investors, generate personalized outreach, and manage their fundraising pipeline. Our services include investor intelligence, AI-driven matching, email drafting, and pipeline management.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Account Responsibilities</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
              <p>You agree to provide accurate and complete information when creating your account.</p>
              <p>You are responsible for all activity that occurs under your account.</p>
              <p>You must be at least 18 years old to use the platform.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Acceptable Use</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p>You agree to use the platform only for legitimate fundraising purposes.</p>
              <p>You will not use the platform to send spam, harassment, or unsolicited commercial email in violation of applicable laws (CAN-SPAM, GDPR, etc.).</p>
              <p>You will not attempt to circumvent sending limits, authentication systems, or other platform safeguards.</p>
              <p>You will not scrape, harvest, or redistribute investor data from the platform for purposes outside of your own fundraising activities.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Intellectual Property</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              All content, features, and functionality of Capital OS are owned by us and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Payment and Subscriptions</h2>
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              <p>Paid plans are billed on a monthly or annual basis. You may cancel at any time.</p>
              <p>Refunds are handled on a case-by-case basis within 14 days of purchase.</p>
              <p>We reserve the right to modify pricing with 30 days notice.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Limitation of Liability</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Capital OS is provided &quot;as is&quot; without warranties of any kind. We are not responsible for the outcomes of your fundraising efforts, investor responses, or email deliverability. Our liability is limited to the amount you paid for the service in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">8. Termination</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We may suspend or terminate your account if you violate these terms. You may delete your account at any time through Settings. Upon termination, your data will be deleted within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">9. Changes to Terms</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We may update these terms from time to time. We will notify you of material changes via email or through the platform. Continued use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">10. Contact</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              For questions about these Terms, contact us at{" "}
              <a href="mailto:hello@capitalos.io" className="text-lime-600 hover:underline">hello@capitalos.io</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
