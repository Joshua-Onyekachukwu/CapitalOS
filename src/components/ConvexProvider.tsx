"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Only create client if URL is configured
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // Convex not configured — render children without it
    return <>{children}</>;
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
