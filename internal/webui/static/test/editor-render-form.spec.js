const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor render-form module', function(){
  it('returns getters and updates when selIndex changes', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Minimal stubs used by render-form wiring
    window.hydreqEditorTables = { extractTable: (el, data) => (() => data) };
    window.hydreqEditorForms = {
      suite: { wire: (modal, suite) => ({ suiteVarsGet: () => (suite.vars || {}) }) },
      testmeta: { wire: () => {} },
      request: { wire: (modal, test) => ({ headersGet: () => (test.request && test.request.headers) || {}, queryGet: () => (test.request && test.request.query) || {} }) },
      matrix: { render: (modal, el, mx) => (()=>mx) },
      assert: { wire: (modal, test) => ({ assertHeaderGet: () => (test.assert && test.assert.headerEquals)||{}, assertJsonEqGet: () => (test.assert && test.assert.jsonEquals)||{}, assertJsonContainsGet: () => (test.assert && test.assert.jsonContains)||{}, assertBodyContainsGet: () => (test.assert && test.assert.bodyContains)||[] }) },
      retry: { wire: ()=>{} },
      openapi: { wire: ()=>{} },
    };
    window.hydreqEditorHooks = { hookList: (el, arr) => (()=>arr) };

    // Load modal and render-form
    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8');
    window.eval(modalCode);
    const rfCode = fs.readFileSync('internal/webui/static/js/editor/render-form.js','utf8');
    window.eval(rfCode);

    const modal = window.hydreqEditorModal.open({ title:'Suite', path:'x.yaml' });
    const working = { name:'n', tests: [
      { name:'A', request:{ headers:{H:'1'}, query:{Q:'1'} }, assert:{ headerEquals:{A:'a'} } },
      { name:'B', request:{ headers:{H:'2'}, query:{Q:'2'} }, assert:{ headerEquals:{B:'b'} } }
    ] };

    const change = ()=>{};
    const f1 = window.hydreqEditorRenderForm.render(modal, working, 0, change, {});
    assert.ok(typeof f1.headersGet === 'function', 'headersGet provided');
    assert.deepStrictEqual(f1.headersGet(), { H: '1' });

    const f2 = window.hydreqEditorRenderForm.render(modal, working, 1, change, f1);
    assert.deepStrictEqual(f2.headersGet(), { H: '2' });
    assert.ok(f2.suiteVarsGet === f1.suiteVarsGet, 'suite-level getter preserved across renders');
  });
});
