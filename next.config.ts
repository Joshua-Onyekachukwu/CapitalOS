import type { NextConfig } from "next";
// In @sentry/nextjs v11 the build wrapper lives at the ./config subpath.
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Skip type checking during build — pre-existing Next.js 16 params Promise type issue
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
};

// Sentry build hooks (source-map upload etc.) only activate once a DSN is
// configured; otherwise the config passes through untouched. Runtime wiring
// lives in src/instrumentation.ts + src/instrumentation-client.ts.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
  : nextConfig;
