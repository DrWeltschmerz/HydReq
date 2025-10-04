import { expect, test } from "@playwright/test";

const waitForHydreq = async (page) => {
  await page.goto("/");
  // Wait for the suites container to appear and populate
  await page.waitForSelector("#suites", { state: "visible" });
  await page.waitForFunction(
    () => document.querySelectorAll("#suites li").length > 0
  );
};

// Basic smoke test: landing page loads and suites container exists
test("landing shows suites container (visreg)", async ({ page, baseURL }) => {
  await waitForHydreq(page);
  const suites = page.locator("#suites");
  await expect(suites).toBeVisible();
  await expect(page.locator("#suites li").first()).toBeVisible();
  await expect(page).toHaveScreenshot("landing.png", {
    fullPage: true,
    animations: "disabled",
  });
});
