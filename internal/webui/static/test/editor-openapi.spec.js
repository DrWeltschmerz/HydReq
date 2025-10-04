const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor OpenAPI form', function(){
  it('renders OpenAPI panel and select visible', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Load modal to build structure
    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8');
    window.eval(modalCode);
    const modal = window.hydreqEditorModal.open({ title:'Suite', path:'x.yaml' });

    // Load openapi form module
    const oapiCode = fs.readFileSync('internal/webui/static/js/editor/forms/openapi.js','utf8');
    window.eval(oapiCode);

    // Wire with a test having explicit openApi override
    const test = { name:'t', openApi: { enabled: true } };
    window.hydreqEditorForms.openapi.wire(modal, test, null);

    const form = document.querySelector('#ed_oapi_form');
    const sel = document.querySelector('#ed_oapi_enabled');

    assert.ok(form, 'OpenAPI form exists');
    assert.ok(sel, 'OpenAPI select exists');
    assert.strictEqual(sel.value, 'true', 'OpenAPI select reflects test override');

    // Ensure not hidden and details is open
    const hidden = form.classList.contains('hidden');
    const details = form.closest('details');
    assert.strictEqual(hidden, false, 'OpenAPI form is not hidden');
    assert.ok(details && details.open, 'OpenAPI details is open');
  });
});
