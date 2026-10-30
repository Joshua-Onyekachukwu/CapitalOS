// =============================================
// PostHog server-side analytics
// =============================================
// Server events (email_sent from the send pipeline, reply_received from the
// poller, upgraded from the Stripe webhook) go through posthog-node on the
// server because the browser may be closed when they happen (cron/webhook).
// No-op without POSTHOG_API_KEY — safe everywhere by default.

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "./posthog";

const KEY = process.env.POSTHOG_API_KEY;
const HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

export function serverAnalyticsEnabled(): boolean {
  return Boolean(KEY);
}

interface ServerPosthogClient {
  capture(arg: { distinctId: string; event: string; properties?: AnalyticsProperties }): void;
  flush(): Promise<void>;
}

let client: ServerPosthogClient | null = null;
let clientPromise: Promise<ServerPosthogClient | null> | null = null;

async function getClientAsync(): Promise<ServerPosthogClient | null> {
  if (!KEY) return null;
  if (!client) {
    if (!clientPromise) {
      clientPromise = import("posthog-node").then((m) => {
        const pc = new m.PostHog(KEY, { host: HOST, flushAt: 1 });
        client = pc as unknown as ServerPosthogClient;
        return client;
      }).catch(() => null);
    }
    return clientPromise;
  }
  return client;
}

/**
 * Fire a server-side product event attributed to a user id.
 * Returns without side effects when PostHog is not configured.
 */
export async function captureServerEvent(userId: string, event: string, properties?: AnalyticsProperties): Promise<void> {
  const c = await getClientAsync();
  if (!c) return;
  try {
    c.capture({ distinctId: userId, event, properties });
    void c.flush();
  } catch {
    // Analytics must never break the request that triggered it.
  }
}

/** Convenience names so call sites stay declarative. */
export const serverEvents = ANALYTICS_EVENTS;
