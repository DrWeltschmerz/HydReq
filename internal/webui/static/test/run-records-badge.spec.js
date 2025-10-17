const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('run-records suite badge no-downgrade', function(){
  it('does not downgrade failed badge to passed/skipped', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="editorModal"><span id="ed_path">/demo.yaml</span></div>
      <ul id="suites">
        <li data-path="/demo.yaml"><span class="suite-badge" data-status="unknown">·</span></li>
      </ul>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    // Minimal store to support aggregate and publish
    let badge = 'unknown'; let summary = null; const tests = {};
    window.hydreqStore = {
      getSuite: (p)=> ({ tests, badge }),
      setBadge: (p, b)=> { badge = b; },
      setSummary: (p, s)=> { summary = s; },
      setTest: (p, name, rec)=> { tests[name] = rec; }
    };

    const code = fs.readFileSync('internal/webui/static/js/editor/run-records.js','utf8');
    window.eval(code);
  const modal = document.getElementById('editorModal');
    const getWorking = ()=>({ tests:[{ name:'A' }] });
    const getSelIndex = ()=>0;

    const rr = window.hydreqEditorRunRecords.create(modal, getWorking, getSelIndex, ()=>{});

    // Set failed first -> badge must be failed
    rr.setTestRecord('A', 'failed', 10, ['boom']);
    const sb = document.querySelector('.suite-badge');
    assert.strictEqual(sb.textContent, '✗');
    assert.strictEqual(sb.dataset.status, 'failed');
    assert.strictEqual(badge, 'failed');

    // Now set passed -> should not downgrade the UI when already failed
    rr.setTestRecord('A', 'passed', 5, []);
    // Badge remains failed
    assert.strictEqual(sb.textContent, '✗');
    assert.strictEqual(sb.dataset.status, 'failed');
    assert.strictEqual(badge, 'failed');

  // Set skipped afterward should NOT downgrade failed suite badge
  rr.setTestRecord('A', 'skipped', 0, []);
  assert.strictEqual(badge, 'failed');
  });
});
