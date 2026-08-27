"use client";

import React from "react";

const DataVizChart: React.FC = () => {
  return (
    <div
      className="inline-block rounded-[8px] overflow-hidden relative"
      style={{
        width: 210,
        height: 260,
        boxShadow: "0 4px 60px 0 rgba(204, 141, 96, 0.15)",
        background:
          "linear-gradient(145deg, #06201b 0%, #0a2e24 40%, #0d3a2d 100%)",
      }}
    >
      {/* Subtle grid pattern */}
      <svg
        width="210"
        height="260"
        viewBox="0 0 210 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        {/* Background grid lines */}
        {[60, 100, 140, 180, 220].map((y) => (
          <line
            key={`h-${y}`}
            x1="20"
            y1={y}
            x2="190"
            y2={y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        ))}
        {[40, 70, 100, 130, 160].map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            y1="45"
            x2={x}
            y2="235"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        ))}

        {/* Bar chart - investor stages */}
        {[
          { x: 28, height: 95, color: "#A3E635" },
          { x: 52, height: 70, color: "#A3E635" },
          { x: 76, height: 110, color: "#D15616" },
          { x: 100, height: 55, color: "#A3E635" },
          { x: 124, height: 85, color: "#A3E635" },
          { x: 148, height: 130, color: "#D15616" },
          { x: 172, height: 65, color: "#A3E635" },
        ].map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={235 - bar.height}
            width="16"
            height={bar.height}
            rx="3"
            fill={bar.color}
            opacity="0.85"
          />
        ))}

        {/* Trend line */}
        <polyline
          points="36,145 60,160 84,120 108,170 132,140 156,100 180,155"
          fill="none"
          stroke="#A3E635"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />

        {/* Dots on trend line */}
        {[
          { cx: 36, cy: 145 },
          { cx: 84, cy: 120 },
          { cx: 132, cy: 140 },
          { cx: 156, cy: 100 },
        ].map((dot, i) => (
          <circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r="3"
            fill="#A3E635"
            opacity="0.9"
          />
        ))}

        {/* Header label */}
        <text
          x="24"
          y="30"
          fill="rgba(255,255,255,0.7)"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="1.5"
        >
          INVESTOR PIPELINE
        </text>

        {/* Bottom stats */}
        <text
          x="24"
          y="252"
          fill="rgba(163,230,53,0.8)"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
        >
          16,142 investors
        </text>
        <text
          x="130"
          y="252"
          fill="rgba(255,255,255,0.4)"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
        >
          Live data
        </text>
      </svg>
    </div>
  );
};

export default DataVizChart;
