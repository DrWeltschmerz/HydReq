const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor assert form wiring', function(){
  it('wires jsonEquals/jsonContains and list tables with flattened values', function(){
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="modal">
        <div id="ed_assert_headerEquals"></div>
        <div id="ed_assert_jsonEquals"></div>
        <div id="ed_assert_jsonContains"></div>
        <div id="ed_assert_bodyContains"></div>
        <input id="ed_assert_status" />
        <input id="ed_assert_maxDuration" />
      </div>
    </body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    // Minimal kvTable/listTable shims used by the form
    window.kvTable = function(container, init, onChange){
      // simple 2-row kv mirroring using data-* for testing
      container.dataset.kv = JSON.stringify(init||{});
      return function(){ return JSON.parse(container.dataset.kv||'{}'); };
    };
    window.listTable = function(container, init, onChange){
      container.dataset.list = JSON.stringify(Array.isArray(init)? init: []);
      return function(){ return JSON.parse(container.dataset.list||'[]'); };
    };

    const code = fs.readFileSync('internal/webui/static/js/editor/forms/assert.js','utf8');
    window.eval(code);

    const test = {
      assert: {
        headerEquals: { 'X-A': '1' },
        jsonEquals: { a: 1, b: { c: 2 } },
        jsonContains: { x: 'y' },
        bodyContains: ['foo','bar'],
        status: 200,
        maxDurationMs: 50
      }
    };

    const modal = document.getElementById('modal');
    const { assertHeaderGet, assertJsonEqGet, assertJsonContainsGet, assertBodyContainsGet } = window.hydreqEditorForms.assert.wire(modal, test, ()=>{});
    // ensure getters exist and reflect flattened state
    assert.ok(assertHeaderGet && assertJsonEqGet && assertJsonContainsGet && assertBodyContainsGet);
    const eq = assertJsonEqGet();
    const ct = assertJsonContainsGet();
    assert.strictEqual(eq.a, '1');
    assert.strictEqual(typeof eq.b, 'string');
    assert.strictEqual(ct.x, 'y');
    const list = assertBodyContainsGet();
    assert.ok(Array.isArray(list));
  });
});
