import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Support — Capital OS",
  description: "Get help with Capital OS: contact support, report a bug, or request your data.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0e19]">
      <div className="max-w-[800px] mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-flex items-center gap-1">
          <i className="ri-arrow-left-line"></i> Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Support</h1>
        <p className="text-sm text-gray-500 mb-8">
          We&apos;re a small founding team — every message lands with a real person.
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Contact us</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Email{" "}
              <a href="mailto:hello@capitalos.io" className="text-lime-600 hover:underline">hello@capitalos.io</a>{" "}
              and we&apos;ll respond within one business day. For anything urgent about email deliverability
              (bounces, send failures), mark the subject line <strong>URGENT</strong> — we treat
              deliverability issues as production incidents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              What to include for the fastest fix
            </h2>
            <ul className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc pl-5 space-y-2">
              <li>The email address on your Capital OS account.</li>
              <li>What you clicked and what you expected to happen.</li>
              <li>The exact error text or a screenshot.</li>
              <li>For campaign or outreach issues: the campaign name and roughly when it ran.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Common self-service answers</h2>
            <ul className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc pl-5 space-y-2">
              <li>
                <strong>Data export or account deletion</strong> — both are self-serve in{" "}
                <a href="/dashboard/settings" className="text-lime-600 hover:underline">Settings → Privacy &amp; Data</a>.
                No email required.
              </li>
              <li>
                <strong>Email connection trouble</strong> — check Settings for the reconnect banner;
                Google tokens refresh automatically unless revoked in your Google account.
              </li>
              <li>
                <strong>Password reset</strong> — send yourself a reset link from Settings → Security.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Billing</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Questions about founding-member pricing or credits? Email the same address from your
              account email and include the last 4 digits shown in your billing dashboard — never
              send card details by email.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
