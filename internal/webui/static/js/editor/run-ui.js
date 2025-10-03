(function(){
  function prepare(modal, label){
    try{
      const quickRunBox = modal.querySelector('#ed_quickrun');
      if (quickRunBox) quickRunBox.innerHTML = `<div>Running ${label}...</div>`;
      const quickRunDetails = modal.querySelector('#ed_quickrun_box');
      if (quickRunDetails) quickRunDetails.open = true;
    }catch{}
  }

  function createHandlers(modal, helpers){
    const {
      appendQuickRunLine,
      getTestIndexByName,
      setTestRecord,
      updateTestBadgeByIndex,
      setSuiteRecord,
      fallbackCache,
      getPath
    } = helpers || {};
    function appendMessageLine(name, status, durationMs){
      try{
        const quickRunBox = modal.querySelector('#ed_quickrun'); if (!quickRunBox) return;
        const icon = status==='passed'?'✓':(status==='failed'?'✗':(status==='skipped'?'○':'·'));
        const line = document.createElement('div'); line.textContent = `${icon} ${name}${durationMs?` (${durationMs}ms)`:''}`;
        if (status==='passed') line.className='text-success'; else if (status==='failed') line.className='text-error'; else if (status==='skipped') line.className='text-warning';
        quickRunBox.appendChild(line); quickRunBox.scrollTop = quickRunBox.scrollHeight;
      }catch{}
    }
    function appendDetails(status, messages){
      try{
        if (!Array.isArray(messages) || !messages.length) return;
        const quickRunBox = modal.querySelector('#ed_quickrun'); if (!quickRunBox) return;
        const det=document.createElement('details'); det.className='ed-msg-details';
        const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum);
        const pre=document.createElement('pre');
        pre.className = 'message-block ' + (
          status==='failed' ? 'fail' : (status==='skipped' ? 'skip' : 'ok')
        );
        pre.textContent = messages.join('\n'); det.appendChild(pre);
        quickRunBox.appendChild(det);
      }catch{}
    }
    const onTest = ({name,status,durationMs,messages})=>{
      try{
        appendMessageLine(name, status, durationMs);
        const idx = typeof getTestIndexByName==='function' ? getTestIndexByName(name) : -1;
        if (typeof setTestRecord==='function') setTestRecord(name, status, durationMs||0, messages||[]);
  if (idx>=0 && typeof updateTestBadgeByIndex==='function') updateTestBadgeByIndex(idx, status, messages||[], name);
        else if (typeof fallbackCache==='function') fallbackCache(name, status, messages||[]);
        appendDetails(status, messages||[]);
      }catch{}
    };
    const onSuiteEnd = ({name,summary,tests})=>{
      try{
        const s = summary || {};
        if (typeof appendQuickRunLine==='function') appendQuickRunLine(`=== ${name || 'suite'} — ${(s.passed||0)} passed, ${(s.failed||0)} failed, ${(s.skipped||0)} skipped, total ${(s.total||0)} in ${(s.durationMs||0)} ms`);
        const st = ((s.failed||0)>0)? 'failed' : (((s.passed||0)>0)? 'passed' : (((s.skipped||0)>0)? 'skipped' : 'unknown'));
        if (typeof setSuiteRecord==='function') setSuiteRecord(st, s.durationMs||0, []);
  try{ (tests||[]).forEach(t=>{ const nm = t.name; const idx = typeof getTestIndexByName==='function' ? getTestIndexByName(nm) : -1; if (idx>=0 && typeof updateTestBadgeByIndex==='function') updateTestBadgeByIndex(idx, t.status, t.messages||[], nm); }); }catch{}
      }catch{}
    };
    const onError = (msg)=>{ try{ if (typeof appendQuickRunLine==='function') appendQuickRunLine('Error: '+msg, 'text-error'); if (typeof setSuiteRecord==='function') setSuiteRecord('failed', 0, [msg]); }catch{} };
    const onDone = ()=>{ try{ if (typeof appendQuickRunLine==='function') appendQuickRunLine('Done.'); }catch{} };
    return { onTest, onSuiteEnd, onError, onDone };
  }

  window.hydreqEditorRunUI = window.hydreqEditorRunUI || { prepare, createHandlers };
})();
