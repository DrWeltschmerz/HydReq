// suites-sse.js — Thin wrapper around hydreqRunListener for suites module
(function(){
  /**
   * subscribeToRun wires up SSE events for a run and forwards to provided handlers.
   * It prefers window.hydreqRunListener but falls back to native EventSource.
   * Returns an unsubscribe function.
   */
  function subscribeToRun(runId, handlers){
    handlers = handlers || {};
    // Prefer centralized listener if available
    if (window.hydreqRunListener && typeof window.hydreqRunListener.subscribe === 'function'){
      return window.hydreqRunListener.subscribe(runId, handlers);
    }
    // Fallback: direct EventSource
    const es = new EventSource('/api/stream?runId=' + encodeURIComponent(runId));
    es.onmessage = async (e)=>{
      try{
        const ev = JSON.parse(e.data);
        const type = ev.type;
        const payload = ev.payload || {};
        if (!type) return;
        if (type !== 'done' && typeof handlers[type] === 'function'){
          try{ await handlers[type](payload); }catch(err){ console.error('suites-sse handler error', err); }
        }
        if (type === 'done' && typeof handlers.done === 'function'){
          try{ await handlers.done(payload); }catch(err){ console.error('suites-sse done error', err); }
          try{ es.close(); }catch{}
        }
      }catch(err){ console.error('suites-sse parse error', err); }
    };
    es.onerror = ()=>{ try{ if (typeof handlers.error==='function') handlers.error({ error:'connection error' }); }catch{} };
    return ()=>{ try{ es.close(); }catch{} };
  }

  window.hydreqSuitesSSE = window.hydreqSuitesSSE || { subscribeToRun };
})();
