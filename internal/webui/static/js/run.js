// run.js — wrappers for run lifecycle
(function(){
  async function start(payload){
    const res = await fetch('/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload||{}) });
    if (!res.ok) throw new Error('run failed: '+res.status);
    const j = await res.json();
    const runId = j.runId;
    try{ window.currentRunId = runId; if (typeof window.listen==='function') window.listen(runId); }catch{}
    return runId;
  }
  async function cancel(runId){
    if (!runId){ try{ runId = window.currentRunId; }catch{} }
    if (!runId) return false;
    try{ await fetch('/api/cancel?runId='+encodeURIComponent(runId), { method:'POST' }); return true; }catch{ return false; }
  }
  window.hydreqRun = window.hydreqRun || { start, cancel };
})();
