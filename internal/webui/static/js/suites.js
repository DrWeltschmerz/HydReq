// suites.js - Suite management functions for HydReq GUI

// Global variables for suite management
let selected = new Set();
let batch = { done: 0, total: 0 };
let suite = { done: 0, total: 0 };
const testRows = new Map(); // key: path::Name -> {container, line}
const agg = { passed:0, failed:0, skipped:0, total:0, suites:0, durationMs:0 };
const lastStatus = new Map(); // path -> Map(name=>status)
const lastSuiteSummary = new Map(); // path -> { summary, tests }
let currentSuitePath = null; // canonical path/key for suite currently running
const pendingTestEvents = new Map(); // path -> [events]
// Track open/expanded suites to preserve state across re-renders
let openSuites = new Set();
try{ openSuites = new Set(JSON.parse(localStorage.getItem('hydreq.openSuites')||'[]')); }catch(e){ openSuites = new Set(); }

// Render the list of test suites
function renderSuites(list){
  // Delegate DOM rendering to suites-view module and pass behaviour hooks
  try{
    if (!window.hydreqSuitesView || typeof window.hydreqSuitesView.render !== 'function'){
      console.warn('hydreqSuitesView.render not available; falling back to inline render');
      // Fallback: attempt to call original inline render (kept for compatibility)
    }
    // Convert lastStatus Map to plain object for view consumption
    const lastStatusObj = {};
    try{
      lastStatus.forEach((m, p) => { try{ lastStatusObj[p] = Object.fromEntries(Array.from(m.entries())); }catch(e){} });
    }catch(e){}

    // Provide callbacks for interactions that modify state (kept in this module)
    const opts = {
      selectedSet: selected,
      openSet: openSuites,
      lastStatusObj: lastStatusObj,
      preloadedTests: {},
      onExpand: async function(pathKey, li, expandBtn){
        // Mirror previous expand behavior: fetch suite tests and populate testsDiv
        const testsDiv = li.querySelector('.suite-tests');
        if (!testsDiv) return;
        // Toggle handling is managed by view; now fetch tests when not loaded
        if (expandBtn.dataset.loaded === '1') { if (expandBtn._resolveExpand) { expandBtn._resolveExpand(); expandBtn._expandPromise = null; expandBtn._resolveExpand = null; } return; }
        let spinner = null; try{ spinner = document.createElement('span'); spinner.className='spinner'; expandBtn.insertBefore(spinner, expandBtn.firstChild); }catch(e){}
        try{
          const p = encodeURIComponent(pathKey);
          const res = await fetch('/api/editor/suite?path='+p);
          if (res.ok){
            const dd = await res.json(); const parsed = dd.parsed || dd; const tests = (parsed && parsed.tests) ? parsed.tests : [];
            testsDiv.innerHTML='';
            tests.forEach(t=>{
              const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.padding='4px 6px';
              const nm = document.createElement('span'); nm.textContent = t.name || t.Name || '(unnamed)'; nm.title = nm.textContent; nm.dataset.name = nm.textContent;
              try{ const tt = t.tags || t.Tags || []; if (Array.isArray(tt) && tt.length){ const tw=document.createElement('span'); tw.className='row wrap gap-4px'; tw.style.marginLeft='6px'; const selectedArr = Array.from(selected); tt.slice(0,4).forEach(x=>{ const b=document.createElement('span'); b.className='pill tag-chip'; b.dataset.tag = x; b.textContent = '#'+x; b.style.fontSize='10px'; if (selectedArr.includes(x)) b.classList.add('selected'); b.addEventListener('click', (ev)=>{ ev.stopPropagation(); if (window.toggleSelectedTag) window.toggleSelectedTag(x); }); tw.appendChild(b); }); nm.appendChild(tw); } }catch(e){}
              const badge = document.createElement('span'); badge.className='pill'; const pathMap = lastStatus.get(pathKey); const keyName = nm.dataset.name; const st = pathMap ? (pathMap.get(keyName)||'') : ''; if (st==='passed'){ badge.textContent='✓'; badge.style.background='rgba(16,185,129,0.12)'; } else if (st==='failed'){ badge.textContent='✗'; badge.style.background='rgba(239,68,68,0.08)'; } else if (st==='skipped'){ badge.textContent='-'; badge.style.background='rgba(245,158,11,0.06)'; } else { badge.textContent='·'; badge.style.opacity='.6'; }
              row.appendChild(nm); row.appendChild(badge); testsDiv.appendChild(row);
            });
            expandBtn.dataset.loaded = '1';
            try{ flushPendingForPath(pathKey); }catch(e){}
          }
        }catch(err){ try{ testsDiv.innerHTML = '<div class="dim">Failed to load tests</div>'; }catch(e){} }
        try{ if (spinner && spinner.parentNode) spinner.remove(); }catch(e){}
        try{ const id = 'tests-' + slugify(pathKey); testsDiv.id = id; expandBtn.setAttribute('aria-controls', id); }catch{}
        if (expandBtn._resolveExpand) { try{ expandBtn._resolveExpand(); expandBtn._expandPromise = null; expandBtn._resolveExpand = null; }catch(e){} }
      },
      onToggleOpen: function(pathKey, isOpen){ try{ if (isOpen) openSuites.add(pathKey); else openSuites.delete(pathKey); localStorage.setItem('hydreq.openSuites', JSON.stringify(Array.from(openSuites))); }catch(e){} },
      onToggleTag: function(tag){ if (window.toggleSelectedTag) window.toggleSelectedTag(tag); },
      onToggleSelect: function(pathKey, newSelArr){ try{ selected = new Set(newSelArr); localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected))); }catch(e){} },
      onEdit: async function(pathKey){ try{ const res = await fetch('/api/editor/suite?path='+encodeURIComponent(pathKey)); if (!res.ok){ alert('Failed to load suite'); return; } const data = await res.json(); openEditor(pathKey, data); }catch(e){ console.error(e); alert('Failed to open editor'); } },
      onDelete: async function(pathKey){ try{ if (!confirm('Delete suite? '+pathKey)) return; const res = await fetch('/api/editor/suite?path='+encodeURIComponent(pathKey), { method:'DELETE' }); if (!res.ok && res.status !== 204){ const t=await res.text().catch(()=>''); alert('Delete failed: '+res.status+(t?(' - '+t):'')); return; } selected.delete(pathKey); openSuites.delete(pathKey); localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected))); localStorage.setItem('hydreq.openSuites', JSON.stringify(Array.from(openSuites))); refresh(); }catch(e){ alert('Delete failed: '+(e && e.message?e.message:String(e))); } },
      onDownload: function(pathKey, fmt){ downloadSuite(pathKey, fmt); },
      onRefresh: function(){ refresh(); }
    };
    try{ window.hydreqSuitesView.render(list, opts); }catch(e){ console.error('suites-view render failed, falling back to inline implementation', e); }
  }catch(e){ console.error('renderSuites delegation failed', e); }
}

// Expand all suite test lists
async function expandAll(){
  const lis = Array.from(document.querySelectorAll('#suites li'));
  for (const li of lis){
    try{
      const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
      if (!btn) continue;
      if (btn.dataset.open === '1') continue; // already open
      btn.click();
      if (btn._expandPromise && typeof btn._expandPromise.then === 'function'){
        try{ await btn._expandPromise; }catch(e){}
      }
    }catch(e){}
  }
}

// Collapse all suite test lists
function collapseAll(){
  const lis = Array.from(document.querySelectorAll('#suites li'));
  for (const li of lis){
    try{
      const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
      if (!btn) continue;
      if (btn.dataset.open === '1') btn.click();
    }catch(e){}
  }
}

// Refresh the suite list from the server
async function refresh(){
  console.log('refresh: fetching /api/editor/suites');
  try {
    const res = await fetch('/api/editor/suites');
    console.log('refresh: fetch complete, status=', res && res.status);
    try{ window.__HYDREQ_REFRESH = window.__HYDREQ_REFRESH || {}; window.__HYDREQ_REFRESH.status = res && res.status; console.log('refresh: set status to', window.__HYDREQ_REFRESH.status); }catch{}
    let list = [];
    try { list = await res.json(); console.log('refresh: parsed JSON, list length:', Array.isArray(list) ? list.length : 'not array'); } catch (e) { console.error('refresh: failed parsing JSON', e); }
    console.log('refresh: got list (len=', (Array.isArray(list)?list.length:0), ')');
    try{ window.__HYDREQ_REFRESH.list = list; window.__HYDREQ_REFRESH.len = Array.isArray(list)?list.length:0; console.log('refresh: set list and len', window.__HYDREQ_REFRESH.len); }catch{}
    try { renderSuites(list || []); console.log('refresh: renderSuites completed'); } catch (e) { console.error('refresh: renderSuites threw', e); try{ window.__HYDREQ_REFRESH.err = String(e); }catch{} }
    try { const results = document.getElementById('results'); if (results) { const d=document.createElement('div'); d.textContent = 'DEBUG: refresh list len=' + (Array.isArray(list)?list.length:0); results.appendChild(d); } }catch(e){}
  } catch (err) {
    console.error('refresh: fetch failed', err);
    try{ window.__HYDREQ_REFRESH = window.__HYDREQ_REFRESH || {}; window.__HYDREQ_REFRESH.err = String(err); }catch{}
  }
}

// Run selected test suites
async function run(){
  console.log('run called');
  let suites = Array.from(selected);
  // Filter out non-existent suites by intersecting with latest list from server
  try{
    const resList = await fetch('/api/editor/suites');
    if (resList.ok){
      const list = await resList.json();
      const valid = new Set(list.map(i=> (typeof i === 'string') ? i : (i.path || i.Path || i.file || JSON.stringify(i))));
      suites = suites.filter(p=> valid.has(p));
      // Drop stale selections from state
      let changed = false;
      Array.from(selected).forEach(p=>{ if (!valid.has(p)) { selected.delete(p); changed = true; } });
      if (changed){ try{ localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected))); }catch(e){} }
    }
  }catch(e){}
  if (suites.length === 0) {
    const resAll = await fetch('/api/editor/suites');
    if (!resAll.ok) { alert('No suites selected and failed to load suites'); return; }
    const alllist = await resAll.json();
    suites = alllist.map(i => (typeof i === 'string') ? i : (i.path || i.Path || i.file || JSON.stringify(i)));
  }
  const env = parseEnv();
  renderActiveEnv(env);
  const tagsEl = document.getElementById('tags');
  const defToEl = document.getElementById('defaultTimeout');
  // Prefer the new tag selector state
  let tags = [];
  try{ if (window.getSelectedTags) tags = window.getSelectedTags(); }catch(e){}
  if (!tags || !tags.length){
    try{ tags = JSON.parse(localStorage.getItem('hydreq.tags.selected')||'[]') || []; }catch(e){}
  }
  if (!tags || !tags.length){
    tags = (tagsEl && tagsEl.value)? tagsEl.value.split(',').map(s=>s.trim()).filter(Boolean) : [];
  }
  console.log('tags:', tags);
  const defaultTimeoutMs = (defToEl && defToEl.value)? (parseInt(defToEl.value,10)||0) : 0;
  const workersEl = document.getElementById('workers');
  const res = await fetch('/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({suites, workers: parseInt(workersEl.value)||4, tags: Array.isArray(tags) ? tags : [], defaultTimeoutMs: (defaultTimeoutMs>0? defaultTimeoutMs: undefined), env})});
  if (!res.ok){
    let txt = '';
    try { txt = await res.text(); } catch {}
    alert('Run failed: ' + res.status + (txt?(' - '+txt):''));
    return;
  }
  const { runId } = await res.json();
  window.currentRunId = runId;
  listen(runId);
}

// Listen for test run events
function listen(id){
  batch = { done:0, total:0 }; suite = { done:0, total:0 };
  // Reset aggregation for a fresh run
  agg.passed=0; agg.failed=0; agg.skipped=0; agg.total=0; agg.suites=0; agg.durationMs=0;
  // Track which tests actually started for the current suite
  const started = new Set(); // keys: path::Name
  // Track stage keys provided at suiteStart to differentiate DAG-dynamic stages
  let suiteStagesFromStart = new Set();
  let dynamicStages = new Set();
  try{ window.__E2E_LISTENED = id; }catch(e){}
  const results = document.getElementById('results');
  const stages = document.getElementById('stages');
  const batchBar = document.getElementById('batchBar');
  const batchText = document.getElementById('batchText');
  const suiteBar = document.getElementById('suiteBar');
  const suiteText = document.getElementById('suiteText');
  const currentSuiteEl = document.getElementById('currentSuite');
  // Prepare header pills for tags and env
  function renderHeaderTags(){
    try{
      const selTags = (window.getSelectedTags && window.getSelectedTags()) || [];
      const wrap = document.getElementById('activeTagsTopWrap');
      const cont = document.getElementById('activeTagsTop');
      if (!wrap || !cont) return;
      cont.innerHTML = '';
      if (Array.isArray(selTags) && selTags.length){
        wrap.classList.remove('invisible');
        selTags.forEach(t=>{ const b=document.createElement('span'); b.className='pill tag-chip'; b.textContent='#'+t; b.style.fontSize='10px'; cont.appendChild(b); });
      } else {
        wrap.classList.add('invisible');
      }
    }catch(e){}
  }
  function renderHeaderEnv(){
    try{
      const env = (typeof parseEnv==='function') ? parseEnv() : {};
      const wrap = document.getElementById('activeEnvTopWrap');
      const cont = document.getElementById('activeEnvTop');
      if (!wrap || !cont) return;
      cont.innerHTML = '';
      const keys = Object.keys(env);
      if (keys.length){
        wrap.classList.remove('invisible');
        keys.slice(0, 12).forEach(k=>{ const b=document.createElement('span'); b.className='pill'; b.textContent=k; b.style.fontSize='10px'; cont.appendChild(b); });
      } else {
        wrap.classList.add('invisible');
      }
    }catch(e){}
  }
  // initial header render
  renderHeaderTags();
  renderHeaderEnv();
  if (results) results.textContent=''; 
  if (stages) stages.innerHTML=''; 
  if (batchBar) setBar(batchBar,0,1); 
  if (batchText) batchText.textContent = '0/0'; 
  if (suiteBar) setBar(suiteBar,0,1); 
  if (suiteText) suiteText.textContent = '0/0';
  const es = new EventSource('/api/stream?runId=' + encodeURIComponent(id));
  try{ es.onopen = function(){ try{ window.__E2E_ES_OPEN = true; }catch(e){} }; }catch(e){}
  es.onmessage = async (e)=>{
    const ev = JSON.parse(e.data);
    const type = ev.type;
    const payload = ev.payload || {};
    async function expandSuiteByPath(target){
      try{
        const list = document.querySelectorAll('#suites li');
        for (const li of list){
          try{
            const btnEl = li.querySelector('button[aria-controls]');
            const pathKey = li.getAttribute('data-path') || (btnEl && btnEl.getAttribute && btnEl.getAttribute('data-path')) || null;
            if (!pathKey) continue;
            if (pathKey === target || li.querySelector('.spec-title')?.textContent === target){
              const btn = btnEl || li.querySelector('button');
              const testsDiv = li.querySelector('.suite-tests');
              if (!testsDiv) return;
              if (btn && btn.dataset.open !== '1') {
                try{
                  btn.click();
                  if (btn._expandPromise && typeof btn._expandPromise.then === 'function'){
                    await btn._expandPromise;
                  }
                  try{ flushPendingForPath(pathKey); }catch(e){}
                }catch(e){}
              }
              return;
            }
          }catch(e){}
        }
      }catch(e){}
    }

    function flushPendingForPath(path){
      try{
        const evs = pendingTestEvents.get(path);
        if (!evs || !evs.length) return;
        const li = document.querySelector('#suites li[data-path="'+path+'"]');
        if (!li) { pendingTestEvents.delete(path); return; }
        const testsDiv = li.querySelector('.suite-tests');
        if (!testsDiv) { pendingTestEvents.delete(path); return; }
        evs.forEach(ev=>{
          try{
            const { Name, Status, DurationMs, Messages } = ev;
            Array.from(testsDiv.children).forEach(r => {
              try{ const nm = r.children[0]; const badge = r.children[1]; if (!nm||!badge) return; if (nm.textContent === Name){ if (Status==='passed'){ badge.textContent='✓'; badge.style.background='rgba(16,185,129,0.12)'; badge.style.opacity='1'; } else if (Status==='failed'){ badge.textContent='✗'; badge.style.background='rgba(239,68,68,0.08)'; badge.style.opacity='1'; } else if (Status==='skipped'){ badge.textContent='-'; badge.style.background='rgba(245,158,11,0.06)'; badge.style.opacity='1'; } }
              }catch(e){}
            });
          }catch(e){}
        });
        pendingTestEvents.delete(path);
      }catch(e){}
    }
    if (type === 'testStart'){
      const {Name, Stage, path: evPath} = payload;
      // Ignore stray testStart from previous suites if any
      if (evPath && currentSuitePath && evPath !== currentSuitePath) {
        return;
      }
      const wrap = document.createElement('div');
      const line = document.createElement('div'); line.className='run'; line.textContent = '… ' + Name;
      wrap.appendChild(line);
      if (results) results.appendChild(wrap);
      try{ window.__E2E_TESTSTART = true; }catch(e){}
      const key = (currentSuitePath||'') + '::' + Name;
      started.add(key);
      testRows.set(key, {container: wrap, line});
      // Ensure stage row exists; for DAG (dependsOn) new layers may appear
      try{
        const stId = 'stage_'+Stage;
        let st = document.getElementById(stId);
        let stt = document.getElementById('stage_txt_'+Stage);
        if (!st || !stt){
          const d=document.createElement('div'); d.className='row';
          d.innerHTML='<div class="w-120px">stage '+Stage+'</div><div class="progress flex-1"><div id="'+stId+'" style="width:0%"></div></div><div class="pill" id="stage_txt_'+Stage+'">0/0</div>';
          if (stages) stages.appendChild(d);
          st = document.getElementById(stId); stt = document.getElementById('stage_txt_'+Stage);
          dynamicStages.add(String(Stage));
        }
        // If this stage wasn't provided by suiteStart, grow its total on testStart
        if (!suiteStagesFromStart.has(String(Stage))){
          const parts = (stt.textContent||'0/0').split('/');
          const done = parseInt(parts[0],10)||0; const total = (parseInt(parts[1],10)||0) + 1;
          stt.textContent = done + '/' + total; st.style.width = pct(done,total)+'%';
        }
      }catch(e){}
      scrollBottom();
    }
    if (type === 'batchStart'){
      batch.total = payload.total; batch.done = 0; if (batchBar) setBar(batchBar,0,batch.total); if (batchText) batchText.textContent = '0/' + batch.total;
    }
    if (type === 'suiteStart'){
      suite.total = payload.total; suite.done = 0; if (suiteBar) setBar(suiteBar,0,suite.total); if (suiteText) suiteText.textContent = '0/' + suite.total; if (stages) stages.innerHTML='';
      if (currentSuiteEl) currentSuiteEl.textContent = (payload.name || payload.path || '');
      currentSuitePath = payload.path || payload.name || null;
      // Reset started markers per suite
      try{ started.clear(); }catch(e){}
      // Track stage keys from payload to distinguish dynamic stages introduced by DAG layers
      try{ suiteStagesFromStart = new Set(Object.keys(payload.stages||{}).map(k=> String(k))); dynamicStages = new Set(); }catch(e){ suiteStagesFromStart = new Set(); dynamicStages = new Set(); }
      // Reinforce header pills at the start of each suite
      renderHeaderTags();
      renderHeaderEnv();
      // Clear per-suite last statuses for the new run of this suite
      try{ if (currentSuitePath) lastStatus.set(currentSuitePath, new Map()); }catch(e){}
  const nm = (payload.name || payload.path || '');
  const pth = payload.path || '';
  const base = pth ? pth.split('/').pop() : '';
  const ln = document.createElement('div'); ln.textContent = base && nm ? `=== running: ${nm} (${base}) ===` : `=== running: ${nm} ===`; if (results) results.appendChild(ln);
      scrollBottom();
      let stageMap = payload.stages || {};
      // Reconcile stage counts with current tag filters to avoid mismatch (mirror runner filtering logic roughly)
      try{
        const li = document.querySelector('#suites li[data-path="'+(payload.path||'')+'"]');
        if (li) {
          const testsDiv = li.querySelector('.suite-tests');
          if (testsDiv && testsDiv.children.length) {
            const selectedTags = (window.getSelectedTags && window.getSelectedTags()) || [];
            if (Array.isArray(selectedTags) && selectedTags.length) {
              const counts = {};
              Array.from(testsDiv.children).forEach(r=>{
                const nmEl = r.children && r.children[0];
                if (!nmEl) return;
                const tagChips = nmEl.querySelectorAll('.tag-chip');
                const tags = Array.from(tagChips).map(ch=> ch.dataset.tag).filter(Boolean);
                const ok = tags.length ? tags.some(t=> selectedTags.includes(t)) : false;
                const stLbl = (r.querySelector('.pill')||{}).textContent || '';
                // Derive stage number from DOM is not available; skip recalculation if missing
                // We only zero out stages where everything would be filtered by tags, which we can't do reliably here
                // So just keep backend-sent stageMap
              });
              // Keep stageMap as-is; backend already accounts for tags
            }
          }
        }
      }catch(e){}
      for(const k in stageMap){
        const d=document.createElement('div'); d.className='row';
        d.innerHTML='<div class="w-120px">stage '+k+'</div><div class="progress flex-1"><div id="stage_'+k+'" style="width:0%"></div></div><div class="pill" id="stage_txt_'+k+'">0/'+stageMap[k]+'</div>';
        if (stages) stages.appendChild(d);
      }
      try{ const target = payload.path || payload.name || ''; if (target) { try{ await expandSuiteByPath(target); }catch(e){} } }catch(e){}
    }
    if (type === 'test'){
      const {Name, Status, DurationMs, Stage, Messages, Tags, path: evPath} = payload;
      if (evPath && currentSuitePath && evPath !== currentSuitePath) {
        // This test event belongs to a different suite; ignore for per-suite counters
        return;
      }
      // Do not mutate batch-level aggregator here; rely on suiteEnd summaries to avoid double counting
      const key = (currentSuitePath||'') + '::' + Name;
      let row = testRows.get(key);
      if (!row){
        const wrap = document.createElement('div');
        const line = document.createElement('div'); wrap.appendChild(line); if (results) results.appendChild(wrap);
        row = {container: wrap, line}; testRows.set(key, row);
      }
      // Update last status for this suite/test
      try{ const m = lastStatus.get(currentSuitePath) || new Map(); m.set(Name, (Status||'').toLowerCase()); lastStatus.set(currentSuitePath, m); }catch(e){}
      row.line.className = (Status==='passed'?'ok':(Status==='failed'?'fail':'skip'));
      if (Status==='skipped') {
        row.line.textContent = `- ${Name} (tags)`;
      } else {
        row.line.textContent = (Status==='passed'?'✓':(Status==='failed'?'✗':'-')) + ' ' + Name + ' (' + DurationMs + ' ms)';
        if (Status==='failed' && Array.isArray(Messages) && Messages.length){
          let det = row.container.querySelector('details');
          if (!det){ det = document.createElement('details'); const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); row.container.appendChild(det); }
          let pre = det.querySelector('pre'); if (!pre){ pre = document.createElement('pre'); pre.className='fail'; det.appendChild(pre); }
          pre.textContent = Messages.join('\n');
        }
      }
      // Increment per-suite and per-stage progress with resilience when a testStart might be missing
      const skey = (currentSuitePath||'') + '::' + Name;
      const hadStarted = started.has(skey);
      // Ensure stage row exists (covers DAG dynamic layers); may also backfill totals for dynamic stages
      let st = document.getElementById('stage_'+Stage); let stt = document.getElementById('stage_txt_'+Stage);
      if (!st || !stt){
        const d=document.createElement('div'); d.className='row';
        d.innerHTML='<div class="w-120px">stage '+Stage+'</div><div class="progress flex-1"><div id="stage_'+Stage+'" style="width:0%"></div></div><div class="pill" id="stage_txt_'+Stage+'">0/0</div>';
        if (stages) stages.appendChild(d);
        st = document.getElementById('stage_'+Stage); stt = document.getElementById('stage_txt_'+Stage);
      }
      const isDynamic = !(suiteStagesFromStart && suiteStagesFromStart.has(String(Stage)));
      if (hadStarted){
        // Normal path: testStart seen previously
        if(st && stt){ const txt = stt.textContent.split('/'); const done = (parseInt(txt[0],10)||0)+1; const total = parseInt(txt[1],10)||0; st.style.width = pct(done,total)+'%'; stt.textContent = done+'/'+total; }
        suite.done++;
        if (suiteBar) setBar(suiteBar, suite.done, suite.total); if (suiteText) suiteText.textContent = suite.done + '/' + suite.total;
        started.delete(skey);
      } else {
        // Fallback: no testStart received (rare). Advance stage counters and suite done.
        if(st && stt){
          const txt = stt.textContent.split('/');
          let done = parseInt(txt[0],10)||0; let total = parseInt(txt[1],10)||0;
          if (isDynamic) { total += 1; }
          done += 1;
          st.style.width = pct(done,total)+'%'; stt.textContent = done+'/'+total;
        }
        suite.done++;
        if (suiteBar) setBar(suiteBar, suite.done, suite.total); if (suiteText) suiteText.textContent = suite.done + '/' + suite.total;
      }
      try {
        if (!document.getElementById('editorModal')) {
          try {
            const updateBadgeForLi = (li)=>{
              if (!li) return;
              try{
                const sBadge = li.querySelector('.suite-badge');
                // Use priority: failed > skipped > passed, but don't override failed status
                if (Status === 'failed') { 
                  if (sBadge) { 
                    sBadge.textContent = '✗'; 
                    sBadge.style.background='rgba(239,68,68,0.08)'; 
                    sBadge.style.opacity='1'; 
                    sBadge.dataset.status = 'failed'; 
                  } 
                }
                else if (Status === 'passed') { 
                  if (sBadge && sBadge.textContent !== '✗' && sBadge.dataset.status !== 'failed') { 
                    sBadge.textContent = '✓'; 
                    sBadge.style.background='rgba(16,185,129,0.12)'; 
                    sBadge.style.opacity='1'; 
                    sBadge.dataset.status = 'passed'; 
                  } 
                }
                else if (Status === 'skipped') { 
                  if (sBadge && sBadge.textContent !== '✗' && sBadge.dataset.status !== 'failed' && sBadge.dataset.status !== 'passed') { 
                    sBadge.textContent = '-'; 
                    sBadge.style.background='rgba(245,158,11,0.06)'; 
                    sBadge.style.opacity='1'; 
                    sBadge.dataset.status = 'skipped'; 
                  } 
                }
                const testsDiv = li.querySelector('.suite-tests');
                if (testsDiv){
                  const expandBtnLocal = li.querySelector('button[aria-controls]');
                  const loaded = expandBtnLocal && expandBtnLocal.dataset && expandBtnLocal.dataset.loaded === '1';
                  if (!loaded){
                    try{ const p = li.getAttribute('data-path') || (li.querySelector('.spec-title') && li.querySelector('.spec-title').textContent) || ''; if (p){ const arr = pendingTestEvents.get(p) || []; arr.push({ Name, Status, DurationMs, Messages }); pendingTestEvents.set(p, arr); } }catch(e){}
                  } else {
                    // Update individual test badges for expanded suites
                    Array.from(testsDiv.children).forEach(r => { 
                      try{ 
                        const nmEl=r.children[0], badgeEl=r.children[1]; 
                        if (!nmEl||!badgeEl) return; 
                        const rowName = (nmEl.dataset && nmEl.dataset.name) ? nmEl.dataset.name : nmEl.textContent;
                        if (rowName===Name){ 
                          if (Status==='passed'){ 
                            badgeEl.textContent='✓'; 
                            badgeEl.style.background='rgba(16,185,129,0.12)'; 
                            badgeEl.style.opacity='1'; 
                          } else if (Status==='failed'){ 
                            badgeEl.textContent='✗'; 
                            badgeEl.style.background='rgba(239,68,68,0.08)'; 
                            badgeEl.style.opacity='1'; 
                          } else if (Status==='skipped'){ 
                            badgeEl.textContent='-'; 
                            badgeEl.style.background='rgba(245,158,11,0.06)'; 
                            badgeEl.style.opacity='1'; 
                          } 
                        } 
                      }catch(e){} 
                    });
                    // Don't reset suite badge to unknown when a single test row isn't found (e.g., filtered by tags)
                    // We rely on suiteEnd to set the final suite badge
                  }
                }
              }catch(e){}
            };
            
            // Update suite badges for the current suite and any other suites that contain this test
            if (currentSuitePath){ 
              const li = document.querySelector('#suites li[data-path="'+currentSuitePath+'"]'); 
              if (li) updateBadgeForLi(li); 
            }
            document.querySelectorAll('#suites li').forEach(li=>{ 
              try{ 
                if (li.getAttribute('data-path') === currentSuitePath) return; 
                const testsDiv = li.querySelector('.suite-tests'); 
                if (!testsDiv) return; 
                const found = Array.from(testsDiv.children).some(r=> { const el=r.children && r.children[0]; if(!el) return false; const rn=(el.dataset&&el.dataset.name)?el.dataset.name:el.textContent; return rn===Name; });
                if (found) { updateBadgeForLi(li); }
              } catch(e) {} 
            });
          } catch(e) {}
        } // end of if (!document.getElementById('editorModal')) branch
      } catch(e) {} // end of outer try that wraps UI update logic
    } // end of `if (type === 'test')` handler

    // Suite-level and batch-level events should be handled at the same level as 'test' (not nested inside it)
    if (type === 'suiteEnd'){
      batch.done++; if (batchBar) setBar(batchBar, batch.done, batch.total); if (batchText) batchText.textContent = batch.done + '/' + batch.total;
      const name = payload.name || payload.path || '';
      const s = payload.summary || {};
      const line = `=== ${name} — ${s.passed||0} passed, ${s.failed||0} failed, ${s.skipped||0} skipped, total ${s.total||0} in ${s.durationMs||0} ms`;
      const div = document.createElement('div'); div.textContent = line; if (results) results.appendChild(div);
      // Aggregate strictly from suite summary
      agg.suites++; agg.durationMs += (s.durationMs||0);
      agg.passed += (s.passed||0); agg.failed += (s.failed||0); agg.skipped += (s.skipped||0); agg.total += (s.total||0);
      // Update per-test lastStatus if suite provided tests array
      try{
        const pth = payload.path || payload.name || currentSuitePath;
        if (Array.isArray(payload.tests) && pth){
          const map = lastStatus.get(pth) || new Map();
          payload.tests.forEach(t=>{ const nm=t.name||t.Name; const st=(t.status||t.Status||'').toLowerCase(); if (nm) map.set(nm, st); });
          lastStatus.set(pth, map);
        }
        // Cache last suite summary for editor prepopulation
        if (pth){
          lastSuiteSummary.set(pth, { summary: s, tests: Array.isArray(payload.tests)? payload.tests: [] });
        }
      }catch(e){}
      try{
        let li = null;
        if (payload.path){ li = document.querySelector('#suites li[data-path="'+payload.path+'"]'); }
        if (!li && payload.name){
          // Fallback: locate by suite title text if path is absent or element not found
          li = Array.from(document.querySelectorAll('#suites li .spec-title')).map(n=> n.closest('li')).find(li0 => (li0.querySelector('.spec-title')||{}).textContent === payload.name) || null;
        }
        if (li){ 
          const sb = li.querySelector('.suite-badge'); 
          if (sb){ 
            // Prioritize failed > skipped > passed
            if ((s.failed||0) > 0 || sb.dataset.status === 'failed'){ 
              sb.textContent = '✗'; 
              sb.style.background='rgba(239,68,68,0.08)'; 
              sb.style.opacity='1'; 
              sb.dataset.status = 'failed'; 
            } else if ((s.skipped||0) > 0 && (s.passed||0) === 0) { 
              // All tests skipped, no passes
              if (sb.dataset.status !== 'failed') { sb.textContent = '-'; sb.style.background='rgba(245,158,11,0.06)'; sb.style.opacity='1'; sb.dataset.status = 'skipped'; }
            } else if ((s.passed||0) > 0) { 
              // Some tests passed (with possible skips)
              if (sb.dataset.status !== 'failed') { sb.textContent = '✓'; sb.style.background='rgba(16,185,129,0.12)'; sb.style.opacity='1'; sb.dataset.status = 'passed'; }
            } else {
              // No tests or unknown state
              if (sb.dataset.status !== 'failed') { sb.textContent = '·'; sb.style.background=''; sb.style.opacity = '.6'; sb.dataset.status = 'unknown'; }
            }
            sb.classList.add('animate'); 
            setTimeout(()=> sb.classList.remove('animate'), 220); 
          } 
        }
      }catch(e){}
      scrollBottom();
    }

    if (type === 'batchEnd'){
      const div = document.createElement('div'); div.textContent = `=== Batch summary — ${agg.passed} passed, ${agg.failed} failed, ${agg.skipped} skipped, total ${agg.total} in ${agg.durationMs} ms (suites ${agg.suites}/${batch.total}) ===`; if (results) results.appendChild(div);
      scrollBottom();
    }

  if (type === 'error'){ const d = document.createElement('div'); d.className='fail'; d.textContent = 'Error: ' + (payload.error||''); if (results) results.appendChild(d); try{ if (currentSuitePath){ const li = document.querySelector('#suites li[data-path="'+currentSuitePath+'"]'); if (li){ const sb = li.querySelector('.suite-badge'); if (sb){ sb.textContent='✗'; sb.style.background='rgba(239,68,68,0.08)'; sb.style.opacity='1'; sb.dataset.status='failed'; } } } }catch(e){} }

    if (type === 'done'){ es.close(); window.lastRunId = id; window.currentRunId = null; }
      }; // end es.onmessage
}

// Prompt user to create a new suite
async function promptNewSuite() {
  const name = prompt('Enter suite name (e.g. My API tests):');
  if (!name) return;
  const slug = slugify(name);
  const path = 'testdata/' + slug + '.yaml';
  // quick client-side validation
  if (!path.startsWith('testdata/') || (!path.endsWith('.yaml') && !path.endsWith('.yml'))) {
    alert('Invalid path generated. Please choose a different name.');
    return;
  }

  // Check existence via the editor endpoint (returns 200 if exists)
  try {
    const resp = await fetch('/api/editor/suite?path=' + encodeURIComponent(path));
    if (resp.ok) {
      if (!confirm('A suite already exists at ' + path + '. Overwrite?')) return;
    }
  } catch (e) {
    // ignore network errors; we'll still open editor for new file
  }

  const parsed = {
    name: name,
    baseUrl: "",
    vars: {},
    tests: [
      { name: "example test", request: { method: "GET", url: "/" }, assert: { status: 200 } }
    ]
  };

  try {
    openEditor(path, parsed);
  } catch (e) {
    console.error('openEditor failed', e);
    alert('Failed to open editor: ' + (e && e.message ? e.message : e));
  }
}

// Import collection from external format
async function importCollection(){
  const format = document.getElementById('importFormat').value;
  const fileInput = document.getElementById('importFile');
  const statusEl = document.getElementById('importStatus');

  if (!fileInput.files.length) {
    statusEl.textContent = 'Please select a file';
    return;
  }

  const file = fileInput.files[0];
  statusEl.textContent = 'Importing...';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);

  try {
    const res = await fetch('/api/import', { method: 'POST', body: formData });
    if (!res.ok) {
      const error = await res.text();
      statusEl.textContent = 'Import failed: ' + error;
      return;
    }

    const yaml = await res.text();
    const blob = new Blob([yaml], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imported-suite.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusEl.textContent = 'Import successful! Downloaded as imported-suite.yaml';
    fileInput.value = '';
  } catch (e) {
    statusEl.textContent = 'Import failed: ' + e.message;
  }
}

// Initialize suite management
function initSuites(){
  // Restore selected suites from localStorage
  try {
    const rawSel = localStorage.getItem('hydreq.sel');
    selected = new Set(JSON.parse(rawSel || '[]'));
  } catch (e) {
    console.error('HYDREQ: failed to parse hydreq.sel from localStorage, falling back to empty set', e);
    selected = new Set();
  }

  // Initialize UI elements
  const selCount = document.getElementById('selCount');
  if (selCount) selCount.textContent = selected.size + ' selected';

  // Set up event handlers
  const refreshBtn = document.getElementById('refresh');
  if (refreshBtn) refreshBtn.onclick = refresh;

  const runBtn = document.getElementById('run');
  if (runBtn) runBtn.onclick = run;

  const importBtn = document.getElementById('importBtn');
  if (importBtn) importBtn.onclick = importCollection;

  const newSuiteBtn = document.getElementById('newSuiteBtn');
  if (newSuiteBtn) newSuiteBtn.onclick = promptNewSuite;

  const expandAllBtn = document.getElementById('expandAll');
  if (expandAllBtn) expandAllBtn.onclick = () => { expandAll().catch(()=>{}); };

  const collapseAllBtn = document.getElementById('collapseAll');
  if (collapseAllBtn) collapseAllBtn.onclick = collapseAll;

  // Initial refresh
  refresh();
}

// Expose functions to window for backward compatibility
window.renderSuites = renderSuites;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.refresh = refresh;
window.run = run;
window.listen = listen;
window.promptNewSuite = promptNewSuite;
window.importCollection = importCollection;
window.initSuites = initSuites;
// Expose last run info for editor prepopulation
window.getSuiteLastStatus = function(path){ try{ const m = lastStatus.get(path)||new Map(); return Object.fromEntries(m.entries()); }catch(e){ return {}; } };
window.getSuiteSummary = function(path){ try{ return lastSuiteSummary.get(path) || null; }catch(e){ return null; } };
window.getSuiteBadgeStatus = function(path){ try{ const li = document.querySelector('#suites li[data-path="'+path+'"]'); const sb = li && li.querySelector && li.querySelector('.suite-badge'); return (sb && sb.dataset && sb.dataset.status) ? sb.dataset.status : 'unknown'; }catch(e){ return 'unknown'; } };
// Allow external callers (e.g., editor) to set per-test status for a suite and update UI if expanded
window.setSuiteTestStatus = function(path, name, status){
  try{
    if (!path || !name) return;
    const st = (status||'').toLowerCase();
    const map = lastStatus.get(path) || new Map();
    map.set(name, st);
    lastStatus.set(path, map);
    const li = document.querySelector('#suites li[data-path="'+path+'"]');
    if (!li) return;
    const testsDiv = li.querySelector('.suite-tests');
    if (!testsDiv || testsDiv.style.display==='none') return; // not expanded; will reflect on expand
    Array.from(testsDiv.children).forEach(r=>{
      try{
        const nmEl = r.children && r.children[0];
        const badgeEl = r.children && r.children[1];
        if (!nmEl || !badgeEl) return;
        if (nmEl.textContent === name){
          if (st==='passed'){ badgeEl.textContent='✓'; badgeEl.style.background='rgba(16,185,129,0.12)'; badgeEl.style.opacity='1'; }
          else if (st==='failed'){ badgeEl.textContent='✗'; badgeEl.style.background='rgba(239,68,68,0.08)'; badgeEl.style.opacity='1'; }
          else if (st==='skipped'){ badgeEl.textContent='-'; badgeEl.style.background='rgba(245,158,11,0.06)'; badgeEl.style.opacity='1'; }
        }
      }catch(e){}
    });
  }catch(e){}
};
// Keep chip selection highlighting in sync with sidebar tag selector
document.addEventListener('hydreq:tags-changed', ()=>{
  try{
    const sel = (window.getSelectedTags && window.getSelectedTags()) || [];
    document.querySelectorAll('#suites .tag-chip').forEach(el=>{
      try{ const t = el.dataset.tag; if (!t) return; if (sel.includes(t)) el.classList.add('selected'); else el.classList.remove('selected'); }catch(e){}
    });
  }catch(e){}
});