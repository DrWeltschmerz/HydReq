const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites badge re-hydration', function(){
  it('sets suite badge from summary when no test rows exist', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <ul id="suites">
        <li data-path="/rehydrate.yaml">
          <div class="suite-tests"></div>
          <span class="suite-badge status-badge status-unknown" data-status="unknown">·</span>
        </li>
      </ul>
    </body></html>`, { runScripts: 'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    // Provide a summary with one failure
    window.hydreqSuitesState = {
      getSuiteSummary: ()=> ({
        summary: { passed: 0, failed: 1, skipped: 0, total: 1 },
        tests: [{ name:'T1', status:'failed', durationMs: 3, messages:['boom'] }]
      })
    };

    // Load dependencies
    const domCode = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8'); window.eval(domCode);
    const apiCode = fs.readFileSync('internal/webui/static/js/suites-api.js','utf8'); window.eval(apiCode);

    // Call hydrate without prebuilt rows
    window.hydreqSuitesAPI.hydrateFromSummary('/rehydrate.yaml');

    const badge = document.querySelector('li[data-path="/rehydrate.yaml"] .suite-badge');
    assert.strictEqual(badge.textContent, '✗');
    assert.ok(badge.classList.contains('status-fail'));
  });
});
