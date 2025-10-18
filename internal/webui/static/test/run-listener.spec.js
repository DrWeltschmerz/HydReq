const { JSDOM } = require('jsdom');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

describe('run-listener integration', function(){
  it('invokes handlers in order and awaits async suiteStart handler', async function(){
    // Setup a DOM environment
    const dom = new JSDOM(`<!doctype html><html><body><ul id="suites"></ul></body></html>`, { runScripts: 'outside-only' });
    const window = dom.window;
    global.window = window; global.document = window.document;

    // Fake EventSource constructor that records instances and provides emit()
    window._fakeESinstances = [];
    window.EventSource = function(url){
      this.url = url; this.onmessage = null; this.onerror = null; this.closed = false;
      const self = this; window._fakeESinstances.push(self);
      this.emit = function(data){ if (self.onmessage) self.onmessage({ data: JSON.stringify(data) }); };
      this.close = function(){ self.closed = true; };
    };

    // Load run-listener.js into the window context
    const code = fs.readFileSync('internal/webui/static/js/run-listener.js', 'utf8');
    // execute inside the JSDOM window so global `window` exists
    window.eval(code);

    // Wire handlers that record calls
    const calls = [];
    const unsub = window.hydreqRunListener.subscribe('test-run', {
      batchStart: (p)=>{ calls.push('batchStart'); },
      suiteStart: async (p)=>{ calls.push('suiteStart'); await new Promise(r=>setTimeout(r,20)); },
      testStart: (p)=>{ calls.push('testStart'); },
      test: (p)=>{ calls.push('test'); },
      suiteEnd: (p)=>{ calls.push('suiteEnd'); },
      batchEnd: (p)=>{ calls.push('batchEnd'); },
      error: (p)=>{ calls.push('error'); },
      done: (p)=>{ calls.push('done'); }
    });

    // Emit a sequence of events from the fake EventSource
    const es = window._fakeESinstances[0];
    es.emit({ type: 'batchStart', payload: { total: 1 } });
  es.emit({ type: 'suiteStart', payload: { name: 's1', path: 'testdata/s1.hrq.yaml' } });
    es.emit({ type: 'testStart', payload: { Name: 't1', Stage: 0 } });
    es.emit({ type: 'test', payload: { Name: 't1', Status: 'passed', DurationMs: 5 } });
  es.emit({ type: 'suiteEnd', payload: { name: 's1', path: 'testdata/s1.hrq.yaml' } });
    es.emit({ type: 'batchEnd', payload: {} });
    es.emit({ type: 'done', payload: {} });

    // Wait for handlers to process (suiteStart handler awaits 20ms)
    await new Promise(r=>setTimeout(r,150));

    assert.deepStrictEqual(calls, ['batchStart','suiteStart','testStart','test','suiteEnd','batchEnd','done']);
    if (typeof unsub === 'function') unsub();
  });
});
