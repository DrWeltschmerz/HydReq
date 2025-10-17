import { defineConfig, devices } from "@playwright/test";

declare const process: any;

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

// Optional demo projects (run only when DEMO=1), records video/screenshots using full browsers.
if (process.env.DEMO === "1") {
  const rawList = (process.env.DEMO_PROJECTS || "demo-chrome")
    .split(",")
    .map((item: string) => item.trim())
    .filter(Boolean);
  const demoNames = rawList.length > 0 ? rawList : ["demo-chrome"];

  demoNames.forEach((name: string) => {
    switch (name) {
      case "demo-chrome":
        projects.push({
          name,
          use: {
            ...devices["Desktop Chrome"],
            viewport: { width: 1920, height: 1080 },
            channel: "chrome",
            video: "on",
            screenshot: "on",
            trace: "on",
            colorScheme: "dark",
            headless: false,
            launchOptions: {
              slowMo: 200,
              args: ["--window-size=1920,1080"],
            },
          },
        });
        break;
      case "demo-firefox":
        projects.push({
          name,
          use: {
            ...devices["Desktop Firefox"],
            viewport: { width: 1920, height: 1080 },
            channel: "firefox",
            video: "on",
            screenshot: "on",
            trace: "on",
            colorScheme: "dark",
            headless: false,
            launchOptions: {
              slowMo: 200,
            },
          },
        });
        break;
      default:
        console.warn(`Unknown demo project "${name}"; skipping.`);
    }
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
