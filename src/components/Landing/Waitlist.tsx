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
  const [showFoundingModal, setShowFoundingModal] = useState(false);
  const [foundingLoading, setFoundingLoading] = useState(false);

  useEffect(() => {
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

      setTimeout(() => setShowFoundingModal(true), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFoundingCheckout = async () => {
    setFoundingLoading(true);
    try {
      const res = await fetch("/api/founding-member/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Stay on page
    } finally {
      setFoundingLoading(false);
    }
  };

  // ── Success State ──
  if (success) {
    return (
      <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] relative z-[1]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="text-center mx-auto lg:max-w-[600px]">
            <div className="w-[64px] h-[64px] rounded-full bg-lime-500/15 flex items-center justify-center mx-auto mb-[20px]">
              <i className="ri-check-line text-lime-500 text-[32px]"></i>
            </div>
            <h2 className="!mb-[12px] !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
              You&apos;re on the <span className="font-semibold italic">list!</span>
            </h2>
            <p className="text-base md:text-[16px] lg:text-md -tracking-[0.16px] text-[#9E948E] !mb-[12px]">
              We&apos;ll let you know as soon as Capital OS launches.
            </p>
            {position > 0 && (
              <p className="text-[15px] text-lime-500 font-medium !mb-[32px]">
                You&apos;re #{position.toLocaleString()} in line.
              </p>
            )}

            {referralCode && (
              <div className="bg-[#06201b] rounded-[16px] p-[24px] md:p-[32px] mt-[24px]">
                <p className="text-[14px] text-[#9E948E] !mb-[12px]">
                  Share with friends and move up the list:
                </p>
                <div className="flex items-center gap-[8px] max-w-[400px] mx-auto">
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}?ref=${referralCode}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-[8px] px-[12px] py-[10px] text-[13px] text-white"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}?ref=${referralCode}`
                      );
                    }}
                    className="px-[16px] py-[10px] bg-lime-500 text-black rounded-[8px] text-[13px] font-medium hover:bg-lime-400 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Founding Member Upsell Modal */}
        {showFoundingModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center px-[20px]">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFoundingModal(false)}
            ></div>
            <div className="relative bg-[#06201b] border border-white/10 rounded-[20px] p-[32px] md:p-[40px] max-w-[480px] w-full shadow-2xl">
              <button
                onClick={() => setShowFoundingModal(false)}
                className="absolute top-[16px] right-[16px] w-[32px] h-[32px] rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/15 transition-colors"
              >
                <i className="ri-close-line text-[18px]"></i>
              </button>

              <div className="w-[56px] h-[56px] rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-[20px]">
                <i className="ri-vip-crown-line text-amber-400 text-[28px]"></i>
              </div>

              <h3 className="text-[24px] md:text-[28px] font-bold text-white !mb-[8px] text-center -tracking-[0.5px]">
                Want early access?
              </h3>
              <p className="text-[15px] text-[#9E948E] !mb-[24px] text-center leading-relaxed">
                Become a Founding Member for <span className="text-white font-semibold">$9.99</span> and
                get <span className="text-lime-500 font-medium">$9.99 in platform credit</span> when we launch.
                Plus priority access and founding-member pricing forever.
              </p>

              <div className="space-y-[10px] !mb-[28px]">
                <div className="flex items-center gap-[10px] text-[14px] text-[#E3E3E3]">
                  <i className="ri-check-line text-lime-500 text-[16px]"></i>
                  $9.99 platform credit toward your first subscription
                </div>
                <div className="flex items-center gap-[10px] text-[14px] text-[#E3E3E3]">
                  <i className="ri-check-line text-lime-500 text-[16px]"></i>
                  Priority early access before public launch
                </div>
                <div className="flex items-center gap-[10px] text-[14px] text-[#E3E3E3]">
                  <i className="ri-check-line text-lime-500 text-[16px]"></i>
                  Locked-in founding-member pricing forever
                </div>
              </div>

              <button
                onClick={handleFoundingCheckout}
                disabled={foundingLoading}
                className="w-full bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-[8px] px-[24px] py-[14px] text-[16px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed !mb-[12px]"
              >
                {foundingLoading ? (
                  <span className="flex items-center justify-center gap-[8px]">
                    <span className="w-[16px] h-[16px] border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                    Redirecting...
                  </span>
                ) : (
                  "Become a Founding Member — $9.99"
                )}
              </button>

              <button
                onClick={() => setShowFoundingModal(false)}
                className="w-full text-[14px] text-[#9E948E] hover:text-white transition-colors py-[8px]"
              >
                No thanks, I&apos;ll wait for the free launch
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Waitlist Form ──
  return (
    <div className="py-[60px] md:py-[80px] lg:py-[100px] xl:py-[120px] relative z-[1]">
      <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
        <div className="text-center mx-auto lg:max-w-[700px]">
          <span className="block uppercase text-xs md:text-sm tracking-[1.95px] font-bold text-[#D15616] mb-[10px]">
            Early Access
          </span>
          <h2 className="!mb-[12px] !font-light !text-2xl md:!text-[38px] lg:!text-[46px] -tracking-[1px] md:-tracking-[1.5px] lg:-tracking-[2px]">
            Be first to launch <span className="font-semibold italic">with Capital OS</span>
          </h2>
          <p className="text-base md:text-[16px] lg:text-md -tracking-[0.16px] text-[#9E948E] !mb-[8px]">
            Join the waitlist and get notified the moment we go live.
          </p>
          {totalSignups > 0 && (
            <p className="text-[14px] text-[#9E948E] !mb-[32px]">
              {totalSignups.toLocaleString()} founder{totalSignups !== 1 ? "s" : ""} already waiting
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-[12px] max-w-[480px] mx-auto">
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
                className="flex-1 bg-[#06201b] border border-white/10 rounded-[8px] px-[16px] py-[14px] text-[16px] text-white placeholder:text-[#9E948E] focus:outline-none focus:border-lime-500/50 transition-colors"
              />
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-[#06201b] border border-white/10 rounded-[8px] px-[16px] py-[14px] text-[16px] text-white placeholder:text-[#9E948E] focus:outline-none focus:border-lime-500/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-[8px] px-[24px] py-[14px] text-[16px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-[8px]">
                  <span className="w-[16px] h-[16px] border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                  Joining...
                </span>
              ) : (
                "Join the Waitlist — Free"
              )}
            </button>
          </form>

          <p className="text-[12px] text-[#9E948E] !mt-[16px] !mb-0">
            No spam. No credit card. Just early access when we launch.
          </p>
        </div>
      </div>
      <div className="absolute top-0 left-0 right-0 bottom-0 -z-[1] bg-[#06201b] lg:rounded-[20px] lg:mx-[10px] xl:mx-[20px]"></div>
    </div>
  );
}
