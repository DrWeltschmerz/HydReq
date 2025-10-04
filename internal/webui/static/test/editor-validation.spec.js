const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor validation helpers', function(){
  it('validates fields and shows errors in DOM', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="m">
        <div><input id="ed_suite_name"/></div>
        <div><input id="ed_suite_baseurl"/></div>
      </div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    const code = fs.readFileSync('internal/webui/static/js/editor/validation.js','utf8');
    window.eval(code);

    const v = window.hydreqEditorValidation;
    // Basic validation
    const e1 = v.validateField('name','', 'suite');
    assert.ok(e1.length > 0);
    const e2 = v.validateField('baseUrl','not-a-url','suite');
    assert.ok(e2.some(s=> /valid URL/i.test(s)));

    // Show errors in DOM
    const nameInput = document.getElementById('ed_suite_name');
    v.showFieldValidation(nameInput, ['Suite name is required']);
    const err = nameInput.parentNode.querySelector('.validation-error');
    assert.ok(err && /required/i.test(err.textContent));

    // Wire triggers yaml mirror on input events without throwing
    v.wire(document.getElementById('m'));
    nameInput.value = 'X';
    nameInput.dispatchEvent(new window.Event('input'));
  });
});
