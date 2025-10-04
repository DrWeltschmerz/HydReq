const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('run-ui quick run prep', function(){
  it('opens quick-run details on prepare', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="editorModal">
        <details id="ed_quickrun_box"><summary>Quick</summary><div id="ed_quickrun"></div></details>
      </div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const runUi = fs.readFileSync('internal/webui/static/js/editor/run-ui.js','utf8'); window.eval(runUi);
    const modal = document.getElementById('editorModal');
    // prepare() is invoked via createHandlers in real flow; test prepare directly
    window.hydreqEditorRunUI.prepare(modal, 'test');
    const det = document.getElementById('ed_quickrun_box');
    assert.strictEqual(det.open, true);
  });
});
