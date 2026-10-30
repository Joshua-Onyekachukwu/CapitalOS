// =============================================
// PostHog client-side analytics
// =============================================
// All product events are declared here (single source of truth), so the
// PostHog dashboard funnel names always match the code. Capture calls are
// free no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset — nothing throws, and
// nothing is networked (the events never leave the page).

export const ANALYTICS_EVENTS = {
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_STEP: "onboarding_step_n",
  INVESTORS_SEARCHED: "investors_searched",
  INVESTOR_SAVED: "investor_saved",
  DRAFT_GENERATED: "draft_generated",
  DRAFT_APPROVED: "draft_approved",
  EMAIL_SENT: "email_sent",
  REPLY_RECEIVED: "reply_received",
  UPGRADED: "upgraded",
} as const;

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function analyticsEnabled(): boolean {
  return Boolean(KEY);
}

// Lazily loaded singleton — posthog-js is ~40 kB; only pay for it when a key
// is actually configured.
let loading: Promise<unknown> | null = null;

async function getClient(): Promise<unknown | null> {
  if (!KEY || typeof window === "undefined") return null;
  if (!loading) {
    loading = import("posthog-js").then((posthog) => {
      posthog.default.init(KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false, // the provider fires these on route change
        autocapture: false,
        persistence: "localStorage+cookie",
      });
      return posthog.default;
    }).catch(() => null);
  }
  return (await loading) ?? null;
}

/** Fire a product event from the browser. No-op without a PostHog key. */
export async function captureEvent(event: string, properties?: AnalyticsProperties): Promise<void> {
  const posthog = await getClient();
  if (!posthog) return;
  (posthog as { capture(e: string, p?: Record<string, unknown>) : void }).capture(event, {
    ...properties,
    $current_url: typeof window !== "undefined" ? window.location.href : undefined,
  });
}
