const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('state/env read and renderActive', function(){
  it('reads env rows and renders active pills safely', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="env_kv_list">
        <div class="env-row"><input class="env-k" value="API_KEY"><input class="env-v" value="secret"></div>
        <div class="env-row"><input class="env-k" value=" "><input class="env-v" value="ignored"></div>
        <div class="env-row"><input class="env-k" value="BASE_URL"><input class="env-v" value="http://example"></div>
      </div>
      <div id="activeEnvTopWrap" class="invisible"><div id="activeEnvTop"></div></div>
      <div id="env_active"></div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    const code = fs.readFileSync('internal/webui/static/js/state/env.js','utf8');
    window.eval(code);

    // First render
    const env = window.hydreqEnv.renderActive('env_active');
    const pills = document.querySelectorAll('#env_active .pill');
    assert.strictEqual(Object.keys(env).length, 2);
    assert.strictEqual(pills.length, 2);

    // Ensure top mirror shows and not invisible
    const topWrap = document.getElementById('activeEnvTopWrap');
    assert.ok(!topWrap.classList.contains('invisible'));

    // Now clear rows and ensure invisible toggles on
    const root = document.getElementById('env_kv_list');
    while (root.firstChild) root.removeChild(root.firstChild);
    const env2 = window.hydreqEnv.renderActive('env_active');
    assert.strictEqual(Object.keys(env2).length, 0);
    assert.ok(topWrap.classList.contains('invisible'));
  });
});
