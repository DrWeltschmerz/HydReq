const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-sse wrapper', function(){
  it('falls back to EventSource when hydreqRunListener is absent', async function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Fake EventSource with instance store
    const instances = [];
    window.EventSource = function(url){ this.url = url; this.onmessage = null; this.onerror = null; instances.push(this); this.close = function(){ this._closed = true; }; };

    // Load wrapper
    const code = fs.readFileSync('internal/webui/static/js/suites-sse.js','utf8');
    window.eval(code);

    const calls = [];
    const unsub = window.hydreqSuitesSSE.subscribeToRun('id1', {
      batchStart: (p)=> calls.push('batchStart'),
      done: (p)=> calls.push('done')
    });
    assert.strictEqual(instances.length, 1, 'should create EventSource');
    // Emit messages
    const es = instances[0];
    es.onmessage({ data: JSON.stringify({ type:'batchStart', payload:{ total: 1 } }) });
    es.onmessage({ data: JSON.stringify({ type:'done', payload:{} }) });
    await new Promise(r=>setTimeout(r, 10));
    assert.deepStrictEqual(calls, ['batchStart','done']);
    if (typeof unsub === 'function') unsub();
  });
});
