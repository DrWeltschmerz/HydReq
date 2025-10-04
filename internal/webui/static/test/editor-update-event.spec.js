const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor updates on hydreq:editor:test:update', function(){
  it('re-renders tests list and shows status badge', async function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only', url: 'http://localhost' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Stubs
    window.isDocDark = () => false;
    window.jsyaml = { dump: (obj)=> 'name: Demo', load: (txt)=> ({ name: 'Demo', tests: [] }) };
    // Load modules required for editor
    const utils = fs.readFileSync('internal/webui/static/js/utils.js','utf8'); window.eval(utils);
    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8'); window.eval(modalCode);
    const testsListCode = fs.readFileSync('internal/webui/static/js/editor/tests-list.js','utf8'); window.eval(testsListCode);
    const normalizeCode = fs.readFileSync('internal/webui/static/js/editor/normalize.js','utf8'); try{ window.eval(normalizeCode); }catch{}
    const editorCode = fs.readFileSync('internal/webui/static/js/editor.js','utf8'); window.eval(editorCode);

    const data = { parsed: { name: 'Demo', tests: [ { name: 'A', request: { method:'GET', url:'/x' } } ] } };
    window.openEditor('/tmp/demo.yaml', data);

    // Initially, no badge
    let badge = document.querySelector('.ed-test-status');
    assert.ok(badge == null || badge.textContent === '' || badge.textContent === '·');

    // Dispatch update which editor listens to -> should trigger render and show status
    const ev = new window.CustomEvent('hydreq:editor:test:update', { detail: { path: '/tmp/demo.yaml', name: 'A', idx: 0, status: 'passed', messages: [] } });
    document.dispatchEvent(ev);

    // Allow microtask
    await Promise.resolve();
    badge = document.querySelector('.ed-test-status');
    assert.ok(badge, 'badge exists after update');
    assert.strictEqual(badge.textContent, '✓');
  });
});
