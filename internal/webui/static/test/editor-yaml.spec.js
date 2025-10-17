const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor-yaml', function(){
  it('mounts, updates state on change, and syncs theme', function(){
    const dom = new JSDOM(`<!doctype html><html><body><textarea id="ta"></textarea></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Stub setTimeout to run immediately to bypass debounce delays
    const origSetTimeout = window.setTimeout; const origSetTimeoutG = global.setTimeout;
    window.setTimeout = (fn)=> { try{ fn && fn(); }catch(e){} return 0; };
    global.setTimeout = window.setTimeout;

    // Minimal CodeMirror stub
    let handlers = {};
    let value = '';
    let lastTheme = null;
    window.CodeMirror = {
      fromTextArea: function(){
        return {
          on: function(evt, fn){ handlers[evt] = fn; },
          getValue: function(){ return value; },
          setValue: function(v){ value = v || ''; },
          setOption: function(k, v){ if (k === 'theme') lastTheme = v; },
        };
      }
    };

    // jsyaml stub
    window.jsyaml = {
      load: function(text){ if (!text) return {}; return { ok: true, _text: String(text) }; }
    };

    // Load editor state then yaml module
    const stateCode = fs.readFileSync('internal/webui/static/js/editor/state.js','utf8');
    window.eval(stateCode);
    const yamlCode = fs.readFileSync('internal/webui/static/js/editor/yaml.js','utf8');
    window.eval(yamlCode);

    // Mount
    const ta = document.getElementById('ta');
    const cm = window.hydreqEditorYAML.mount(ta);
    assert.ok(cm, 'CodeMirror instance returned');

    // Set text and trigger change
    window.hydreqEditorYAML.setText('name: Demo');
    assert.strictEqual(window.hydreqEditorYAML.getText(), 'name: Demo');

    // Simulate change event
    if (typeof handlers.change === 'function') handlers.change();

    // Verify state updated
    const st = window.hydreqEditorState;
    assert.strictEqual(st.isDirty(), true, 'state dirty after change');
    const working = st.getWorking();
    assert.ok(working && working.ok === true, 'working set from parsed YAML');

    // Theme sync
    window.getCurrentTheme = () => 'dark';
    window.hydreqEditorYAML.syncTheme();
    assert.strictEqual(lastTheme, 'material-darker', 'dark theme applied');
    window.getCurrentTheme = () => 'light';
    window.hydreqEditorYAML.syncTheme();
    assert.strictEqual(lastTheme, 'default', 'light theme applied');

    // Restore timers
    window.setTimeout = origSetTimeout; global.setTimeout = origSetTimeoutG;
  });
});
