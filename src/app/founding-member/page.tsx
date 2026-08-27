"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function FoundingMemberContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "not_found">("loading");
  const [data, setData] = useState<{
    foundingCredit: number;
    paymentDate: string;
    email: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("not_found");
      return;
    }

    fetch(`/api/founding-member/status?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.isFoundingMember) {
          setStatus("success");
          setData(d);
        } else {
          // Payment may still be processing
          setTimeout(() => {
            fetch(`/api/founding-member/status?session_id=${sessionId}`)
              .then((r) => r.json())
              .then((d2) => {
                if (d2.isFoundingMember) {
                  setStatus("success");
                  setData(d2);
                } else {
                  setStatus("not_found");
                }
              })
              .catch(() => setStatus("not_found"));
          }, 3000);
        }
      })
      .catch(() => setStatus("not_found"));
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-[20px]">
        <div className="text-center">
          <div className="flex gap-[4px] justify-center mb-[16px]">
            <div className="w-[8px] h-[8px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-[8px] h-[8px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-[8px] h-[8px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
          <p className="text-gray-400 text-[16px]">Confirming your founding membership...</p>
        </div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-[20px]">
        <div className="max-w-[480px] text-center">
          <div className="w-[72px] h-[72px] rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-[24px]">
            <i className="ri-time-line text-amber-400 text-[36px]"></i>
          </div>
          <h1 className="text-[28px] md:text-[36px] font-bold text-white mb-[12px]">
            Payment processing
          </h1>
          <p className="text-gray-400 text-[16px] mb-[32px] leading-relaxed">
            Your payment is being processed. This usually takes a few seconds.
            Check your email for confirmation.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-[8px] bg-lime-400 hover:bg-lime-300 text-gray-900 font-semibold rounded-[8px] px-[24px] py-[14px] text-[16px] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-[20px]">
      <div className="max-w-[520px] text-center">
        <div className="w-[80px] h-[80px] rounded-full bg-lime-500/20 flex items-center justify-center mx-auto mb-[24px]">
          <i className="ri-check-line text-lime-400 text-[40px]"></i>
        </div>

        <h1 className="text-[28px] md:text-[36px] font-bold text-white mb-[12px]">
          Welcome, Founding Member
        </h1>

        <p className="text-gray-400 text-[16px] mb-[32px] leading-relaxed">
          Thank you for committing to Capital OS early. Your founding membership is confirmed.
        </p>

        <div className="bg-white/5 rounded-[16px] p-[24px] border border-white/10 mb-[32px] text-left">
          <div className="space-y-[16px]">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[14px]">Status</span>
              <span className="flex items-center gap-[8px] text-lime-400 text-[14px] font-medium">
                <span className="w-[6px] h-[6px] rounded-full bg-lime-400"></span>
                Founding Member
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[14px]">Platform Credit</span>
              <span className="text-white text-[14px] font-semibold">${data?.foundingCredit || 9.99}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[14px]">Email</span>
              <span className="text-white text-[14px]">{data?.email}</span>
            </div>
            {data?.name && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-[14px]">Name</span>
                <span className="text-white text-[14px]">{data.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[14px]">Joined</span>
              <span className="text-white text-[14px]">
                {data?.paymentDate
                  ? new Date(data.paymentDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Just now"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-lime-500/10 border border-lime-500/20 rounded-[12px] p-[16px] mb-[32px]">
          <p className="text-lime-400 text-[14px] font-medium !mb-[4px]">
            What happens next?
          </p>
          <p className="text-gray-400 text-[13px] !mb-0">
            When Capital OS launches, your $9.99 credit will be applied automatically to your first subscription.
            You&apos;ll also get priority access and founding-member pricing.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-[8px] bg-white/10 hover:bg-white/15 text-white font-medium rounded-[8px] px-[24px] py-[12px] text-[14px] transition-colors"
        >
          <i className="ri-arrow-left-line"></i>
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function FoundingMemberPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-lime-400 animate-bounce"></div>
        </div>
      }
    >
      <FoundingMemberContent />
    </Suspense>
  );
}
