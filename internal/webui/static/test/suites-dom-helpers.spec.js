const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-dom helpers (show/hide and details)', function(){
  it('toggles hidden/open classes via show/hide and handles details edge cases', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="root"><div class="suite-test-container"><div class="suite-test-item"></div></div></div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    const code = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8');
    window.eval(code);

    const el = document.createElement('div');
    window.hydreqSuitesDOM.show(el);
    assert.ok(el.classList.contains('open'));
    assert.ok(!el.classList.contains('hidden'));
    window.hydreqSuitesDOM.hide(el);
    assert.ok(el.classList.contains('hidden'));
    assert.ok(!el.classList.contains('open'));

    // updateTestDetails should create details when absent
    const cont = document.querySelector('.suite-test-container');
    window.hydreqSuitesDOM.updateTestDetails(cont, 'failed', ['x']);
    const det = cont.querySelector('details.suite-test-details');
    assert.ok(det);
    const pre = det.querySelector('pre.message-block.fail');
    assert.ok(pre && /x/.test(pre.textContent));

    // for skipped with no messages it should say skipped
    window.hydreqSuitesDOM.updateTestDetails(cont, 'skipped', []);
    const pre2 = det.querySelector('pre.message-block.skip');
    assert.ok(pre2 && /skipped/i.test(pre2.textContent));
  });
});
