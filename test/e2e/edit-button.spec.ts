import { expect, test } from "@playwright/test";

test.describe("Editor edit-button per row", () => {
  test("click edit on each suite row opens modal", async ({ page }) => {
    await page.goto("http://localhost:8787");
    // wait for suites to be rendered
    await page.waitForSelector("#suites li", { timeout: 5000 });
    const rows = await page.$$("#suites li");
    expect(rows.length).toBeGreaterThan(0);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Prefer the stable data-path + title attribute the SPA sets on edit buttons
      let editBtn = await row.$('button[title="Open editor"][data-path]');
      if (!editBtn) {
        // fallback: any button with data-path
        editBtn = await row.$("button[data-path]");
      }
      if (!editBtn) {
        // fallback: any button in the row (last resort)
        const btns = await row.$$("button");
        if (btns && btns.length) editBtn = btns[btns.length - 1];
      }

      if (!editBtn) {
        // If still missing, capture helpful debug artifacts and fail with context
        const rowHtml = (await row.innerHTML()).slice(0, 4000);
        const title = await page.title();
        const screenshotPath = `playwright-debug-edit-missing-${i}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        throw new Error(
          `Missing edit button for row ${i}. pageTitle=${title} screenshot=${screenshotPath} rowHTML=${rowHtml}`
        );
      }

      // Prepare for potential confirm dialogs (unsaved changes)
      // Accept the first dialog if it appears (confirm on unsaved changes)
      page.once("dialog", (dialog) => {
        try {
          dialog.accept();
        } catch (e) {}
      });

      await editBtn.click();

      // modal should appear
      await page.waitForSelector("#editorModal .editor-root", {
        timeout: 30000,
      });
      // Instead of relying on the UI to close cleanly (confirm/detach races), forcibly remove the modal so tests don't flake
      await page.evaluate(() => {
        try {
          const m = document.getElementById("editorModal");
          if (m && m.parentNode) m.remove();
          document.body.classList.remove("modal-open");
        } catch (e) {}
      });
    }
  });
});
