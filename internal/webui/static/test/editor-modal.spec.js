const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor-modal', function(){
  it('opens modal with title and create banner', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    const code = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8');
    window.eval(code);

    window.hydreqEditorModal.open({ title:'My Suite', create:true, path:'testdata/x.yaml' });
    const modal = document.getElementById('editorModal');
    assert.ok(modal, 'modal exists');
    assert.ok(modal.querySelector('.badge.badge-info'), 'create badge exists');
    const title = modal.querySelector('#ed_title');
    assert.strictEqual(title.textContent, 'My Suite');
  });
});
