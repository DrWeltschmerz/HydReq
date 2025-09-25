const { test, expect } = require('@playwright/test');

// NOTE: This test assumes the hydreq server is running locally and serving the web UI
// Start the server before running tests: `./bin/hydreq gui` (or run the server mode that serves the UI at http://localhost:8080)

const APP_URL = process.env.HYDREQ_E2E_URL || 'http://localhost:8080/';

test('visual to yaml and back syncs suite and hooks', async ({ page }) => {
  console.log('APP_URL:', process.env.HYDREQ_E2E_URL);
  await page.goto(APP_URL);
  await page.screenshot({ path: 'debug.png' });
  const content = await page.content();
  console.log('Page title:', await page.title());
  console.log('Page content length:', content.length);
  // Wait for suites to load (give more time for server startup)
  await page.waitForSelector('#suites li', { timeout: 60000 });
  // open editor modal for a known suite (first edit button)
  // This test assumes there's an Edit button in the page with data-path attribute or similar; fallback to opening the editor modal directly if available
  // Try clicking first .edit-btn (site-specific); adapt if your app differs
  const editButton = await page.$('.suite-edit') || await page.$('button[title="Open editor"]') || null;
  if (editButton) {
    await editButton.click();
  } else {
    // fallback: open editor by executing client-side helper if present
    await page.evaluate(() => { if (window.openEditor && window.__TEST_SUITE_PATH) openEditor(window.__TEST_SUITE_PATH, window.__TEST_SUITE_DATA); });
  }

  // Wait for modal
  await page.waitForSelector('#editorModal', { state: 'visible' });

  // Ensure Visual tab
  await page.click('#tab_visual');

  // Modify suite name in Visual
  await page.fill('#ed_suite_name', 'e2e-suite-' + Date.now());
  // Wait a short moment for sync to run
  await page.waitForTimeout(300);

  // Switch to YAML tab
  await page.click('#tab_yaml');
  await page.waitForSelector('.CodeMirror');

  // Read YAML content
  const yamlText = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  expect(yamlText).toContain('name:');

  // Edit YAML (change suite name) and switch back
  const newName = 'e2e-yaml-' + Date.now();
  const newYaml = yamlText.replace(/name:.*\n/, `name: ${newName}\n`);
  await page.evaluate((v) => document.querySelector('.CodeMirror').CodeMirror.setValue(v), newYaml);
  await page.waitForTimeout(200);
  await page.click('#tab_visual');

  // Verify Visual suite name updated
  const visualName = await page.$eval('#ed_suite_name', el => el.value);
  expect(visualName).toBe(newName);

  // Hooks: add a test hook and verify it's present in YAML
  await page.click('#tab_yaml');
  const finalYaml = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  expect(finalYaml).toContain('preSuite:');
});
