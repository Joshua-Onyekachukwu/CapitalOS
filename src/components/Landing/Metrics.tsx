"use client";

import React, { useState, useEffect, useRef } from "react";

interface MetricItem {
  value: number | string;
  suffix?: string;
  label: string;
  duration?: number;
}

const AnimatedNumber: React.FC<{
  value: number | string;
  suffix?: string;
  duration?: number;
}> = ({ value, suffix = "", duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const isDecimal = typeof value === "number" && value % 1 !== 0;

  useEffect(() => {
    if (typeof value !== "number") {
      setCount(value as unknown as number);
      return;
    }

    const start = 0;
    const end = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const currentValue = Math.floor(progress * (end - start) + start);
      setCount(isDecimal ? parseFloat(currentValue.toFixed(1)) : currentValue);
      if (progress < 1) requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [value, duration, isDecimal]);

  return (
    <>
      {count}
      {suffix}
    </>
  );
};

const Metrics: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const factsRef = useRef<HTMLDivElement>(null);

  const facts: MetricItem[] = [
    { value: 10000, suffix: "+", label: "Investors Researched", duration: 2000 },
    { value: 50000, suffix: "+", label: "Emails Personalized", duration: 2000 },
    { value: 5000, suffix: "+", label: "Meetings Booked", duration: 1500 },
    { value: 95, suffix: "%", label: "Founder Satisfaction", duration: 1000 },
  ];

  useEffect(() => {
    const currentRef = factsRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);
    return () => observer.unobserve(currentRef);
  }, []);

  return (
    <div
      ref={factsRef}
      className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[25px]">
        {facts.map((fact, index) => (
          <div key={index} className="text-center">
            <h3 className="!leading-none !font-medium -tracking-[1.5px] !text-[3xl] md:!text-4xl lg:!text-5xl xl:!text-[48px] !mb-[8px]">
              {isVisible ? (
                <AnimatedNumber
                  value={fact.value}
                  suffix={fact.suffix}
                  duration={fact.duration}
                />
              ) : (
                "0" + (fact.suffix || "")
              )}
            </h3>
            <span className="block md:text-[15px] lg:text-md font-medium">
              {fact.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Metrics;
