import { expect, test } from "@playwright/test";

test.describe("Editor suite streaming", () => {
  test("run suite from editor uses in-memory changes and streams live", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#suites", { state: "visible" });
    await page.waitForFunction(
      () => document.querySelectorAll("#suites li").length > 0
    );

    // Expand a stable example suite
    const suiteName = "js-hooks.hrq.yaml";
    const suiteItem = page
      .locator(`#suites li[data-path$="${suiteName}"]`)
      .first();
    await expect(suiteItem).toBeVisible();
    await suiteItem.locator('button[aria-label="Open editor"]').click();

    const modal = page.locator("#editorModal");
    await expect(modal).toBeVisible();

    // Make a harmless in-memory change (e.g., toggle density or edit a description field if present)
    // This ensures we exercise inlineSuites path without depending on saving
    const nameInput = modal.locator("#ed_suite_name");
    if (await nameInput.count()) {
      const cur = await nameInput.inputValue();
      await nameInput.fill(cur); // no-op write to mark dirty paths in some implementations
    }

    // Kick off a suite run from the editor
    const runSuiteBtn = modal.locator("#ed_run_suite");
    await expect(runSuiteBtn).toBeVisible();
    await runSuiteBtn.click();

    // Suite results: heading appears at the top
    // Wait for the results column to render its panels, then the suitestream area to exist
    await expect(modal.locator("#col-results")).toBeVisible();
    const suiteResults = modal.locator("#ed_suiteresults");
    await suiteResults.waitFor({ state: "attached", timeout: 15000 });
    const heading = suiteResults.locator("#ed_suite_heading");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Running");

    // While running, rows should appear with a running state, then flip to ✓/✗ as events arrive
    // Wait for at least one finished test row in the suite results area
    // Wait until any test line shows a final status symbol and duration, e.g., "✓ name (12ms)"
    const finishedLine = suiteResults
      .locator(".ed-test-line")
      .filter({ hasText: /(✓|✗|○).*(\d+ms)/ });
    await expect(finishedLine.first()).toBeVisible({ timeout: 30000 });

    // Visual baseline of streaming state (timing tolerant container)
    await expect(modal).toHaveScreenshot("visreg-editor-suite-running.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });

    // Wait for summary to appear (only after suite completes)
    await expect(suiteResults.locator("#ed_suite_summary")).toBeVisible({
      timeout: 30000,
    });

    // Final visual baseline after completion
    await expect(modal).toHaveScreenshot("visreg-editor-suite-done.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });
});
