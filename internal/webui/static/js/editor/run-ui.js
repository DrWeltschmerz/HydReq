(function(){
  function prepare(modal, label, kind){
    try{
      const quickRunBox = modal.querySelector('#ed_quickrun');
  if (quickRunBox){ while (quickRunBox.firstChild) quickRunBox.removeChild(quickRunBox.firstChild); const d=document.createElement('div'); d.textContent = `Running ${label}...`; quickRunBox.appendChild(d); }
      const quickRunDetails = modal.querySelector('#ed_quickrun_box');
      if (quickRunDetails) quickRunDetails.open = true;
      try{
        if (modal && modal.dataset){
          const k = (kind && (kind==='suite' || kind==='test')) ? kind : ((label==='suite' || label==='test') ? label : 'test');
          modal.dataset.quickRunType = k;
          // Track running test name for UI loader state in Suite results
          if (k === 'test') modal.dataset.runningTestName = String(label||''); else delete modal.dataset.runningTestName;
        }
      }catch{}
      // Also prep Suite results: only clear for full suite runs; keep existing output on single-test runs
      try{
        const t = (modal && modal.dataset && modal.dataset.quickRunType) || '';
        const sBox = modal.querySelector('#ed_suiteresults_box');
        const sEl = modal.querySelector('#ed_suiteresults');
        if (sBox) sBox.open = true;
        if (sEl && t === 'suite'){
          while (sEl.firstChild) sEl.removeChild(sEl.firstChild);
          try{
            const p=(modal.querySelector('#ed_path')||{}).textContent||'';
            if (p && window.hydreqStore && typeof window.hydreqStore.resetSuite==='function') window.hydreqStore.resetSuite(p);
          }catch{}
          // Mark suite run in progress
          try{ if (modal && modal.dataset) modal.dataset.suiteInProgress = '1'; }catch{}
          // Add small grey heading like Quick run (ensure as first child and unique)
          let head = sEl.querySelector('#ed_suite_heading');
          if (!head){ head = document.createElement('div'); head.id = 'ed_suite_heading'; }
          head.className = 'dim text-sm'; head.textContent = `Running ${label}...`;
          if (sEl.firstChild){ sEl.insertBefore(head, sEl.firstChild); } else { sEl.appendChild(head); }
          // Pre-seed rows for all tests as running
          try{
            const wk = (window.hydreqEditorState && window.hydreqEditorState.getWorking) ? window.hydreqEditorState.getWorking() : {};
            const arr = Array.isArray(wk && wk.tests) ? wk.tests : [];
            arr.forEach(tst => {
              const name = (tst && tst.name) ? tst.name : '';
              if (!name) return;
              const row = document.createElement('div'); row.setAttribute('data-test-name', name); row.className='ed-test-container';
              const line=document.createElement('div'); line.className='ed-test-line text-warning'; line.textContent = `… ${name} (running)`; row.appendChild(line);
              const detWrap=document.createElement('div'); detWrap.className='ed-test-details'; row.appendChild(detWrap);
              sEl.appendChild(row);
            });
          }catch{}
          // Ensure visible immediately
          try{ if (typeof window.__ed_renderSuiteResults==='function') window.__ed_renderSuiteResults(); }catch{}
        } else if (sEl && t === 'test'){
          // For a single test, set running indicator and force draw to show waiting state
          try{ if (typeof window.__ed_renderSuiteResults==='function') window.__ed_renderSuiteResults(); }catch{}
        }
      }catch{}
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
    const onTest = ({name,status,durationMs,messages,stage})=>{
      try{
        try{
          // When stage info is present during a suite run, render a stage separator in Quick run box
          const t = (modal && modal.dataset && modal.dataset.quickRunType) || '';
          if (t === 'suite' && (stage !== undefined && stage !== null)){
            const quickRunBox = modal.querySelector('#ed_quickrun');
            if (quickRunBox){
              const lastHdr = quickRunBox.querySelector('div[data-stage-hdr="1"]:last-child');
              const lastText = lastHdr && lastHdr.textContent || '';
              const text = `--- stage ${stage} ---`;
              if (lastText !== text){ const d=document.createElement('div'); d.dataset.stageHdr='1'; d.className='dim text-sm'; d.textContent=text; quickRunBox.appendChild(d); }
            }
          }
        }catch{}
        appendMessageLine(name, status, durationMs);
        const idx = typeof getTestIndexByName==='function' ? getTestIndexByName(name) : -1;
        // Clear running indicator BEFORE store update to avoid one-frame stale render
        try{ if (modal && modal.dataset && modal.dataset.runningTestName === name) delete modal.dataset.runningTestName; }catch{}
        if (typeof setTestRecord==='function') setTestRecord(name, status, durationMs||0, messages||[]);
  if (idx>=0 && typeof updateTestBadgeByIndex==='function') updateTestBadgeByIndex(idx, status, messages||[], name);
        else if (typeof fallbackCache==='function') fallbackCache(name, status, messages||[]);
        // Avoid duplicating details: when the editor is active it re-renders
        // the Quick run panel from store/state immediately upon test update
        // (synchronously via a dispatched event). In that case, the re-render
        // will append the details for us. Only append here if no re-render
        // hook is present (e.g., minimal/fallback environments or tests).
        try{
          const hasRerender = (typeof window.__ed_renderQuickRunForSelection === 'function');
          if (!hasRerender) appendDetails(status, messages||[]);
        }catch{ appendDetails(status, messages||[]); }
      }catch{}
    };
    const onSuiteEnd = ({name,summary,tests})=>{
      try{
        // Do not append suite summary to Quick run when running a suite; Suite results panel handles it.
        // Keep behavior minimal even if invoked in other contexts.
        // Do not force suite status directly here; per-test updates drive aggregation
  try{ (tests||[]).forEach(t=>{ const nm = t.name; const idx = typeof getTestIndexByName==='function' ? getTestIndexByName(nm) : -1; if (typeof setTestRecord==='function') setTestRecord(nm, (t.status||'').toLowerCase(), t.durationMs||0, Array.isArray(t.messages)?t.messages:[]); if (idx>=0 && typeof updateTestBadgeByIndex==='function') updateTestBadgeByIndex(idx, t.status, t.messages||[], nm); }); }catch{}
        // Publish summary into store (so Suite results can show bottom summary)
        try{
          const path = typeof getPath==='function' ? getPath() : '';
          if (path && window.hydreqStore && typeof window.hydreqStore.setSummary==='function'){
            window.hydreqStore.setSummary(path, summary || null);
          }
        }catch{}
        // Mark suite complete and force final render (to show summary), then scroll to bottom
        try{ if (modal && modal.dataset) modal.dataset.suiteInProgress = '0'; }catch{}
        try{ if (typeof window.__ed_renderSuiteResults==='function') window.__ed_renderSuiteResults(); }catch{}
        try{ const el = modal.querySelector('#ed_suiteresults'); if (el) el.scrollTop = el.scrollHeight; }catch{}
      }catch{}
    };
    const onError = (msg)=>{ try{ if (typeof appendQuickRunLine==='function') appendQuickRunLine('Error: '+msg, 'text-error'); if (typeof setSuiteRecord==='function') setSuiteRecord('failed', 0, [msg]); }catch{} };
    const onDone = ()=>{ try{ const t = (modal && modal.dataset && modal.dataset.quickRunType) || ''; if (t !== 'suite'){ if (typeof appendQuickRunLine==='function') appendQuickRunLine('Done.'); } }catch{} };
    return { onTest, onSuiteEnd, onError, onDone };
  }

  window.hydreqEditorRunUI = window.hydreqEditorRunUI || { prepare, createHandlers };
})();
