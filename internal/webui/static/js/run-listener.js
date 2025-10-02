// run-listener.js — SSE subscription scaffolding
(function(){
  function subscribe(runId, handlers){
    const es = new EventSource('/api/stream?runId=' + encodeURIComponent(runId));
    es.onmessage = (e)=>{
      try{
        const ev = JSON.parse(e.data);
        const type = ev.type;
        const payload = ev.payload || {};
        if (!handlers) return;
        if (type && typeof handlers[type]==='function') handlers[type](payload);
        if (type==='done' && typeof handlers.done==='function') handlers.done(payload);
      }catch(err){ console.error('SSE parse error', err); }
    };
    es.onerror = ()=>{ try{ es.close(); if (handlers && typeof handlers.error==='function') handlers.error({ error:'connection error' }); }catch{} };
    return ()=>{ try{ es.close(); }catch{} };
  }
  window.hydreqRunListener = window.hydreqRunListener || { subscribe };
})();
