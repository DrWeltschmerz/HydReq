const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor YAML theme mirroring', function(){
  it('mirrors body theme class and sets cm-dark/cm-light', function(){
  const dom = new JSDOM(`<!doctype html><html><body class="nord"></body></html>`, { runScripts: 'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Stubs
    window.isDocDark = () => true; // dark mode
    let cmValue = ''; const wrap = { style:{}, classList: { _s:new Set(), add(c){ this._s.add(c); }, remove(){}, forEach(){} } };
    window.CodeMirror = { fromTextArea: function(){ return { getValue(){ return cmValue; }, setValue(v){ cmValue=v||''; }, refresh(){}, getWrapperElement(){ return wrap; }, on(){} }; } };
    window.jsyaml = { dump: ()=> 'name: Demo', load: ()=> ({ name:'Demo', tests:[] }) };

    // Load modules
  const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8'); window.eval(modalCode);
  const yamlCode = fs.readFileSync('internal/webui/static/js/editor/yaml.js','utf8'); window.eval(yamlCode);
  // Avoid jsdom alert not implemented in other tests if any alert happens
  window.alert = ()=>{};
  const editorCode = fs.readFileSync('internal/webui/static/js/editor.js','utf8'); window.eval(editorCode);

  window.openEditor('/tmp/demo.yaml', { parsed: { name:'Demo', tests:[] }, raw: 'name: Demo\n' });
  // Force a theme sync so wrapper classes are applied immediately
  if (window.hydreqEditorYAML && window.hydreqEditorYAML.syncTheme) window.hydreqEditorYAML.syncTheme();

    // After mount, wrapper should carry cm-dark and theme class
    const hasDark = wrap.classList._s.has('cm-dark');
    const hasNord = wrap.classList._s.has('nord');
    assert.ok(hasDark, 'wrapper has cm-dark');
    assert.ok(hasNord, 'wrapper mirrors body theme class');
  });
});
