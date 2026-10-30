"use client";

// =============================================
// PostHog provider + route-change pageviews
// =============================================
// Renders children untouched when NEXT_PUBLIC_POSTHOG_KEY is unset, so the
// analytics wiring costs nothing in the bundle or at runtime until you add a
// PostHog key. When enabled, fires one pageview per client-side navigation.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsEnabled, captureEvent } from "@/lib/analytics/posthog";

export default function PosthogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsEnabled()) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void captureEvent("$pageview", { $pathname: pathname });
  }, [pathname]);

  return <>{children}</>;
}
