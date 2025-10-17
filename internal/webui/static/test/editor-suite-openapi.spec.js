const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suite-level OpenAPI UI', function(){
  it('round-trips openApi.file and enabled', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Stubs
    window.hydreqEditorTables = { kvTable: () => (()=>({})) };

    // Load modules
    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8');
    window.eval(modalCode);
    const suiteCode = fs.readFileSync('internal/webui/static/js/editor/forms/suite.js','utf8');
    window.eval(suiteCode);
    const normalizeCode = fs.readFileSync('internal/webui/static/js/editor/normalize.js','utf8');
    window.eval(normalizeCode);
    const collectCode = fs.readFileSync('internal/webui/static/js/editor/collect.js','utf8');
    window.eval(collectCode);

    const parsed = { name:'n', openApi: { file: 'specs/openapi.yaml', enabled: true }, tests: [] };
    const working = window.hydreqEditorNormalize.normalize(parsed);
    const modal = window.hydreqEditorModal.open({ title:'Suite', path:'x.yaml' });
    const fns = window.hydreqEditorForms.suite.wire(modal, working, null);

    // UI should reflect values
    const fileEl = document.getElementById('ed_suite_openapi_file');
    const enEl = document.getElementById('ed_suite_openapi_enabled');
    assert.strictEqual(fileEl.value, 'specs/openapi.yaml');
    assert.strictEqual(enEl.checked, true);

    // Collect back
    const out = window.hydreqEditorCollect.collect(modal, working, -1, fns);
    assert.ok(out.openApi);
    assert.strictEqual(out.openApi.file, 'specs/openapi.yaml');
    assert.strictEqual(out.openApi.enabled, true);
  });
});
