// =============================================
// Pricing layout guard
// =============================================
// The plan icons were once rendered after each card's closing tag, so the
// gradient artwork sat outside the coloured box it belongs to. Eyeballing it
// missed the regression; this pins it geometrically, with no auth needed.
//
// Runs against E2E_BASE_URL (production by default), so it only proves the
// deployed build once that build contains the data attributes below.

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test("each pricing icon renders inside its own card", async ({ page }) => {
  await page.goto("/#pricing");

  const cards = page.locator("[data-pricing-card]");
  await expect(cards).toHaveCount(2);

  for (const plan of ["starter", "professional"]) {
    const card = page.locator(`[data-pricing-card="${plan}"]`);
    const icon = card.locator(`[data-pricing-icon="${plan}"]`);

    await expect(card).toBeVisible();
    await expect(icon).toBeVisible();

    const box = await card.boundingBox();
    const art = await icon.boundingBox();
    expect(box, `${plan} card has no box`).not.toBeNull();
    expect(art, `${plan} icon has no box`).not.toBeNull();

    // Fully contained, with the tolerance the renderer needs for rounding.
    const tolerance = 1;
    expect(art!.x).toBeGreaterThanOrEqual(box!.x - tolerance);
    expect(art!.y).toBeGreaterThanOrEqual(box!.y - tolerance);
    expect(art!.x + art!.width).toBeLessThanOrEqual(box!.x + box!.width + tolerance);
    expect(art!.y + art!.height).toBeLessThanOrEqual(box!.y + box!.height + tolerance);
  }
});

test("the two plans sit side by side on a wide screen", async ({ page }) => {
  await page.goto("/#pricing");

  const starter = await page.locator('[data-pricing-card="starter"]').boundingBox();
  const professional = await page.locator('[data-pricing-card="professional"]').boundingBox();

  expect(starter).not.toBeNull();
  expect(professional).not.toBeNull();

  // Same row: tops align. Different columns: the second starts to the right.
  expect(Math.abs(starter!.y - professional!.y)).toBeLessThanOrEqual(2);
  expect(professional!.x).toBeGreaterThan(starter!.x + starter!.width / 2);
});
