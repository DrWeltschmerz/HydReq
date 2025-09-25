// Playwright config for HydReq E2E
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  retries: 0,
  use: {
    headless: true,
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
