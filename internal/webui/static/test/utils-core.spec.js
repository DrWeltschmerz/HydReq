const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('utils core functions', function(){
  it('slugify and pct behave correctly', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const utils = fs.readFileSync('internal/webui/static/js/utils.js','utf8'); window.eval(utils);
    assert.strictEqual(window.slugify('Hello, World!  '), 'hello-world');
    assert.strictEqual(window.pct(3, 10), 30);
    assert.strictEqual(window.pct(0, 0), 0);
  });

  it('setBar sets width and aria attributes', function(){
    const dom = new JSDOM(`<!doctype html><html><body><div id="bar"></div></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const utils = fs.readFileSync('internal/webui/static/js/utils.js','utf8'); window.eval(utils);
    const el = document.getElementById('bar');
    window.setBar(el, 5, 20);
    assert.ok(el.style.width.includes('25%'));
    assert.strictEqual(el.getAttribute('role'), 'progressbar');
    assert.strictEqual(el.getAttribute('aria-valuenow'), '5');
    assert.strictEqual(el.getAttribute('aria-valuemax'), '20');
  });

  it('themeToDaisy/applyTheme switch classes/data-theme', function(){
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const utils = fs.readFileSync('internal/webui/static/js/utils.js','utf8'); window.eval(utils);
    window.applyTheme('dark');
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
    assert.ok(document.body.classList.contains('dark'));
    window.applyTheme('catppuccin-mocha');
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dracula');
    assert.ok(document.body.classList.contains('dark'));
    assert.ok(document.body.classList.contains('catppuccin-mocha'));
  });

  it('renderActiveEnv renders pills and header mirror', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="env_active"></div>
      <div id="activeEnvTopWrap" class="invisible"><div id="activeEnvTop"></div></div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;
    const utils = fs.readFileSync('internal/webui/static/js/utils.js','utf8'); window.eval(utils);
    window.renderActiveEnv({ FOO:'x', BAR:'y' });
    const active = document.getElementById('env_active');
    assert.strictEqual(active.children.length, 2);
    const wrap = document.getElementById('activeEnvTopWrap');
    assert.ok(!wrap.classList.contains('invisible'));
    const top = document.getElementById('activeEnvTop');
    assert.ok(top.children.length >= 2);
  });
});
