const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor dirty suppression', function(){
  it('does not set dirty on programmatic setText+baseline', async function(){
    const dom = new JSDOM(`<!doctype html><html><body><div id="editorModal"></div></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    // Stubs to keep yaml.js happy
    window.jsyaml = { dump: ()=> 'name: Demo', load: ()=> ({ name:'Demo', tests:[] }) };
    window.CodeMirror = { fromTextArea: function(){ return {
      getValue(){ return 'name: Demo\n'; },
      setValue(){},
      refresh(){},
      getWrapperElement(){ return { style:{} }; },
      on(){},
    }; } };

    // Load modules
    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8'); window.eval(modalCode);
    const yamlCode = fs.readFileSync('internal/webui/static/js/editor/yaml.js','utf8'); window.eval(yamlCode);
    const yamlCtlCode = fs.readFileSync('internal/webui/static/js/editor/yaml-control.js','utf8'); window.eval(yamlCtlCode);
    const editorCode = fs.readFileSync('internal/webui/static/js/editor.js','utf8'); window.eval(editorCode);

    // Open editor with raw (prefilled YAML)
    window.openEditor('/tmp/demo.yaml', { parsed: { name:'Demo', tests:[] }, raw: 'name: Demo\n' });

    // Simulate post-save programmatic update
    const btn = document.getElementById('ed_save');
    // Intercept fetch to always succeed and not actually persist
    window.fetch = async ()=>({ ok:true, json: async()=>({}) });

    // Call save, which uses fallback path in tests and calls afterSaved()
    await btn.onclick();

    // Dirty indicator should be hidden
    const di = document.getElementById('ed_dirty_indicator');
    assert.ok(di, 'dirty indicator exists');
    // Our editor/state.setDirty sets hidden via events; ensure display is not explicitly shown
    assert.notStrictEqual(di.style.display, '', 'dirty indicator not forced visible after save');
  });
});
