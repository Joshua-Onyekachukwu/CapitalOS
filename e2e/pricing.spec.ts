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

test("the plans keep the original two-column layout", async ({ page }) => {
  await page.goto("/#pricing");

  const starter = await page.locator('[data-pricing-card="starter"]').boundingBox();
  const professional = await page.locator('[data-pricing-card="professional"]').boundingBox();
  const heading = page.getByText(/Designed to Fit Every Founder/);

  expect(starter).not.toBeNull();
  expect(professional).not.toBeNull();
  await expect(heading).toBeVisible();
  const headingBox = await heading.boundingBox();

  // Side by side: the Pro card starts to the right of the first card.
  expect(starter!.x + starter!.width).toBeLessThanOrEqual(professional!.x + 2);

  // The section heading belongs to the second column, above the Pro card.
  expect(headingBox).not.toBeNull();
  expect(headingBox!.x).toBeGreaterThan(starter!.x);
  expect(headingBox!.y).toBeLessThan(professional!.y);
});
