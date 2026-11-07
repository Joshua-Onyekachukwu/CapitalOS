import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

// Credentials live outside git: .env.e2e.local is ignored by `.env*`.
loadEnv({ path: path.resolve(__dirname, ".env.e2e.local"), quiet: true });
loadEnv({ path: path.resolve(__dirname, ".env.local"), quiet: true });

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://capital-os-nine.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Uses the system Edge build: the bundled Chromium download is not required
  // for a smoke test, and this machine already has a supported browser.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "msedge" } }],
});
