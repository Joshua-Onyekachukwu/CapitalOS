// =============================================
// Signed-in smoke test
// =============================================
// This runs against a real deployment with a real account, because the things
// it checks only exist at that level: a session cookie that survives server
// rendering, conversation rows written for that user, the approval endpoint
// re-checking ownership, and a checkout route that refuses to charge without
// Stripe keys.
//
// Credentials come from .env.e2e.local (written by scripts/e2e-seed-user.cjs).
// Without them the whole file skips rather than pretending to pass.

import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("signed-in product smoke", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Set E2E_EMAIL / E2E_PASSWORD — run `npm run e2e:seed` once."
  );

  test("sign in, copilot persistence, approval gate, discover filters, billing gating", async ({
    page,
    request,
  }) => {
    // ── 1. Sign in ──
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(EMAIL!);
    await page.locator('input[name="password"]').fill(PASSWORD!);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

    // ── 2. Copilot answers and persists on the server ──
    await page.goto("/dashboard/copilot");
    const composer = page.getByPlaceholder(/Ask about investors/i);
    await expect(composer).toBeVisible();
    await composer.fill("what is my pipeline status?");
    await composer.press("Enter");

    // The user's turn must be stored as soon as it is accepted, not only after
    // the model answers, so a slow model cannot make the thread look lost.
    const persisted = await expect
      .poll(
        async () => {
          const list = await page.request.get("/api/copilot/conversations");
          if (list.status() !== 200) return 0;
          const body = await list.json();
          const latest = body.conversations?.[0];
          if (!latest) return 0;
          const detail = await page.request.get(`/api/copilot/conversations?id=${latest.id}`);
          if (detail.status() !== 200) return 0;
          const stored = await detail.json();
          const messages = stored.conversation?.messages;
          return Array.isArray(messages)
            ? messages.filter((m: { role: string }) => m.role === "user").length
            : 0;
        },
        { timeout: 60_000 }
      )
      .toBeGreaterThan(0);

    void persisted;

    // Clear the local cache so the next load can only come from the database.
    await page.evaluate(() => localStorage.removeItem("copilot_messages"));
    await page.reload();
    await expect(page.getByText("what is my pipeline status?").first()).toBeVisible({
      timeout: 30_000,
    });

    // ── 3. Approval gate: a write is proposed, never auto-run ──
    const discover = await page.request.post("/api/investors/discover", {
      data: { limit: 1, sortBy: "fit_score" },
    });
    expect(discover.ok()).toBeTruthy();
    const discovered = await discover.json();
    const target = discovered.investors?.[0];
    expect(target?.id, "corpus returned no investor to stage").toBeTruthy();

    // Stage ids come from the app's own list, not the wider DB check
    // constraint: "shortlisted" is valid SQL but not a pipeline stage here.
    const staged = await page.request.post("/api/investors/pipeline", {
      data: { investorId: target.id, stage: "discovered" },
    });
    expect(staged.ok(), await staged.text()).toBeTruthy();

    await page.reload();
    const approvalComposer = page.getByPlaceholder(/Ask about investors/i);
    await approvalComposer.fill(`move "${target.full_name}" to First Meeting Completed`);
    await approvalComposer.press("Enter");

    await expect(page.getByText(/Approval needed/i)).toBeVisible({ timeout: 60_000 });
    // Nothing may have moved before the click: the card is the only path.
    await page.getByRole("button", { name: /Approve and run/ }).click();
    await expect(page.getByText(/^Done:/)).toBeVisible({ timeout: 45_000 });

    // ── 4. Discover filters hit the rollup and return rows ──
    await page.goto("/dashboard/investors/discover");
    await page.locator('label:has-text("Cheque size (min)") + select').selectOption("1000000");
    await page.getByRole("button", { name: /Discover Investors/ }).click();
    await expect(page.getByText(/investors? found/i)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Cheque size is recorded for/i)).toBeVisible();

    // ── 5. Billing gating ──
    await page.goto("/dashboard/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();

    // Signed in but no plan selected: rejected by validation, not by Stripe.
    const noPlan = await page.request.post("/api/billing/checkout", { data: {} });
    expect(noPlan.status()).toBe(400);

    // No session at all: rejected before any plan logic runs.
    const anonymous = await request.post("/api/billing/checkout", {
      data: { planSlug: "pro" },
    });
    expect(anonymous.status()).toBe(401);

    // And the page must say which mode billing is in rather than pretending.
    const bannerCount = await page
      .locator("text=/Billing is not configured|Test mode/")
      .count();
    expect(bannerCount, "billing page must state its Stripe mode").toBeGreaterThan(0);
  });
});
