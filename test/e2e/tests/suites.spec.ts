import { expect, test } from "@playwright/test";

const waitForHydreq = async (page) => {
  await page.goto("/");
  // Wait for the suites container to appear
  await page.waitForSelector("#suites", { state: "visible" });
};

// Basic smoke test: landing page loads and suites container exists
test("landing shows suites container", async ({ page, baseURL }) => {
  await waitForHydreq(page);
  const suites = page.locator("#suites");
  await expect(suites).toBeVisible();
});
