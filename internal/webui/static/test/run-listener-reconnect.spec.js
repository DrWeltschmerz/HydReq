const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('run-listener reconnect/backoff', function(){
  it('reconnects after error with backoff and cancels on unsubscribe', async function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only', url:'http://localhost/' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Fake EventSource with error triggering
    const instances = [];
    window.EventSource = function(url){
      this.url = url; this.onmessage = null; this.onerror = null; this.onopen = null; this.closed = false;
      instances.push(this);
      this.close = function(){ this.closed = true; };
    };

    // Load run-listener
    const code = fs.readFileSync('internal/webui/static/js/run-listener.js','utf8');
    window.eval(code);

    const events = [];
    const unsub = window.hydreqRunListener.subscribe('run-1', {
      error: (e)=> events.push('error')
    });

    // Trigger an error on the first instance
    const first = instances[0];
    // simulate open then error
    if (first.onopen) first.onopen();
    if (first.onerror) first.onerror();

    // Wait for backoff reconnect (initial 500ms)
    await new Promise(r=>setTimeout(r, 600));

    // Should have created a second instance
    assert.ok(instances.length >= 2, 'expected a reconnect to create a new EventSource');

    // Unsubscribe should stop further reconnects
    unsub();
    const prevCount = instances.length;
    if (instances[instances.length-1].onerror) instances[instances.length-1].onerror();
    await new Promise(r=>setTimeout(r, 600));
    assert.strictEqual(instances.length, prevCount, 'unsubscribe should prevent new connections');
  });
});
