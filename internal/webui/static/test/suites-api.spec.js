const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-api hydrateFromSummary', function(){
  it('hydrates badges and details from store/state summary', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <ul id="suites">
        <li data-path="p.yaml">
          <div class="suite-tests" style="display:block"></div>
          <span class="suite-badge status-badge status-unknown" data-status="unknown">·</span>
        </li>
      </ul>
    </body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // suites-state with a summary entry and last status map
    window.hydreqSuitesState = {
      getSuiteSummary: (path)=> ({ summary: { passed:0, failed:1, skipped:0, total:1 }, tests: [{ name:'T', status:'failed', durationMs: 5, messages:['err'] }] }),
      getLastStatus: (path)=> new Map([['T','failed']])
    };

    // suites-dom helpers
    const domCode = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8');
    window.eval(domCode);

    // suites-api
    const apiCode = fs.readFileSync('internal/webui/static/js/suites-api.js','utf8');
    window.eval(apiCode);

    // Pre-create test container to simulate expanded suite
    const testsDiv = document.querySelector('.suite-tests');
    const cont = window.hydreqSuitesDOM.buildTestContainer({ name:'T' }, '', {});
    testsDiv.appendChild(cont);

    // hydrate
    window.hydreqSuitesAPI.hydrateFromSummary('p.yaml');

    const badgeEl = cont.querySelector('.suite-test-status');
    assert.ok(badgeEl.classList.contains('status-fail'));
    const pre = cont.querySelector('pre.message-block.fail');
    assert.ok(pre && /err/.test(pre.textContent));
  });
});
