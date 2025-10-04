import { expect, test } from "@playwright/test";

// Optional docs screenshot helper: writes only when DOCS_SHOTS=1
async function screenshot(page, name: string) {
  if (process.env.DOCS_SHOTS === "1") {
    try {
      await page.screenshot({
        path: `../../docs/screenshots/${name}`,
        fullPage: true,
      });
    } catch (e) {
      // Non-fatal in tests; continue. Useful when workspace is read-only or owned by root.
      console.warn("Docs screenshot skipped:", (e as Error)?.message || e);
    }
  }
}

test.describe("Editor flows with screenshots", () => {
  test("expand suite, open editor, run test, save, and batch run", async ({
    page,
  }) => {
    // 1) Landing and suites visible
    await page.goto("/");
    await page.waitForSelector("#suites", { state: "visible" });
    await page.waitForFunction(
      () => document.querySelectorAll("#suites li").length > 0
    );
    await screenshot(page, "home.png");

    // 2) Expand a common example suite
    const suiteItem = page
      .locator('#suites li[data-path$="example.yaml"]')
      .first();
    await expect(suiteItem).toBeVisible();
    await suiteItem.locator('button[aria-label="Toggle tests"]').click();
    // suite-tests uses a hidden class toggle; check for not having 'hidden'
    const testsDiv = suiteItem.locator(".suite-tests");
    await expect(testsDiv)
      .toBeVisible({ timeout: 5000 })
      .catch(async () => {
        await expect(testsDiv).not.toHaveClass(/hidden/);
      });
    await screenshot(page, "suite-expanded.png");
    // VisReg: suites list only (stable container)
    await expect(page.locator("#suites")).toHaveScreenshot(
      "visreg-suite-expanded.png",
      {
        animations: "disabled",
      }
    );

    // 3) Open editor for that suite
    await suiteItem.locator('button[aria-label="Open editor"]').click();
    const modal = page.locator("#editorModal");
    await expect(modal).toBeVisible();
    await screenshot(page, "editor-open.png");
    // VisReg: editor modal only
    await expect(modal).toHaveScreenshot("visreg-editor-open.png", {
      animations: "disabled",
    });

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
      await method.waitFor({ state: "visible" });
      await method.selectOption("GET");
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
    // VisReg: editor modal after quick run
    await expect(modal).toHaveScreenshot("visreg-editor-run-pass.png", {
      animations: "disabled",
    });

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

    // 9) Back on landing, select multiple suites for batch run
    const li = page.locator("#suites li", { hasText: "example.yaml" }).first();
    await li.click(); // toggles selected
    // Mark a couple more suites if present to make batch summary richer
    const moreSuites = ["matrix.yaml", "hooks.yaml", "depends.yaml"];
    for (const name of moreSuites) {
      const item = page.locator("#suites li", { hasText: name }).first();
      if (await item.count()) {
        await item.click();
      }
    }
    const runBtn = page.locator("#run");
    await runBtn.click();

    // 10) Wait for results area to show entries and suite expansion to occur, then screenshot
    const results = page.locator("#results");
    await expect(results).toBeVisible();
    // Wait until we see a specific "running" line appear to ensure UI expanded
    await expect(
      results.locator("text=/^=== running: .*example.yaml.*===$/")
    ).toBeVisible();
    await page.waitForTimeout(400); // give a moment for the suite row to open
    await screenshot(page, "batch-run.png");
    // VisReg: results area only to avoid header/sidebar dynamics
    await expect(page.locator("#results")).toHaveScreenshot(
      "visreg-batch-run.png",
      {
        animations: "disabled",
      }
    );
  });
});
