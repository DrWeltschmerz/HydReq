// suites-api.js — public helpers for suites UI sync and lookups
(function(){
  function getSuiteLastStatus(path){
    try{
      if (window.hydreqStore && typeof window.hydreqStore.getSuite==='function'){
        const s = window.hydreqStore.getSuite(path);
        if (s && s.tests){ const out = {}; Object.keys(s.tests).forEach(nm=>{ out[nm] = (s.tests[nm].status||'').toLowerCase(); }); return out; }
      }
    }catch(e){}
    try{
      if (window.hydreqSuitesState){ const m = window.hydreqSuitesState.getLastStatus(path) || new Map(); return Object.fromEntries(m.entries()); }
    }catch(e){}
    return {};
  }

  function getSuiteSummary(path){
    try{
      if (window.hydreqStore){
        const s = window.hydreqStore.getSuite(path);
        if (s) return {
          summary: s.summary || null,
          tests: Object.keys(s.tests||{}).map(nm=> ({
            name: nm,
            status: s.tests[nm].status,
            durationMs: s.tests[nm].durationMs,
            messages: s.tests[nm].messages
          }))
        };
      }
    }catch(e){}
    try{ if (window.hydreqSuitesState){ return window.hydreqSuitesState.getSuiteSummary(path); } }catch(e){}
    return null;
  }

  function getSuiteBadgeStatus(path){
    try{ if (window.hydreqStore){ const s = window.hydreqStore.getSuite(path); if (s && s.badge) return s.badge; } }catch(e){}
    try{
      const li = document.querySelector('#suites li[data-path="'+path+'"]');
      const sb = li && li.querySelector && li.querySelector('.suite-badge');
      return (sb && sb.dataset && sb.dataset.status) ? sb.dataset.status : 'unknown';
    }catch(e){ return 'unknown'; }
  }

  function setSuiteTestDetails(path, name, messages){
    try{
      if (!path || !name) return;
      let st = 'failed';
      try{
        if (window.hydreqStore){ const s = window.hydreqStore.getSuite(path); if (s && s.tests && s.tests[name]) st = (s.tests[name].status||'failed').toLowerCase(); }
        else if (window.hydreqSuitesState){ const m = window.hydreqSuitesState.getLastStatus(path); st = (m.get(name)||'failed').toLowerCase(); }
      }catch(e){}
      if (window.hydreqSuitesState && window.hydreqSuitesState.upsertTest)
        window.hydreqSuitesState.upsertTest(path, name, st, 0, messages||[]);
      const li = document.querySelector('#suites li[data-path="'+path+'"]'); if (!li) return;
      const testsDiv = li.querySelector('.suite-tests'); if (!testsDiv) return;
      const cont = (window.hydreqSuitesDOM && window.hydreqSuitesDOM.findTestContainer)
        ? window.hydreqSuitesDOM.findTestContainer(testsDiv, name)
        : null;
      if (!cont) return;
      // Render details for failed or skipped (even with no messages)
      if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateTestDetails)
        window.hydreqSuitesDOM.updateTestDetails(cont, st, messages||[]);
    }catch(e){}
  }

  function setSuiteTestStatus(path, name, status){
    try{
      if (!path || !name) return;
      const st = (status||'').toLowerCase();
      if (window.hydreqSuitesState && window.hydreqSuitesState.setTestStatus) window.hydreqSuitesState.setTestStatus(path, name, st);
      const li = document.querySelector('#suites li[data-path="'+path+'"]'); if (!li) return;
  const testsDiv = li.querySelector('.suite-tests'); if (!testsDiv || testsDiv.classList.contains('hidden')) return;
      const cont = (window.hydreqSuitesDOM && window.hydreqSuitesDOM.findTestContainer)
        ? window.hydreqSuitesDOM.findTestContainer(testsDiv, name)
        : null;
      if (!cont) return;
      const badgeEl = cont.querySelector('.suite-test-status');
      if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateTestBadge) window.hydreqSuitesDOM.updateTestBadge(badgeEl, st);
    }catch(e){}
  }

  function hydrateFromSummary(pathKey){
    try{
      if (!pathKey) return;
      let testsArr = [];
      try{
        if (window.hydreqStore){
          const s = window.hydreqStore.getSuite(pathKey);
          if (s && s.tests){
            testsArr = Object.keys(s.tests).map(nm=> ({
              name: nm,
              status: s.tests[nm].status,
              durationMs: s.tests[nm].durationMs,
              messages: s.tests[nm].messages
            }));
          }
        }
      }catch(e){}
      if (!testsArr.length){
        const rec = (window.hydreqSuitesState && window.hydreqSuitesState.getSuiteSummary)
          ? window.hydreqSuitesState.getSuiteSummary(pathKey)
          : null;
        if (!rec || !Array.isArray(rec.tests) || rec.tests.length === 0) return;
        testsArr = rec.tests.map(t=> ({
          name: t.name||t.Name,
          status: (t.status||t.Status||'').toLowerCase(),
          durationMs: t.durationMs||t.DurationMs||0,
          messages: t.messages||t.Messages||[]
        }));
      }
      const li = document.querySelector('#suites li[data-path="'+pathKey+'"]'); if (!li) return;
      // Update suite-level badge early (independent of test row presence)
      try{
        const sb = li.querySelector('.suite-badge');
        if (sb && window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateSuiteBadge){
          let badge = 'unknown';
          for (const t of testsArr){ if ((t.status||'').toLowerCase()==='failed'){ badge='failed'; break; } }
          if (badge==='unknown'){
            if (testsArr.some(t=> (t.status||'').toLowerCase()==='passed')) badge='passed';
            else if (testsArr.some(t=> (t.status||'').toLowerCase()==='skipped')) badge='skipped';
          }
          window.hydreqSuitesDOM.updateSuiteBadge(sb, badge);
        }
      }catch(e){}
      const testsDiv = li.querySelector('.suite-tests'); if (!testsDiv) return;
      const map = window.hydreqSuitesState ? window.hydreqSuitesState.getLastStatus(pathKey) : new Map();
      testsArr.forEach(t=>{
        try{
          const nm = t.name || ''; if (!nm) return;
          const st = (t.status || (map.get ? map.get(nm) : map[nm]) || '').toLowerCase();
          const msgs = Array.isArray(t.messages) ? t.messages : [];
          const cont = (window.hydreqSuitesDOM && window.hydreqSuitesDOM.findTestContainer)
            ? window.hydreqSuitesDOM.findTestContainer(testsDiv, nm)
            : null;
          if (!cont) return;
          const badgeEl = cont.querySelector('.suite-test-status');
          if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateTestBadge) window.hydreqSuitesDOM.updateTestBadge(badgeEl, st);
          if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateTestDetails){
            // Always render for failed; and render for skipped (even if no messages)
            if (st === 'failed' || st === 'skipped'){
              let out = msgs;
              if (st === 'skipped' && (!Array.isArray(out) || out.length===0)){
                try{
                  if (window.hydreqStore){
                    const s = window.hydreqStore.getSuite(pathKey);
                    const tRec = s && s.tests && s.tests[nm];
                    const ms = tRec && Array.isArray(tRec.messages) ? tRec.messages : [];
                    if (ms.length) out = ms;
                  }
                }catch(e){}
              }
              window.hydreqSuitesDOM.updateTestDetails(cont, st, out||[]);
            }
          }
          if (window.hydreqSuitesState && window.hydreqSuitesState.setTestStatus) window.hydreqSuitesState.setTestStatus(pathKey, nm, st);
        }catch(e){}
      });
      // Suite badge already updated above
    }catch(e){}
  }

  async function expandSuiteByPath(pathKey){
    try{
      if (!pathKey) return;
      const li = document.querySelector('#suites li[data-path="'+pathKey+'"]');
      if (!li) return;
      const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
      if (!btn) return;
      if (btn.dataset.open === '1') return; // already open
      btn.click();
      if (btn._expandPromise && typeof btn._expandPromise.then === 'function'){
        try{ await btn._expandPromise; }catch(e){}
      }
    }catch(e){}
  }

  window.hydreqSuitesAPI = window.hydreqSuitesAPI || {
    getSuiteLastStatus,
    getSuiteSummary,
    getSuiteBadgeStatus,
    setSuiteTestDetails,
    setSuiteTestStatus,
    hydrateFromSummary,
    expandSuiteByPath
  };
})();
