(function(){
  const LS_VER = 'v1';
  const LS_ENC = (s) => { try { return btoa(unescape(encodeURIComponent(s||''))); } catch { return (s||''); } };
  const LS_KEY = (p) => `hydreq.${LS_VER}.runCache:` + LS_ENC(p||'');
  const RUNREC_KEY = (p) => `hydreq.${LS_VER}.editorRun:` + LS_ENC(p||'');

  function create(modal, getWorking, getSelIndex, updateLocalCache){
    function persistEnabled(){ try{ return localStorage.getItem('hydreq.editor.persistRuns') === '1'; }catch{ return false; } }
    function getPath(){ try{ return (modal.querySelector('#ed_path')||{}).textContent||''; }catch{ return ''; } }

    function clearQuickRun(){ const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.innerHTML = ''; }
    function appendQuickRunLine(text, cls){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; const d=document.createElement('div'); if (cls) d.className=cls; d.textContent=text; qr.appendChild(d); qr.scrollTop = qr.scrollHeight; }

  function getRunRecord(){ try{ if (!persistEnabled()) return {}; const k = RUNREC_KEY(getPath()); return JSON.parse(localStorage.getItem(k)||'{}'); }catch{return {}} }
  function saveRunRecord(rec){ try{ if (!persistEnabled()) return; const k = RUNREC_KEY(getPath()); localStorage.setItem(k, JSON.stringify(rec)); }catch{} }

    function updateSuiteBadgeUI(path, status){ try{ if (!path) return; const li = document.querySelector('#suites li[data-path="'+path+'"]'); if (!li) return; const sb = li.querySelector('.suite-badge'); if (!sb) return; const st=(status||'').toLowerCase(); if (st==='failed'){ sb.textContent='✗'; sb.classList.remove('status-unknown','status-ok','status-skip'); sb.classList.add('status-fail'); sb.dataset.status='failed'; } else if (st==='passed'){ if (sb.dataset.status!=='failed'){ sb.textContent='✓'; sb.classList.remove('status-unknown','status-fail','status-skip'); sb.classList.add('status-ok'); sb.dataset.status='passed'; } } else if (st==='skipped'){ if (sb.dataset.status!=='failed' && sb.dataset.status!=='passed'){ sb.textContent='○'; sb.classList.remove('status-unknown','status-fail','status-ok'); sb.classList.add('status-skip'); sb.dataset.status='skipped'; } } else { sb.textContent='·'; sb.classList.remove('status-ok','status-fail','status-skip'); sb.classList.add('status-unknown'); sb.dataset.status='unknown'; } }catch(e){} }

    function setSuiteRecord(status, durationMs, messages){ const rec = getRunRecord(); rec.suite = { status, durationMs: durationMs||0, messages: messages||[], ts: Date.now() }; saveRunRecord(rec); try{ updateSuiteBadgeUI(getPath(), status); }catch{} try{ const pth=getPath(); if (window.hydreqStore){ window.hydreqStore.setSummary(pth, { passed: status==='passed'?1:0, failed: status==='failed'?1:0, skipped: status==='skipped'?1:0, total: 1, durationMs: durationMs||0 }); window.hydreqStore.setBadge(pth, status||'unknown'); } }catch{} }

    function normalizeStatus(status, messages){
      try{
        const st = (status||'').toLowerCase();
        if (st === 'failed'){
          const msgs = Array.isArray(messages) ? messages : [];
          const hasDep = msgs.some(m => typeof m === 'string' && m.toLowerCase().startsWith('dependency '));
          if (hasDep) return 'skipped';
        }
        return st || 'unknown';
      }catch{ return (status||'').toLowerCase(); }
    }

  function setTestRecord(name, status, durationMs, messages){ const st = normalizeStatus(status, messages); const rec = getRunRecord(); rec.tests = rec.tests||{}; rec.tests[name||''] = { name, status: st, durationMs: durationMs||0, messages: messages||[], ts: Date.now() }; saveRunRecord(rec); try{ if (st==='failed' || st==='passed' || st==='skipped'){ updateSuiteBadgeUI(getPath(), st); } }catch{} try{ const pth=getPath(); if (window.hydreqStore){ window.hydreqStore.setTest(pth, name||'', { status: st, durationMs: durationMs||0, messages: Array.isArray(messages)?messages:[] }); } }catch{} }

    function getTestIndexByName(name){ try{ const wk = (typeof getWorking==='function') ? (getWorking()||{}) : {}; const arr = Array.isArray(wk.tests) ? wk.tests : []; for (let i=0;i<arr.length;i++){ if ((arr[i].name||'') === name) return i; } return -1; }catch{ return -1; } }

    function updateTestBadgeByIndex(idx, status, messages, nameArg){
      try{
        const wk = (typeof getWorking==='function') ? (getWorking()||{}) : {};
        const t = (wk.tests && wk.tests[idx]) || {};
        const name = nameArg || t.name || ('test ' + (idx+1));
        const st = normalizeStatus(status, messages);
        const key = idx + ':' + name;
        const path = getPath();
        if (typeof updateLocalCache==='function'){
          updateLocalCache(key, { status: st, name, messages: messages||[] });
          try{ if (persistEnabled()) localStorage.setItem(LS_KEY(path), JSON.stringify(updateLocalCache.__dump && updateLocalCache.__dump() || {})); }catch{}
        }
        // Emit update event so editor can re-render tests list for this modal
        try{ document.dispatchEvent(new CustomEvent('hydreq:editor:test:update', { detail:{ path, name, idx, status: st, messages: Array.isArray(messages)?messages:[] } })); }catch{}
        // Update suites view: badge first, then details for failed or skipped-with-messages
        try{ if (window.setSuiteTestStatus) window.setSuiteTestStatus(path, name, st); }catch{}
        try{ const msgs = Array.isArray(messages) ? messages : []; if (typeof window.setSuiteTestDetails==='function'){ if (st==='failed' || (st==='skipped' && msgs.length)) window.setSuiteTestDetails(path, name, msgs); } }catch{}
      }catch(e){}
    }

    function renderLatestForSelection(){ try{ const rec = getRunRecord(); const wk = (typeof getWorking==='function') ? (getWorking()||{}) : {}; const idx = (typeof getSelIndex==='function') ? parseInt(getSelIndex()||0,10) : 0; const t = (wk.tests && wk.tests[idx]) || {}; const nm = t.name || ''; clearQuickRun(); const tr = (rec.tests||{})[nm]; if (tr){ const s=(tr.status||'').toLowerCase(); const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${nm}${tr.durationMs?` (${tr.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning')); if (Array.isArray(tr.messages) && tr.messages.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = tr.messages.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det); } return; }
      try{ if (typeof window.getSuiteSummary==='function'){ const path = getPath(); const sm = window.getSuiteSummary(path); const tc = sm && Array.isArray(sm.tests) ? sm.tests.find(c=> (c.name||c.Name) === nm) : null; if (tc){ const s = (tc.status||tc.Status||'').toLowerCase(); const d = tc.durationMs||tc.DurationMs||0; const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${nm}${d?` (${d}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning')); const msgs = tc.messages || tc.Messages || []; if (Array.isArray(msgs) && msgs.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = msgs.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det); } return; } } }catch(e){}
      const sr = rec.suite; if (sr){ const s=(sr.status||'').toLowerCase(); const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${nm}${sr.durationMs?` (${sr.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning')); if (Array.isArray(sr.messages) && sr.messages.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className='message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent=sr.messages.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det); } return; }
      appendQuickRunLine('No previous run');
    }catch(e){}
    }
    function renderQuickRunForSelection(){ renderLatestForSelection(); const qrBox = modal.querySelector('#ed_quickrun_box'); if (qrBox) qrBox.open = true; }

    return {
      LS_KEY, RUNREC_KEY,
      getPath,
      clearQuickRun,
      appendQuickRunLine,
      getRunRecord,
      saveRunRecord,
      setSuiteRecord,
      setTestRecord,
      getTestIndexByName,
      updateTestBadgeByIndex,
      renderLatestForSelection,
      renderQuickRunForSelection,
      updateSuiteBadgeUI
    };
  }

  window.hydreqEditorRunRecords = window.hydreqEditorRunRecords || { create };
})();
