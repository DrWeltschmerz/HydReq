const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor quick run details dedupe', function(){
  it('does not append duplicate details when render hook exists', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="editorModal">
        <div id="ed_quickrun"></div>
      </div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    // Load module under test
    const code = fs.readFileSync('internal/webui/static/js/editor/run-ui.js','utf8');
    window.eval(code);

    const modal = document.getElementById('editorModal');
    const helpers = {
      appendQuickRunLine: (t)=>{ const qr = modal.querySelector('#ed_quickrun'); const d=document.createElement('div'); d.textContent=t; qr.appendChild(d); },
      getTestIndexByName: ()=>0,
      setTestRecord: ()=>{},
      updateTestBadgeByIndex: ()=>{ 
        // Simulate synchronous re-render triggered by dispatched event handler in editor
        if (typeof window.__ed_renderQuickRunForSelection === 'function') window.__ed_renderQuickRunForSelection();
      },
      fallbackCache: ()=>{},
      getPath: ()=>'/demo.yaml'
    };

    // Pretend editor will re-render from store/state
    window.__ed_renderQuickRunForSelection = function(){
      const qr = document.getElementById('ed_quickrun');
      while (qr.firstChild) qr.removeChild(qr.firstChild);
      const det = document.createElement('details');
      det.className = 'ed-msg-details';
      const sum = document.createElement('summary'); sum.textContent='details'; det.appendChild(sum);
      const pre = document.createElement('pre'); pre.textContent='hello'; det.appendChild(pre);
      qr.appendChild(det);
    };

    const api = window.hydreqEditorRunUI.createHandlers(modal, helpers);
    api.onTest({ name:'t', status:'failed', durationMs: 1, messages:['hello'] });

    const details = modal.querySelectorAll('#ed_quickrun details.ed-msg-details');
    assert.strictEqual(details.length, 1, 'should render exactly one details block');
  });
});
