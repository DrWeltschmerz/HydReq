const { test, expect } = require('@playwright/test');

const APP_URL = process.env.HYDREQ_E2E_URL || 'http://localhost:8080/';

test.setTimeout(120000);

test('download reports after run', async ({ page }) => {
  await page.goto(APP_URL);
  // Wait for suites to populate
  await page.waitForSelector('#suites li', { timeout: 60000 });

  // Select the first suite
  const firstSuite = await page.locator('#suites li').first();
  await firstSuite.click();

  // Click the Run button
  await page.click('#run');

  // Wait for runner output
  await page.waitForFunction(() => {
    const el = document.getElementById('results');
    return el && el.textContent && el.textContent.trim().length > 0;
  }, { timeout: 60000 });

  // Now, click the download button for the first suite (HTML download)
  const downloadBtn = await page.locator('#suites li').first().locator('button[title="Download"]');
  await downloadBtn.click();

  // Click the HTML download option
  await page.locator('text=Download HTML').first().click();

  // Wait for download
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/\.html$/);

  // Optionally, check content
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) {
    content += chunk;
  }
  expect(content).toContain('<html>'); // Basic check
});