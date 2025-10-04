import { expect, test } from "@playwright/test";

async function screenshot(page, name: string) {
  await page.screenshot({
    path: `../../docs/screenshots/${name}`,
    fullPage: true,
  });
}

test.describe("Editor flows with screenshots", () => {
  test("expand suite, open editor, run test, save, and batch run", async ({
    page,
  }) => {
    // 1) Landing and suites visible
    await page.goto("/");
    await page.waitForSelector("#suites", { state: "visible" });
    await screenshot(page, "home.png");

    // 2) Find a common example suite and expand it
    const suiteItem = page
      .locator("#suites li", { hasText: "example.yaml" })
      .first();
    await expect(suiteItem).toBeVisible();
    await suiteItem.locator('button[aria-label="Toggle tests"]').click();
    await screenshot(page, "suite-expanded.png");

    // 3) Open editor for that suite
    await suiteItem.locator('button[aria-label="Open editor"]').click();
    const modal = page.locator("#editorModal");
    await expect(modal).toBeVisible();
    await screenshot(page, "editor-open.png");

    // 4) Select the first test in editor if needed (some editors have a tests list)
    // If there is a tests list with items, click the first; otherwise skip.
    const testsList = modal.locator("#ed_tests_list .ed-test-item").first();
    if (await testsList.count().then((c) => c > 0)) {
      await testsList.click();
    }

    // 5) Edit request details to a known working endpoint for examples
    // Set method to GET and URL to /status/200 (works with httpbin)
    const method = modal.locator("#ed_method");
    const url = modal.locator("#ed_url");
      if (await method.count()) {
        await method.waitFor({ state: 'visible' });
        await method.selectOption('GET');
      }
    if (await url.count()) await url.fill("/status/200");

    // 6) Run selected test from editor (quick run)
    const runTestBtn = modal.locator("#ed_run_test");
    await runTestBtn.click();

    // Wait for quick run lines to appear and show a pass/ok indicator
    const quickRunBox = modal.locator("#ed_quickrun");
    await expect(quickRunBox).toBeVisible();
    await quickRunBox.waitFor({ state: "visible" });
    await page.waitForTimeout(500); // allow hydration
    await screenshot(page, "editor-run-pass.png");

    // 7) Save changes
    const saveBtn = modal.locator("#ed_save");
    if (await saveBtn.count()) {
      await saveBtn.click();
      // Give a moment for toast/UI acknowledgment if any
      await page.waitForTimeout(300);
    }

    // 8) Close modal if there is a close control (fallback: press Escape)
    const closeBtn = modal.locator(
      '[data-action="close"], .modal-close, button[title="Close"], #ed_close'
    );
    if (await closeBtn.count()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }

    // 9) Back on landing, select the same suite and run batch
    const li = page.locator("#suites li", { hasText: "example.yaml" }).first();
    await li.click(); // toggles selected
    const runBtn = page.locator("#run");
    await runBtn.click();

    // 10) Wait for results area to show entries, then screenshot
    const results = page.locator("#results");
    await expect(results).toBeVisible();
    await page.waitForTimeout(750);
    await screenshot(page, "batch-run.png");
  });
});
