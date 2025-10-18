import { expect, test } from "@playwright/test";
import { throttleNetwork } from "../utils/net-throttle";

// Run this spec only when DEMO=1 to avoid interfering with normal CI signal
const shouldRun = process.env.DEMO === "1";
(shouldRun ? test.describe : test.describe.skip)(
  "Demo showcase (runner + editor)",
  () => {
    test("end-to-end showcase with throttled network", async ({
      page,
      context,
    }) => {
      // Add a small timestamp overlay to prove freshness in the recorded video
      await context.addInitScript(() => {
        try {
          function ensureStamp() {
            try {
              const id = "__demo_stamp";
              let el = document.getElementById(id) as HTMLDivElement | null;
              if (!el) {
                el = document.createElement("div");
                el.id = id;
                el.style.position = "fixed";
                el.style.zIndex = String(2147483647);
                el.style.top = "8px";
                el.style.left = "8px";
                el.style.padding = "4px 8px";
                el.style.borderRadius = "4px";
                el.style.fontSize = "12px";
                el.style.fontFamily = "monospace";
                el.style.pointerEvents = "none";
                el.style.background = "rgba(0,0,0,0.6)";
                el.style.color = "#ddd";
              }
              const d = new Date();
              el!.textContent = `HydReq Demo ${d.toISOString()}`;
              (document.body || document.documentElement).appendChild(el!);
            } catch {}
          }
          // Try immediately, then until body exists
          if (document.readyState === "loading") {
            const t = setInterval(() => {
              if (document.body) {
                ensureStamp();
                clearInterval(t);
              }
            }, 50);
          } else {
            ensureStamp();
          }
          // Also refresh on visibility change as a cheap hook for SPA updates
          document.addEventListener("visibilitychange", () => ensureStamp());
        } catch {}
      });
      // Try to reduce white flash by setting dark background before navigation
      await context.addInitScript(() => {
        try {
          const style = document.createElement("style");
          style.id = "__pre_bg";
          style.textContent = "html,body{background:#0b0e14 !important;}";
          document.documentElement.appendChild(style);
        } catch {}
      });

      // Ensure app auto-refresh is disabled and auto-scroll off for demo
      await context.addInitScript(() => {
        try {
          localStorage.setItem("hydreq.autoRefreshSuites", "0");
          localStorage.setItem("hydreq.autoScroll", "0");
        } catch {}
      });

      // Prefer dark color scheme
      await context.addInitScript(() => {
        try {
          const mql = window.matchMedia;
          (window as any).__force_dark = true;
        } catch {}
      });

      // Throttle a bit so UI streams are visible on video
      await throttleNetwork(page, {
        latencyMs: 600,
        downloadKbps: 600,
        uploadKbps: 256,
      });

      await page.goto("/");
      // Refresh the overlay once after navigation to guarantee visibility
      await page.evaluate(() => {
        try {
          const id = "__demo_stamp";
          const el = document.getElementById(id);
          if (el) el.textContent = `HydReq Demo ${new Date().toISOString()}`;
        } catch {}
      });
      await page.waitForSelector("#suites", { state: "visible" });
      // Additionally poll backend suites endpoint until it responds OK
      await page
        .waitForFunction(
          async () => {
            try {
              const res = await fetch("/api/editor/suites", {
                cache: "no-store",
              });
              if (!res.ok) return false;
              const data = await res.json();
              return Array.isArray(data) && data.length > 0;
            } catch {
              return false;
            }
          },
          { timeout: 15000 }
        )
        .catch(() => {});
      // Wait for backend/frontend handshake to finish (avoid transient connection errors)
      await page.waitForSelector("#results", { state: "visible" });
      await page
        .waitForFunction(
          () => {
            const el = document.getElementById("results");
            return !!el && /HYDREQ[-: ]FINAL/i.test(el.textContent || "");
          },
          { timeout: 10000 }
        )
        .catch(() => {});

      // Select a specific suite to show stages clearly: httpbin smoke (testdata/example.hrq.yaml)
      const httpbinSuite = page.locator('#suites li:has-text("httpbin smoke")');
      await expect(httpbinSuite).toBeVisible();
      await httpbinSuite.click();
      await expect(page.locator("#selCount")).toContainText("1 selected");

      // Runner view: run the selected httpbin smoke suite
      await expect(httpbinSuite).toBeVisible();
      // run selected
      const runBtn = page.locator("#run");
      await expect(runBtn).toBeVisible();
      await runBtn.click();

      // Wait for textual stage header and summary in results
      const results = page.locator("#results");
      await expect(results).toContainText("--- stage 0 ---", {
        timeout: 20000,
      });
      await expect(results).toContainText("Batch summary", { timeout: 30000 });

      // Open editor for a representative suite
      const suiteName = "js-hooks.hrq.yaml";
      const suiteItem = page
        .locator(`#suites li[data-path$="${suiteName}"]`)
        .first();
      await expect(suiteItem).toBeVisible();
      await suiteItem.locator('button[aria-label="Open editor"]').click();
      const modal = page.locator("#editorModal");
      await expect(modal).toBeVisible();

      // Kick off suite run from editor to show streaming results + stage grouping
      const runSuiteBtn = modal.locator("#ed_run_suite");
      await expect(runSuiteBtn).toBeVisible();
      await runSuiteBtn.click();
      await expect(modal.locator("#ed_suiteresults")).toBeVisible();
      await expect(modal.locator("#ed_suiteresults")).toContainText(
        "--- stage",
        { timeout: 20000 }
      );

      // Quick visual captures for the demo (retained by Playwright demo project)
      await expect(modal).toHaveScreenshot("demo-editor-running.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.02,
      });
    });
  }
);
