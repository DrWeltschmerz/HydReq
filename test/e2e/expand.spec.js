const { test, expect } = require('@playwright/test');

const APP_URL = process.env.HYDREQ_E2E_URL || 'http://localhost:8080/';
// Allow more time in CI
const { test: _test } = require('@playwright/test');
_test.setTimeout(120000);

test('run selected suite and observe runner output', async ({ page }) => {
  await page.goto(APP_URL);
  // Wait for suites to populate
  await page.waitForSelector('#suites li', { timeout: 60000 });

  // If the UI has preselected suites in localStorage, respect that.
  const preselected = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('hydreq.sel') || '[]'); } catch (e) { return []; }
  });

  if (!preselected || preselected.length === 0) {
    // Derive the first available suite path via the editor endpoint and
    // store it into localStorage so the Run button will run a known suite.
    const suitesResp = await page.request.get(APP_URL + '/api/editor/suites');
    if (suitesResp.ok()){
      const suites = await suitesResp.json();
      if (Array.isArray(suites) && suites.length > 0){
        const first = suites[0];
        const candidate = (typeof first === 'string') ? first : (first.path || first.Path || first.name || null);
        if (candidate){
          await page.evaluate((c)=>{ 
            try{ 
              localStorage.setItem('hydreq.sel', JSON.stringify([c])); 
              selected = new Set([c]);  // update the in-memory selected set
              if (typeof refresh === 'function') refresh(); 
            }catch(e){} 
          }, candidate);
          // trigger a UI refresh so the selection is reflected
          await page.evaluate(()=>{ try{ if (typeof refresh === 'function') refresh(); }catch(e){} });
          // Debug: dump page content
          const html = await page.content();
          console.log('Page HTML after refresh:', html.substring(0, 2000)); // first 2000 chars
          const selCountText = await page.evaluate(() => document.getElementById('selCount')?.textContent);
          console.log('selCount text:', selCountText);
          const suitesHtml = await page.evaluate(() => document.getElementById('suites')?.innerHTML);
          console.log('Suites HTML:', suitesHtml);
          // wait for selection count to reflect 1 selected
          await page.waitForFunction(() => {
            const el = document.getElementById('selCount');
            return el && el.textContent && el.textContent.trim().startsWith('1');
          }, { timeout: 5000 });
        }
      }
    }
  }

  // Click the Run Selected button in the UI
  await page.click('#run');

  // Wait for the runner to render at least one test start line ('.run')
  await page.waitForFunction(() => {
    const el = document.getElementById('results');
    return el && el.textContent && el.textContent.trim().length > 0;
  }, {}, { timeout: 60000 });
});
