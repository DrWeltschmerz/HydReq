// editor/run.js — quick-run integration and status propagation
(function(){
  async function quickRun(opts){
    try{
      const working = (window.hydreqEditorState && window.hydreqEditorState.getWorking && window.hydreqEditorState.getWorking()) || {};
      const env = (typeof window.parseEnv==='function') ? window.parseEnv() : {};
      const payload = {
        parsed: working,
        env,
        runAll: !!(opts && opts.runAll),
        includeDeps: !!(opts && opts.includeDeps),
        includePrevStages: !!(opts && opts.includePrevStages)
      };
      if (opts && typeof opts.testIndex === 'number') payload.testIndex = opts.testIndex;
      if (window.hydreqRun && typeof window.hydreqRun.start==='function'){
        const runId = await window.hydreqRun.start(payload);
        return runId || null;
      }
    }catch(e){ console.error('quickRun failed', e); }
    return null;
  }

  function listen(runId, handlers){
    try{
      if (!runId) return null;
      const es = new EventSource('/api/stream?runId=' + encodeURIComponent(runId));
      es.onmessage = (event)=>{
        try{
          const raw = JSON.parse(event.data);
          const type = raw.type || (raw.Status || raw.status ? 'test' : null);
          const payload = raw.payload || raw;
          if (type === 'test'){
            const name = payload.Name || payload.name || '';
            const status = (payload.Status || payload.status || '').toLowerCase();
            const durationMs = payload.DurationMs || payload.durationMs || 0;
            const messages = Array.isArray(payload.Messages) ? payload.Messages : (Array.isArray(payload.messages) ? payload.messages : []);
            handlers && handlers.onTest && handlers.onTest({ name, status, durationMs, messages });
          } else if (type === 'suiteEnd'){
            const summary = payload.summary || {};
            const tests = Array.isArray(payload.tests) ? payload.tests.map(t=>({
              name: t.name || t.Name || '',
              status: (t.status || t.Status || '').toLowerCase(),
              durationMs: t.durationMs || t.DurationMs || 0,
              messages: Array.isArray(t.messages) ? t.messages : (Array.isArray(t.Messages) ? t.Messages : [])
            })) : [];
            handlers && handlers.onSuiteEnd && handlers.onSuiteEnd({ name: payload.name || payload.path || 'suite', summary, tests });
          } else if (type === 'error'){
            const msg = payload.error || payload.message || 'Unknown error';
            handlers && handlers.onError && handlers.onError(msg);
          } else if (type === 'done'){
            handlers && handlers.onDone && handlers.onDone();
            try{ es.close(); }catch{}
          }
        }catch(e){ console.error('quickRun stream parse', e); }
      };
      es.onerror = ()=>{ try{ es.close(); }catch{} handlers && handlers.onError && handlers.onError('Run failed or connection lost'); };
      return es;
    }catch(e){ console.error('listen failed', e); return null; }
  }

  // Normalize an immediate result into handler events
  function dispatchImmediate(data, handlers, label){
    try{
      if (!data) return;
      // Suite-style response with cases
      if (Array.isArray(data.cases) && data.cases.length){
        data.cases.forEach(c => {
          const name = c.Name || c.name || '';
          const status = (c.Status || c.status || '').toLowerCase();
          const durationMs = c.DurationMs || c.durationMs || 0;
          const messages = Array.isArray(c.Messages) ? c.Messages : (Array.isArray(c.messages) ? c.messages : []);
          handlers && handlers.onTest && handlers.onTest({ name, status, durationMs, messages });
        });
        const summary = data.summary || {};
        const tests = Array.isArray(data.tests) ? data.tests.map(t=>({
          name: t.name || t.Name || '',
          status: (t.status || t.Status || '').toLowerCase(),
          durationMs: t.durationMs || t.DurationMs || 0,
          messages: Array.isArray(t.messages) ? t.messages : (Array.isArray(t.Messages) ? t.Messages : [])
        })) : [];
        handlers && handlers.onSuiteEnd && handlers.onSuiteEnd({ name: label || data.name || 'suite', summary, tests });
        handlers && handlers.onDone && handlers.onDone();
        return;
      }
      // Single test style
      const status = (data.status || '').toLowerCase();
      const name = data.name || label || '';
      const durationMs = data.durationMs || 0;
      const messages = Array.isArray(data.messages) ? data.messages : [];
      handlers && handlers.onTest && handlers.onTest({ name, status, durationMs, messages });
      handlers && handlers.onDone && handlers.onDone();
    }catch(e){ console.error('dispatchImmediate failed', e); }
  }

  async function validate(raw){
    const res = await fetch('/api/editor/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ raw }) });
    if (!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }

  window.hydreqEditorRun = window.hydreqEditorRun || {};
  window.hydreqEditorRun.quickRun = window.hydreqEditorRun.quickRun || quickRun;
  window.hydreqEditorRun.listen = window.hydreqEditorRun.listen || listen;
  window.hydreqEditorRun.dispatchImmediate = window.hydreqEditorRun.dispatchImmediate || dispatchImmediate;
  window.hydreqEditorRun.validate = window.hydreqEditorRun.validate || validate;
})();
