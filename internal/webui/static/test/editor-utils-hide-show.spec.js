const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor utils hide/show', function(){
  it('sets classes and style.display as fallback', function(){
    const dom = new JSDOM(`<!doctype html><html><body><div id="x"></div></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    const code = fs.readFileSync('internal/webui/static/js/editor/utils.js','utf8');
    window.eval(code);

    const el = document.getElementById('x');
    window.hydreqEditorUtils.show(el);
    assert.ok(el.classList.contains('open'));
    assert.strictEqual(el.style.display, '');
    window.hydreqEditorUtils.hide(el);
    assert.ok(el.classList.contains('hidden'));
    assert.strictEqual(el.style.display, 'none');
  });
});
