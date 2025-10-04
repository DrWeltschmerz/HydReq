const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-api hydrate and setters', function(){
  it('hydrates details into DOM and sets status badges', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <ul id="suites">
        <li data-path="/demo.yaml">
          <div class="suite-tests"></div>
          <span class="suite-badge status-badge">·</span>
        </li>
      </ul>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
  // Load suites-dom and suites-api
  const domCode = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8'); window.eval(domCode);
  const apiCode = fs.readFileSync('internal/webui/static/js/suites-api.js','utf8'); window.eval(apiCode);
    // Provide suites-state facade
    window.hydreqSuitesState = {
      getSuiteSummary: ()=> ({ summary:{ passed:1, failed:1, skipped:0, total:2 }, tests:[
        { name:'A', status:'passed', durationMs:3, messages:[] },
        { name:'B', status:'failed', durationMs:7, messages:['boom'] }
      ] })
    };
  // Build minimal test rows as in real view
  const testsDiv = document.querySelector('li[data-path="/demo.yaml"] .suite-tests');
  testsDiv.appendChild(window.hydreqSuitesDOM.buildTestContainer({ name:'A' }, 'passed', {}));
  testsDiv.appendChild(window.hydreqSuitesDOM.buildTestContainer({ name:'B' }, 'failed', {}));
  // Hydrate from state summary
  window.hydreqSuitesAPI.hydrateFromSummary('/demo.yaml');
    const badge = document.querySelector('li[data-path="/demo.yaml"] .suite-badge');
    // With one failure, badge should be failed ✗
    assert.strictEqual(badge.textContent, '✗');
  // Now set suite test status and details explicitly via API
  window.hydreqSuitesAPI.setSuiteTestStatus('/demo.yaml','A','passed');
  window.hydreqSuitesAPI.setSuiteTestDetails('/demo.yaml','B',['oops']);
  const testContainers = document.querySelectorAll('li[data-path="/demo.yaml"] .suite-test-container');
  assert.ok(testContainers.length >= 2);
  });
});
