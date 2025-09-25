const { test, expect } = require('@playwright/test');

const APP_URL = process.env.HYDREQ_E2E_URL || 'http://localhost:8080/';

test.setTimeout(120000);

test('tags filter usage', async ({ page }) => {
  page.on('console', msg => console.log('PAGE:', msg.text()));
  await page.goto(APP_URL);
  // Wait for page load
  await page.waitForSelector('#tags', { timeout: 60000 });

  // Set tags filter
  await page.fill('#tags', 'smoke');

  // Select a suite
  const suiteLi = await page.locator('#suites li').filter({ hasText: 'tags.yaml' });
  await suiteLi.click();
  await page.waitForSelector('#selCount:has-text("1")');

  // Click run
  await page.click('#run');

  // Wait for output
  await page.waitForFunction(() => {
    const el = document.getElementById('results');
    return el && el.textContent && el.textContent.trim().length > 0;
  });

  // Check that smoke test ran (not the slow one)
  const resultsText = await page.textContent('#results');
  expect(resultsText).toContain('smoke headers');
  expect(resultsText).not.toContain('slow-only');
});
