(function(){
  const LS_VER = 'v1';
  const LS_ENC = (s) => { try { return btoa(unescape(encodeURIComponent(s||''))); } catch { return (s||''); } };
  const LS_KEY = (p) => `hydreq.${LS_VER}.runCache:` + LS_ENC(p||'');
  const RUNREC_KEY = (p) => `hydreq.${LS_VER}.editorRun:` + LS_ENC(p||'');

  function create(modal, getWorking, getSelIndex, updateLocalCache){
    function persistEnabled(){ try{ return localStorage.getItem('hydreq.editor.persistRuns') === '1'; }catch{ return false; } }
    function getPath(){ try{ return (modal.querySelector('#ed_path')||{}).textContent||''; }catch{ return ''; } }

  function clearQuickRun(){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; while (qr.firstChild) qr.removeChild(qr.firstChild); }
    function clearSuiteResults(){ const el = modal.querySelector('#ed_suiteresults'); if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }
    function appendQuickRunLine(text, cls){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; const d=document.createElement('div'); if (cls) d.className=cls; d.textContent=text; qr.appendChild(d); qr.scrollTop = qr.scrollHeight; }
    function appendSuiteResultsLine(text, cls){ const el = modal.querySelector('#ed_suiteresults'); if (!el) return; const d=document.createElement('div'); if (cls) d.className=cls; d.textContent=text; el.appendChild(d); el.scrollTop = el.scrollHeight; }

  function getRunRecord(){ try{ if (!persistEnabled()) return {}; const k = RUNREC_KEY(getPath()); return JSON.parse(localStorage.getItem(k)||'{}'); }catch{return {}} }
  function saveRunRecord(rec){ try{ if (!persistEnabled()) return; const k = RUNREC_KEY(getPath()); localStorage.setItem(k, JSON.stringify(rec)); }catch{} }

    function updateSuiteBadgeUI(path, status){
      try{
        if (!path) return;
        const li = document.querySelector('#suites li[data-path="'+path+'"]');
        if (!li) return;
        const sb = li.querySelector('.suite-badge');
        if (!sb) return;
        const st = (status||'').toLowerCase();
        // reset-then-apply within constraints (do not downgrade failed)
        if (st === 'failed'){
          sb.textContent = '✗';
          sb.classList.remove('status-unknown','status-ok','status-skip');
          sb.classList.add('status-fail');
          sb.dataset.status = 'failed';
          return;
        }
        if (st === 'passed'){
          if (sb.dataset.status !== 'failed'){
            sb.textContent = '✓';
            sb.classList.remove('status-unknown','status-fail','status-skip');
            sb.classList.add('status-ok');
            sb.dataset.status = 'passed';
          }
          return;
        }
        if (st === 'skipped'){
          if (sb.dataset.status !== 'failed' && sb.dataset.status !== 'passed'){
            sb.textContent = '○';
            sb.classList.remove('status-unknown','status-fail','status-ok');
            sb.classList.add('status-skip');
            sb.dataset.status = 'skipped';
          }
          return;
        }
        sb.textContent = '·';
        sb.classList.remove('status-ok','status-fail','status-skip');
        sb.classList.add('status-unknown');
        sb.dataset.status = 'unknown';
      }catch(e){}
    }

    function aggregateSuiteFromStore(path){
      try{
        if (!window.hydreqStore || !path) return null;
        const suiteObj = window.hydreqStore.getSuite(path) || {};
        const tests = suiteObj.tests || {};
        const counts = { passed:0, failed:0, skipped:0, unknown:0, total:0 };
        Object.keys(tests).forEach(k => {
          const rec = tests[k] || {};
          const st = String(rec.status||'').toLowerCase();
          if (st === 'passed') counts.passed += 1;
          else if (st === 'failed') counts.failed += 1;
          else if (st === 'skipped') counts.skipped += 1;
          else counts.unknown += 1;
          counts.total += 1;
        });
        if (counts.total === 0) return null; // avoid resetting badge/summary for other suites
        let badge = 'unknown';
        if (counts.failed > 0) badge = 'failed';
        else if (counts.passed > 0) badge = 'passed';
        else if (counts.skipped > 0) badge = 'skipped';
        return {
          summary: {
            passed: counts.passed,
            failed: counts.failed,
            skipped: counts.skipped,
            total: counts.total,
            durationMs: 0
          },
          badge
        };
      }catch(e){ return null; }
    }

    function publishAggregatedSuite(path){
      try{
        const agg = aggregateSuiteFromStore(path);
        if (!agg) return;
        if (window.hydreqStore){
          const cur = window.hydreqStore.getSuite(path) || {};
          const curBadge = (cur.badge || 'unknown').toLowerCase();
          if (typeof window.hydreqStore.setSummary==='function'){
            window.hydreqStore.setSummary(path, agg.summary);
          }
          if (typeof window.hydreqStore.setBadge==='function'){
            const nextBadge = agg.badge;
            // Do not downgrade failed to passed/skipped here
            const effective = (curBadge === 'failed') ? 'failed' : nextBadge;
            window.hydreqStore.setBadge(path, effective);
          }
        }
        updateSuiteBadgeUI(path, agg.badge);
      }catch(e){}
    }

    function setSuiteRecord(status, durationMs, messages){
      const rec = getRunRecord();
      rec.suite = {
        status,
        durationMs: durationMs||0,
        messages: messages||[],
        ts: Date.now()
      };
      saveRunRecord(rec);
      try{
        const path = getPath();
        // Prefer aggregated badge/summary from current tests in store
        publishAggregatedSuite(path);
        // Re-render suite results section for current modal
        try{ renderSuiteResultsFromStore(); }catch{}
      }catch{}
    }

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

  function setTestRecord(name, status, durationMs, messages){
      const st = normalizeStatus(status, messages);
      const rec = getRunRecord();
      rec.tests = rec.tests || {};
      rec.tests[name||''] = {
        name,
        status: st,
        durationMs: durationMs||0,
        messages: Array.isArray(messages)?messages:[],
        ts: Date.now()
      };
      saveRunRecord(rec);
      try{
        const path = getPath();
        if (window.hydreqStore && typeof window.hydreqStore.setTest==='function'){
          window.hydreqStore.setTest(path, name||'', {
            status: st,
            durationMs: durationMs||0,
            messages: Array.isArray(messages)?messages:[]
          });
        }
        // After updating test record, recompute and publish suite badge/summary
        publishAggregatedSuite(path);
        // Update suite results view as tests are updated
        try{ renderSuiteResultsFromStore(); }catch{}
      }catch{}
    }

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

    function renderSuiteResultsFromStore(){
      try{
        const path = getPath(); if (!path) return;
        const box = modal.querySelector('#ed_suiteresults_box'); if (box) box.open = true;
        const el = modal.querySelector('#ed_suiteresults'); if (!el) return;
        const agg = aggregateSuiteFromStore(path);
        const suiteObj = (window.hydreqStore && window.hydreqStore.getSuite) ? (window.hydreqStore.getSuite(path) || {}) : {};
        const tests = suiteObj.tests || {};
        if (!agg && (!tests || Object.keys(tests).length===0)){
          // If container is empty, show hint unless a suite run is in progress
          const inProg = (modal && modal.dataset && modal.dataset.suiteInProgress==='1');
          if (!el.firstChild && !inProg) appendSuiteResultsLine('No suite results yet');
          return;
        }
        // Per test lines grouped by stage (if available): ensure stage blocks with headers, then move/append rows into the correct block
        // Build an array of {name, stage, rec}
        const items = Object.keys(tests).map(name=>({
          name,
          rec: tests[name] || {},
          stage: (function(){
            try{
              // Prefer SSE-populated stage map keyed by path/name
              const p = getPath();
              if (p && window.__ed_stageMap && window.__ed_stageMap[p] && (name in window.__ed_stageMap[p])){
                const stg = window.__ed_stageMap[p][name];
                if (typeof stg === 'number') return stg;
              }
              // Fallback: attempt to derive stage from details messages when present: look for 'stage: N'
              const msgs = (tests[name] && Array.isArray(tests[name].messages)) ? tests[name].messages : [];
              const m = msgs.find(x=> typeof x === 'string' && /^stage\s*:\s*\d+/i.test(x));
              if (m){ const n = m.match(/\d+/); if (n && n[0]) return parseInt(n[0],10); }
            }catch{}
            // Fallback: try to read from DOM if available
            try{ const row = el.querySelector('div[data-test-name="'+name+'"]'); const ds = row && row.getAttribute('data-stage'); if (ds) return parseInt(ds,10); }catch{}
            return null;
          })()
        }));
        items.sort((a,b)=>{
          // sort by stage (null last), then by name
          const sa = (a.stage==null)? Number.MAX_SAFE_INTEGER : a.stage;
          const sb = (b.stage==null)? Number.MAX_SAFE_INTEGER : b.stage;
          if (sa !== sb) return sa - sb; return a.name.localeCompare(b.name);
        });
        // Ensure blocks per stage appear in ascending order
        const seenStages = [];
        items.forEach(it => { if (!seenStages.includes(it.stage)) seenStages.push(it.stage); });
        seenStages
          .filter(s => s != null)
          .sort((a,b)=> a-b)
          .forEach(s => {
            const blkId = 'ed_stage_block_'+s;
            let blk = el.querySelector('#'+blkId);
            if (!blk){
              blk = document.createElement('div');
              blk.id = blkId;
              // simple header inside block
              const hdr = document.createElement('div'); hdr.id = 'ed_stage_hdr_'+s; hdr.className='dim text-sm mt-2'; hdr.textContent = `--- stage ${s} ---`;
              blk.appendChild(hdr);
              el.appendChild(blk);
            }
          });
        // Unknown stage items go at the end (no header)
        items.forEach(({name, rec, stage})=>{
          const r = rec || tests[name] || {};
          const st = String(r.status||'').toLowerCase();
          const icon = st==='passed'?'✓':(st==='failed'?'✗':(st==='skipped'?'○':'·'));
          const cls = st==='passed'?'text-success':(st==='failed'?'text-error':'text-warning');
          const rowSel = `div[data-test-name="${name}"]`;
          let row = el.querySelector(rowSel);
          if (!row){
            row = document.createElement('div');
            row.setAttribute('data-test-name', name);
            row.className = 'ed-test-container';
            if (stage != null) row.setAttribute('data-stage', String(stage)); else row.removeAttribute('data-stage');
            // line
            const line = document.createElement('div');
            line.className = 'ed-test-line';
            row.appendChild(line);
            // details placeholder
            const detWrap = document.createElement('div');
            detWrap.className = 'ed-test-details';
            row.appendChild(detWrap);
            // append to stage block if known, else to root (will appear above summary)
            if (stage != null){
              const blk = el.querySelector('#ed_stage_block_'+stage);
              if (blk) blk.appendChild(row); else el.appendChild(row);
            } else {
              el.appendChild(row);
            }
          } else {
            // Move row under the correct stage block if needed and update data-stage
            if (stage != null){
              row.setAttribute('data-stage', String(stage));
              const blk = el.querySelector('#ed_stage_block_'+stage);
              if (blk && row.parentElement !== blk){
                blk.appendChild(row);
              }
            }
          }
          const line = row.querySelector('.ed-test-line');
          if (line){ line.className = 'ed-test-line ' + cls; line.textContent = `${icon} ${name}${r.durationMs?` (${r.durationMs}ms)`:''}`; }
          const detWrap = row.querySelector('.ed-test-details');
          if (detWrap){
            // rebuild details content for this test only
            while (detWrap.firstChild) detWrap.removeChild(detWrap.firstChild);
            const msgs = Array.isArray(r.messages) ? r.messages : [];
            if (msgs.length){
              const det=document.createElement('details'); det.className='ed-msg-details';
              const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum);
              const pre=document.createElement('pre'); pre.className='message-block ' + (st==='failed'?'fail':(st==='skipped'?'skip':'ok'));
              pre.textContent = msgs.join('\n'); det.appendChild(pre);
              detWrap.appendChild(det);
            }
          }
        });
        // If running a single test, show transient running state until it resolves
        try{
          const kind = (modal && modal.dataset && modal.dataset.quickRunType) || '';
          const runningName = (modal && modal.dataset && modal.dataset.runningTestName) || '';
          if (kind === 'test' && runningName){
            const name = runningName;
            let row = el.querySelector(`div[data-test-name="${name}"]`);
            if (!row){
              row = document.createElement('div'); row.setAttribute('data-test-name', name); row.className='ed-test-container';
              const line=document.createElement('div'); line.className='ed-test-line'; row.appendChild(line);
              const detWrap=document.createElement('div'); detWrap.className='ed-test-details'; row.appendChild(detWrap);
              el.appendChild(row);
            }
            const line = row.querySelector('.ed-test-line'); if (line){ line.className = 'ed-test-line text-warning'; line.textContent = `… ${name} (running)`; }
          }
        }catch{}
        // Summary at bottom (update or create dedicated node)
        const summaryNodeId = 'ed_suite_summary';
        let summaryNode = el.querySelector('#'+summaryNodeId);
        const summary = (suiteObj && suiteObj.summary) ? suiteObj.summary : (agg && agg.summary ? agg.summary : null);
        const inProg = (modal && modal.dataset && modal.dataset.suiteInProgress==='1');
        if (summary && !inProg){
          const s = summary;
          if (!summaryNode){ summaryNode = document.createElement('div'); summaryNode.id = summaryNodeId; el.appendChild(summaryNode); }
          summaryNode.textContent = `Summary — ${s.passed||0} passed, ${s.failed||0} failed, ${s.skipped||0} skipped, total ${s.total||0}${(s.durationMs?` in ${s.durationMs} ms`:``)}`;
        }
        // Auto-scroll to bottom on update
        try{ el.scrollTop = el.scrollHeight; }catch{}
      }catch{}
    }

    // Subscribe to store to render in real-time on test/summary updates
    let __storeSubId = null;
    try{
      if (window.hydreqStore && typeof window.hydreqStore.subscribe==='function'){
        __storeSubId = window.hydreqStore.subscribe((evt)=>{
          try{
            const p = getPath();
            if (!evt || evt.path !== p) return;
            if (evt.type === 'test' || evt.type === 'summary') renderSuiteResultsFromStore();
          }catch{}
        });
      }
      // Unsubscribe on modal close to avoid leaks
      modal.addEventListener('close', ()=>{ try{ if (__storeSubId && window.hydreqStore && typeof window.hydreqStore.unsubscribe==='function') window.hydreqStore.unsubscribe(__storeSubId); }catch{} });
    }catch{}

    return {
      LS_KEY, RUNREC_KEY,
      getPath,
      clearQuickRun,
      clearSuiteResults,
      appendQuickRunLine,
      appendSuiteResultsLine,
      getRunRecord,
      saveRunRecord,
      setSuiteRecord,
      setTestRecord,
      getTestIndexByName,
      updateTestBadgeByIndex,
      renderLatestForSelection,
      renderQuickRunForSelection,
      updateSuiteBadgeUI,
      renderSuiteResultsFromStore
    };
  }

  window.hydreqEditorRunRecords = window.hydreqEditorRunRecords || { create };
})();
