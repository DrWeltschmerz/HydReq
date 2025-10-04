const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor Matrix panel', function(){
  it('renders Matrix panel visible by default', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8');
    window.eval(modalCode);

    window.hydreqEditorModal.open({ title:'Suite', path:'x.yaml' });

    const matrixDetails = document.querySelector('#editorModal details .ed-summary');
    const matrixForm = document.querySelector('#ed_matrix');

    assert.ok(matrixForm, 'Matrix form exists');
    const details = matrixForm.closest('details');
    assert.ok(details && details.open, 'Matrix details is open');
    assert.strictEqual(details.classList.contains('tight'), false, 'Matrix panel does not have tight class');
  });
});
