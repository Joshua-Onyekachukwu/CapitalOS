// =============================================
// Sentry client instrumentation
// =============================================
// No-op until NEXT_PUBLIC_SENTRY_DSN is set (build-time). Errors still go to
// the browser console, so wiring is lossless without Sentry.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: 0.1,
    attachStacktrace: true,
  });
}
