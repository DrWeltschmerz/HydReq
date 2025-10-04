const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

// Integration test: editor.js uses hydreqEditorYAML + hydreqEditorRun

describe('editor integration', function(){
  it('wires YAML via hydreqEditorYAML and delegates quick-run when available', async function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts: 'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Minimal stubs used by editor.js
    window.isDocDark = () => false;
    window.parseEnv = () => ({ FOO: 'bar' });
    window.hydreqStore = { setSummary(){}, setBadge(){}, setTest(){} };

    // Stub CodeMirror and jsyaml used under hydreqEditorYAML
    let cmValue = '';
    window.CodeMirror = { fromTextArea: function(){ return { getValue(){ return cmValue; }, setValue(v){ cmValue = v || ''; }, refresh(){}, getWrapperElement(){ return { style:{} }; } }; } };
    window.jsyaml = { dump: (obj)=> 'name: Demo', load: (txt)=> ({ name: 'Demo', tests: [] }) };

    // Load editor modules
  const yamlCode = fs.readFileSync('internal/webui/static/js/editor/yaml.js','utf8'); window.eval(yamlCode);
  const stateCode = fs.readFileSync('internal/webui/static/js/editor/state.js','utf8'); window.eval(stateCode);
  const runCode = fs.readFileSync('internal/webui/static/js/editor/run.js','utf8'); window.eval(runCode);
  const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8'); window.eval(modalCode);

    // Provide hydreqRun.start to capture payload
    let startedPayload = null; let startedRunId = 'run-123';
    window.hydreqRun = { start: async (payload)=> { startedPayload = payload; return startedRunId; } };

    // Minimal helpers used by editor.js
    window.getSuiteSummary = () => null;
    window.getSuiteLastStatus = () => ({});
    window.getSuiteBadgeStatus = () => 'unknown';

    // Modal HTML is simple; openEditor will not recreate when found
    // Load editor.js
    const code = fs.readFileSync('internal/webui/static/js/editor.js','utf8');
    window.eval(code);

    // Open editor with basic data
    const data = { parsed: { name: 'Demo', tests: [ { name: 'A', request: { method: 'GET', url: '/x' } } ] } };
    window.openEditor('/tmp/demo.yaml', data);

    // YAML editor should be mounted and initial text set via hydreqEditorYAML
    window.hydreqEditorYAML.setText('name: Demo\n');

    // Click run suite; should delegate to hydreqEditorRun.quickRun -> hydreqRun.start
  const btn = document.getElementById('ed_run_suite');
    btn.click();

    // Allow async microtasks
    await Promise.resolve();

    assert.ok(startedPayload, 'quick-run delegated to hydreqRun.start with payload');
    assert.strictEqual(!!startedPayload.runAll, true, 'runAll true for suite');
    assert.strictEqual(typeof startedPayload.env, 'object', 'env passed');
  });
});
