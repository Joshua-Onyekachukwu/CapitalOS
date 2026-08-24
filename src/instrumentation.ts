/**
 * Next.js Instrumentation
 *
 * Runs once when the server starts. Used to initialize background services
 * like the job runner that need to persist across requests.
 *
 * Only runs on the server side, never in the browser.
 *
 * Note: In serverless environments (Vercel), the job runner processes jobs
 * within the same process. For production at scale, consider moving to
 * a dedicated worker (e.g., BullMQ + Redis, or a separate Node.js process).
 */

export async function register() {
  // Only run on server side
  if (typeof window !== "undefined") return;

  // Only initialize once per process
  if ((global as any).__jobRunnerInitialized) return;
  (global as any).__jobRunnerInitialized = true;

  try {
    // Dynamic import to avoid bundling Node.js modules (pg, dns, fs, net)
    // into Edge Runtime bundles during the build
    const handlers = await import(/* webpackIgnore: true */ "@/lib/jobs/handlers");
    handlers.initializeJobRunner();
    console.log("[instrumentation] Background job runner initialized");
  } catch (err) {
    console.error("[instrumentation] Failed to initialize job runner:", err);
  }
}
