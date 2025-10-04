const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-dom headers and menus', function(){
  it('buildDownloadMenu toggles menu and invokes callback', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const code = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8'); window.eval(code);
    let called = null;
    const menu = window.hydreqSuitesDOM.buildDownloadMenu('path/demo', (p, fmt)=>{ called = { p, fmt }; });
    document.body.appendChild(menu);
    // open menu
    menu.querySelector('button').click();
    // click JSON
    const item = menu.querySelector('.menu-item');
    item.click();
    assert.ok(called);
    assert.strictEqual(called.p, 'path/demo');
    assert.strictEqual(called.fmt, 'json');
  });

  it('renderHeaderTags/env reflect globals', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="activeTagsTopWrap" class="invisible"><div id="activeTagsTop"></div></div>
      <div id="activeEnvTopWrap" class="invisible"><div id="activeEnvTop"></div></div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const code = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8'); window.eval(code);
    // Provide getters
    window.getSelectedTags = ()=> ['smoke','auth'];
    window.parseEnv = ()=> ({ FOO:'1', BAR:'2' });
    window.hydreqSuitesDOM.renderHeaderTags();
    window.hydreqSuitesDOM.renderHeaderEnv();
    const tWrap = document.getElementById('activeTagsTopWrap');
    const eWrap = document.getElementById('activeEnvTopWrap');
    assert.ok(!tWrap.classList.contains('invisible'));
    assert.ok(!eWrap.classList.contains('invisible'));
  });
});
