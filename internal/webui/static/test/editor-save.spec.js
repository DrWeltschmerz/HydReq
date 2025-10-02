const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('editor save payload', function(){
  it('sends raw to /api/editor/save', async function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts: 'outside-only', url: 'http://localhost' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Stubs
    window.isDocDark = () => false;
    window.hydreqStore = { setSummary(){}, setBadge(){}, setTest(){} };
    window.CodeMirror = { fromTextArea: function(){ return { getValue(){ return 'name: Demo\n'; }, setValue(){}, refresh(){}, getWrapperElement(){ return { style:{} }; } }; } };
    window.jsyaml = { dump: (obj)=> 'name: Demo', load: (txt)=> ({ name: 'Demo', tests: [] }) };

    // Capture fetch calls
    const calls = [];
    window.fetch = async (url, opts)=>{ calls.push({ url, opts }); return { ok: true, json: async()=>({ saved: true }) }; };

    // Load editor modules required for structure
    const modalCode = fs.readFileSync('internal/webui/static/js/editor/modal.js','utf8'); window.eval(modalCode);
    const yamlCode = fs.readFileSync('internal/webui/static/js/editor/yaml.js','utf8'); window.eval(yamlCode);

    const code = fs.readFileSync('internal/webui/static/js/editor.js','utf8'); window.eval(code);

    window.openEditor('/tmp/demo.yaml', { parsed: { name: 'Demo', tests: [] }, raw: 'name: Demo\n' });

    // Trigger save
    const btn = document.getElementById('ed_save');
    await btn.onclick();

    const save = calls.find(c=> c.url.includes('/api/editor/save'));
    assert.ok(save, 'save call was made');
    const body = JSON.parse(save.opts.body);
    assert.strictEqual(typeof body.raw, 'string', 'payload contains raw');
    assert.strictEqual(body.content, undefined, 'payload must not contain content');
  });
});
