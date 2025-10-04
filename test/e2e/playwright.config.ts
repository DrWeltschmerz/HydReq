import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.HYDREQ_E2E_URL || "http://localhost:8787/";

const projects: any[] = [
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1920, height: 1080 },
    },
  },
];

// Optional demo project (runs only when DEMO=1), records video/screenshots and uses slowMo
if (process.env.DEMO === "1") {
  projects.push({
    name: "demo",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1920, height: 1080 },
      video: "on",
      screenshot: "on",
      trace: "on",
      launchOptions: { slowMo: 250 },
    },
  });
}

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects,
});
