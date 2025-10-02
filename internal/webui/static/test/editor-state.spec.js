const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor-state', function(){
  it('sets working, dirty, and selection', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    const code = fs.readFileSync('internal/webui/static/js/editor/state.js','utf8');
    window.eval(code);

    const st = window.hydreqEditorState;
    const suite = { name:'X', tests:[{name:'A'},{name:'B'}] };
    st.setWorking(suite);
    assert.strictEqual(st.getWorking().name, 'X');

    st.setDirty(true);
    assert.strictEqual(st.isDirty(), true);

    st.setSelIndex(1);
    assert.strictEqual(st.getSelIndex(), 1);
  });
});
