// =============================================
// Sentry server instrumentation
// =============================================
// No-op until NEXT_PUBLIC_SENTRY_DSN is configured (server-side) — errors are
// still logged to console/stderr, so wiring is lossless without Sentry.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    tracesSampleRate: 0.2,
  });
}

export const onRequestError = Sentry.captureRequestError;
