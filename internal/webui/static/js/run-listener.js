// run-listener.js — SSE subscription scaffolding
(function(){
  function subscribe(runId, handlers){
    let canceled = false;
    let es = null;
    let retries = 0;
    const backoffInitial = 500; // ms
    const backoffMax = 5000; // ms

    async function handleMessage(e){
      try{
        const ev = JSON.parse(e.data);
        const type = ev.type;
        const payload = ev.payload || {};
        if (!handlers) return;
        if (type && type !== 'done' && typeof handlers[type] === 'function'){
          try { await handlers[type](payload); } catch (herr) { console.error('run-listener handler error', herr); }
        }
        if (type === 'done' && typeof handlers.done === 'function'){
          try { await handlers.done(payload); } catch (herr) { console.error('run-listener done handler error', herr); }
        }
      } catch(err){ console.error('SSE parse/error', err); }
    }

    function connect(){
      if (canceled) return;
      try{ if (es) { try{ es.close(); }catch{} es = null; } }catch{}
      es = new EventSource('/api/stream?runId=' + encodeURIComponent(runId));
      retries = 0; // reset on new connection attempt
      if (es) {
        try{ es.onmessage = handleMessage; }catch{}
        try{ es.onerror = () => { try{ es.close(); }catch{}; if (handlers && typeof handlers.error === 'function') { try{ handlers.error({ error:'connection error' }); }catch{} }
          // schedule reconnect with backoff
          scheduleReconnect();
        }; }catch{}
        try{ es.onopen = () => { retries = 0; }; }catch{}
      }
    }

    function scheduleReconnect(){
      if (canceled) return;
      retries += 1;
      const delay = Math.min(backoffInitial * Math.pow(2, Math.max(0, retries - 1)), backoffMax);
      setTimeout(()=>{ if (!canceled) connect(); }, delay);
    }

    connect();

    return ()=>{ canceled = true; try{ if (es) es.close(); }catch{} };
  }
  window.hydreqRunListener = window.hydreqRunListener || { subscribe };
})();
