"use client";

import React, { useState, useEffect } from "react";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [totalSignups, setTotalSignups] = useState(0);

  useEffect(() => {
    // Fetch current waitlist count for social proof
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => setTotalSignups(d.totalSignups || 0))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setPosition(data.position || 0);
      setReferralCode(data.referralCode || "");
      setTotalSignups((prev) => (data.alreadySignedUp ? prev : prev + 1));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="py-[80px] md:py-[100px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-[640px] mx-auto px-[20px] text-center">
          <div className="w-[72px] h-[72px] rounded-full bg-lime-500/20 flex items-center justify-center mx-auto mb-[24px]">
            <i className="ri-check-line text-lime-400 text-[36px]"></i>
          </div>
          <h2 className="!text-[28px] md:!text-[36px] !font-bold text-white !mb-[12px]">
            You&apos;re on the list!
          </h2>
          <p className="text-[16px] text-gray-400 !mb-[32px] leading-relaxed">
            We&apos;ll let you know as soon as Capital OS launches.
            {position > 0 && (
              <span className="block mt-[8px] text-lime-400 font-medium">
                You&apos;re #{position.toLocaleString()} in line.
              </span>
            )}
          </p>

          {referralCode && (
            <div className="bg-white/5 rounded-[16px] p-[24px] border border-white/10">
              <p className="text-[14px] text-gray-400 !mb-[12px]">
                Share with friends and move up the list:
              </p>
              <div className="flex items-center gap-[8px]">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}?ref=${referralCode}`}
                  className="flex-1 bg-white/10 border border-white/10 rounded-[8px] px-[12px] py-[10px] text-[13px] text-white"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}?ref=${referralCode}`
                    );
                  }}
                  className="px-[16px] py-[10px] bg-lime-500 text-gray-900 rounded-[8px] text-[13px] font-medium hover:bg-lime-400 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="py-[80px] md:py-[100px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-[640px] mx-auto px-[20px] text-center">
        <div className="inline-flex items-center gap-[8px] bg-lime-500/10 border border-lime-500/20 rounded-full px-[16px] py-[6px] mb-[24px]">
          <span className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-pulse"></span>
          <span className="text-[13px] text-lime-400 font-medium">
            Early Access — Limited Spots
          </span>
        </div>

        <h2 className="!text-[28px] md:!text-[36px] !font-bold text-white !mb-[12px]">
          Be first to launch with Capital OS
        </h2>
        <p className="text-[16px] text-gray-400 !mb-[8px] leading-relaxed">
          Join the waitlist and get notified the moment we go live.
        </p>
        {totalSignups > 0 && (
          <p className="text-[14px] text-gray-500 !mb-[32px]">
            {totalSignups.toLocaleString()} founder{totalSignups !== 1 ? "s" : ""} already waiting
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-[12px]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] px-[16px] py-[10px] text-[13px] text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-[12px]">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-white/10 border border-white/10 rounded-[10px] px-[16px] py-[14px] text-[15px] text-white placeholder:text-gray-500 focus:outline-none focus:border-lime-500/50 transition-colors"
            />
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-white/10 border border-white/10 rounded-[10px] px-[16px] py-[14px] text-[15px] text-white placeholder:text-gray-500 focus:outline-none focus:border-lime-500/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-lime-400 hover:bg-lime-300 text-gray-900 font-semibold rounded-[10px] px-[24px] py-[14px] text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-[8px]">
                <span className="w-[16px] h-[16px] border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></span>
                Joining...
              </span>
            ) : (
              "Join the Waitlist — Free"
            )}
          </button>
        </form>

        <p className="text-[12px] text-gray-500 !mt-[16px] !mb-0">
          No spam. No credit card. Just early access when we launch.
        </p>
      </div>
    </section>
  );
}
