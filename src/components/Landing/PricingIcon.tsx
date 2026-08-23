"use client";

import React from "react";

interface PricingIconProps {
  plan: "starter" | "professional";
}

const PricingIcon: React.FC<PricingIconProps> = ({ plan }) => {
  if (plan === "starter") {
    return (
      <div
        className="inline-flex items-center justify-center rounded-[12px] relative overflow-hidden"
        style={{
          width: 120,
          height: 120,
          background:
            "linear-gradient(135deg, rgba(163,230,53,0.15) 0%, rgba(6,32,27,0.9) 100%)",
          border: "1px solid rgba(163,230,53,0.2)",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid dots */}
          {[30, 50, 70, 90].map((x) =>
            [30, 50, 70, 90].map((y) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r="1"
                fill="rgba(163,230,53,0.2)"
              />
            ))
          )}
          {/* Mini bar chart */}
          <rect x="25" y="65" width="10" height="25" rx="2" fill="#A3E635" opacity="0.7" />
          <rect x="40" y="50" width="10" height="40" rx="2" fill="#A3E635" opacity="0.85" />
          <rect x="55" y="55" width="10" height="35" rx="2" fill="#FFCB33" opacity="0.9" />
          <rect x="70" y="35" width="10" height="55" rx="2" fill="#A3E635" opacity="0.95" />
          <rect x="85" y="45" width="10" height="45" rx="2" fill="#A3E635" opacity="0.8" />
          {/* Trend line */}
          <polyline
            points="30,62 45,47 60,52 75,32 90,42"
            fill="none"
            stroke="#FFCB33"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center justify-center rounded-[12px] relative overflow-hidden"
      style={{
        width: 120,
        height: 120,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(209,86,22,0.3) 100%)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Network nodes */}
        <circle cx="60" cy="40" r="8" fill="white" opacity="0.9" />
        <circle cx="35" cy="65" r="6" fill="white" opacity="0.7" />
        <circle cx="85" cy="65" r="6" fill="white" opacity="0.7" />
        <circle cx="45" cy="90" r="5" fill="white" opacity="0.5" />
        <circle cx="75" cy="90" r="5" fill="white" opacity="0.5" />
        {/* Connections */}
        <line x1="60" y1="40" x2="35" y2="65" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="60" y1="40" x2="85" y2="65" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="35" y1="65" x2="45" y2="90" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="85" y1="65" x2="75" y2="90" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="35" y1="65" x2="85" y2="65" stroke="white" strokeWidth="1" opacity="0.2" />
        {/* Center pulse */}
        <circle cx="60" cy="40" r="12" fill="none" stroke="white" strokeWidth="1" opacity="0.3" />
      </svg>
    </div>
  );
};

export default PricingIcon;
