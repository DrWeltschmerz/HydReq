// suites.js - Suite management functions for HydReq GUI

// Global variables for suite management
let selected = (window.hydreqSuitesState && window.hydreqSuitesState.getSelected()) || new Set();
let batch = { done: 0, total: 0 };
let suite = { done: 0, total: 0 };
const testRows = new Map(); // key: path::Name -> {container, line}
const agg = { passed:0, failed:0, skipped:0, total:0, suites:0, durationMs:0 };
const lastStatus = (window.hydreqSuitesState && window.hydreqSuitesState.getLastStatus)
  ? {
      get: (p) => window.hydreqSuitesState.getLastStatus(p),
      set: (p, m) => { /* no-op via state */ },
    }
  : new Map();

const lastSuiteSummary = (window.hydreqSuitesState && window.hydreqSuitesState.getSuiteSummary)
  ? {
      get: (p) => window.hydreqSuitesState.getSuiteSummary(p),
      set: (p, v) => window.hydreqSuitesState.setSuiteSummary(
        p,
        v && v.summary,
        v && v.tests
      ),
    }
  : new Map();

// canonical path/key for suite currently running
let currentSuitePath = (
  window.hydreqSuitesState &&
  window.hydreqSuitesState.getCurrentSuitePath &&
  window.hydreqSuitesState.getCurrentSuitePath()
) || null;
// Removed pending buffer: rely on hydreqStore + hydrateFromSummary
// Track open/expanded suites to preserve state across re-renders
let openSuites = (
  window.hydreqSuitesState &&
  window.hydreqSuitesState.getOpenSuites &&
  window.hydreqSuitesState.getOpenSuites()
) || new Set();

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
        if (expandBtn.dataset.loaded === '1') {
          // ensure visible if already loaded
          try{ testsDiv.classList.add('open'); testsDiv.style.display = 'block'; }catch(e){}
          // No pending buffer
          try{ hydrateFromSummary(pathKey); }catch(e){}
          if (expandBtn._resolveExpand) { expandBtn._resolveExpand(); expandBtn._expandPromise = null; expandBtn._resolveExpand = null; }
          return;
        }
        let spinner = null;
        try{
          spinner = document.createElement('span');
          spinner.className = 'spinner';
          expandBtn.insertBefore(spinner, expandBtn.firstChild);
        }catch(e){}
        try{
          const p = encodeURIComponent(pathKey);
          const res = await fetch('/api/editor/suite?path='+p);
          if (res.ok){
            const dd = await res.json(); const parsed = dd.parsed || dd; const tests = (parsed && parsed.tests) ? parsed.tests : [];
            testsDiv.innerHTML='';
            const selectedArr = Array.from(selected);
            tests.forEach(t=>{
              const statusMap = lastStatus.get(pathKey) || new Map();
              const st = statusMap.get((t.name||t.Name||'')) || '';
              const cont = (window.hydreqSuitesDOM && typeof window.hydreqSuitesDOM.buildTestContainer==='function')
                ? window.hydreqSuitesDOM.buildTestContainer(
                    t,
                    st,
                    {
                      selectedTags: selectedArr,
                      onToggleTag: (tg) => {
                        if (window.toggleSelectedTag) window.toggleSelectedTag(tg);
                      }
                    }
                  )
                : (function(){
                    const fallback = document.createElement('div');
                    fallback.className = 'suite-test-container';
                    const row = document.createElement('div');
                    row.className = 'suite-test-item';
                    const nm = document.createElement('span');
                    nm.className = 'suite-test-name';
                    nm.textContent = t.name || t.Name || '(unnamed)';
                    nm.title = nm.textContent;
                    nm.dataset.name = nm.textContent;
                    const badge = document.createElement('span');
                    badge.className = 'status-badge suite-test-status status-unknown';
                    badge.textContent = '·';
                    row.appendChild(nm);
                    row.appendChild(badge);
                    fallback.appendChild(row);
                    return fallback;
                  })();
              testsDiv.appendChild(cont);
            });
            expandBtn.dataset.loaded = '1';
            // make tests visible after load
            try{ testsDiv.classList.add('open'); testsDiv.style.display = 'block'; }catch(e){}
            // No pending buffer
            try{ hydrateFromSummary(pathKey); }catch(e){}
          }
        }catch(err){ try{ testsDiv.innerHTML = '<div class="dim">Failed to load tests</div>'; }catch(e){} }
        try{ if (spinner && spinner.parentNode) spinner.remove(); }catch(e){}
        try{
          const id = 'tests-' + slugify(pathKey);
          testsDiv.id = id;
          expandBtn.setAttribute('aria-controls', id);
        }catch{}
        if (expandBtn._resolveExpand) {
          try{
            expandBtn._resolveExpand();
            expandBtn._expandPromise = null;
            expandBtn._resolveExpand = null;
          }catch(e){}
        }
      },
      onToggleOpen: function(pathKey, isOpen){
        try{
          if (window.hydreqSuitesState) {
            window.hydreqSuitesState.toggleOpen(pathKey, isOpen);
          } else {
            if (isOpen) openSuites.add(pathKey);
            else openSuites.delete(pathKey);
            localStorage.setItem('hydreq.openSuites', JSON.stringify(Array.from(openSuites)));
          }
        }catch(e){}
      },
      onToggleTag: function(tag){ if (window.toggleSelectedTag) window.toggleSelectedTag(tag); },
      onToggleSelect: function(pathKey, newSelArr){
        try{
          if (window.hydreqSuitesState) selected = window.hydreqSuitesState.setSelected(newSelArr);
          else {
            selected = new Set(newSelArr);
            localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected)));
          }
        }catch(e){}
      },
      onEdit: async function(pathKey){
        try{
          const res = await fetch('/api/editor/suite?path=' + encodeURIComponent(pathKey));
          if (!res.ok){
            alert('Failed to load suite');
            return;
          }
          const data = await res.json();
          openEditor(pathKey, data);
        }catch(e){
          console.error(e);
          alert('Failed to open editor');
        }
      },
      onDelete: async function(pathKey){
        try{
          if (!confirm('Delete suite? ' + pathKey)) return;
          const res = await fetch('/api/editor/suite?path=' + encodeURIComponent(pathKey), {
            method: 'DELETE'
          });
          if (!res.ok && res.status !== 204){
            const t = await res.text().catch(()=>'');
            alert('Delete failed: ' + res.status + (t ? (' - ' + t) : ''));
            return;
          }
          selected.delete(pathKey);
          openSuites.delete(pathKey);
          localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected)));
          localStorage.setItem('hydreq.openSuites', JSON.stringify(Array.from(openSuites)));
          refresh();
        }catch(e){
          alert('Delete failed: ' + (e && e.message ? e.message : String(e)));
        }
      },
      onDownload: function(pathKey, fmt){ downloadSuite(pathKey, fmt); },
      onRefresh: function(){ refresh(); }
    };
    try{ window.hydreqSuitesView.render(list, opts); 
  // After render: hydrate any suites that are already marked open/loaded
      try{
        Array.from(document.querySelectorAll('#suites li')).forEach(li => {
          try{
            const p = li.getAttribute('data-path');
            const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
            const loaded = btn && btn.dataset && btn.dataset.loaded === '1';
            const open = btn && btn.dataset && btn.dataset.open === '1';
            if (loaded || open) { try{ hydrateFromSummary(p); }catch(e){} }
          }catch(e){}
        });
      }catch(e){}
    }catch(e){ console.error('suites-view render failed, falling back to inline implementation', e); }
  }catch(e){ console.error('renderSuites delegation failed', e); }
}


// Refresh the suite list from the server
async function refresh(){
  console.log('refresh: fetching /api/editor/suites');
  try {
    const res = await fetch('/api/editor/suites');
    console.log('refresh: fetch complete, status=', res && res.status);
    try{
      window.__HYDREQ_REFRESH = window.__HYDREQ_REFRESH || {};
      window.__HYDREQ_REFRESH.status = res && res.status;
      console.log('refresh: set status to', window.__HYDREQ_REFRESH.status);
    }catch{}
    let list = [];
    try {
      list = await res.json();
      console.log(
        'refresh: parsed JSON, list length:',
        Array.isArray(list) ? list.length : 'not array'
      );
    } catch (e) {
      console.error('refresh: failed parsing JSON', e);
    }
    console.log('refresh: got list (len=', (Array.isArray(list)?list.length:0), ')');
    try{
      window.__HYDREQ_REFRESH.list = list;
      window.__HYDREQ_REFRESH.len = Array.isArray(list) ? list.length : 0;
      console.log('refresh: set list and len', window.__HYDREQ_REFRESH.len);
    }catch{}
    try {
      renderSuites(list || []);
      console.log('refresh: renderSuites completed');
    } catch (e) {
      console.error('refresh: renderSuites threw', e);
      try{ window.__HYDREQ_REFRESH.err = String(e); }catch{}
    }
    try {
      const results = document.getElementById('results');
      if (results) {
        const d = document.createElement('div');
        d.textContent = 'DEBUG: refresh list len=' + (Array.isArray(list) ? list.length : 0);
        results.appendChild(d);
      }
    }catch(e){}
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
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suites,
      workers: parseInt(workersEl.value) || 4,
      tags: Array.isArray(tags) ? tags : [],
      defaultTimeoutMs: (defaultTimeoutMs > 0 ? defaultTimeoutMs : undefined),
      env
    })
  });
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

  // Prepare header pills for tags and env (delegated to DOM helpers)
  const renderHeaderTags = () => { try{ window.hydreqSuitesDOM && window.hydreqSuitesDOM.renderHeaderTags(); }catch(e){} };
  const renderHeaderEnv  = () => { try{ window.hydreqSuitesDOM && window.hydreqSuitesDOM.renderHeaderEnv(); }catch(e){} };

  // initial header render
  renderHeaderTags();
  renderHeaderEnv();
  if (results) results.textContent=''; 
  if (stages) stages.innerHTML=''; 
  if (batchBar) setBar(batchBar,0,1); 
  if (batchText) batchText.textContent = '0/0'; 
  if (suiteBar) setBar(suiteBar,0,1); 
  if (suiteText) suiteText.textContent = '0/0';

  // Handler implementations extracted from original ES onmessage
  function handleTestStart(payload){
    const {Name, Stage, path: evPath} = payload;
    if (evPath && currentSuitePath && evPath !== currentSuitePath) return;
    const wrap = document.createElement('div');
    const line = document.createElement('div'); line.className='run'; line.textContent = '… ' + Name;
    wrap.appendChild(line);
    if (results) results.appendChild(wrap);
    try{ window.__E2E_TESTSTART = true; }catch(e){}
    const key = (currentSuitePath||'') + '::' + Name;
    started.add(key);
    testRows.set(key, {container: wrap, line});
    try{
      const { barEl: st, textEl: stt, created } = (window.hydreqSuitesDOM && window.hydreqSuitesDOM.ensureStageRow)
        ? window.hydreqSuitesDOM.ensureStageRow(Stage)
        : (function(){
            const id = 'stage_'+Stage; const txt='stage_txt_'+Stage;
            let st = document.getElementById(id); let stt = document.getElementById(txt);
            if (!st || !stt){
              const d = document.createElement('div');
              d.className = 'row';
              d.innerHTML =
                '<div class="w-120px">stage ' + Stage + '</div>' +
                '<div class="progress flex-1">' +
                  '<div id="' + id + '" style="width:0%"></div>' +
                '</div>' +
                '<div class="pill" id="' + txt + '">0/0</div>';
              if (stages) stages.appendChild(d);
              st = document.getElementById(id);
              stt = document.getElementById(txt);
            }
            return { barEl: st, textEl: stt, created: true };
          })();
      if (created) dynamicStages.add(String(Stage));
      if (!suiteStagesFromStart.has(String(Stage))){
        const parts = (stt.textContent||'0/0').split('/');
        const done = parseInt(parts[0],10)||0; const total = (parseInt(parts[1],10)||0) + 1;
        stt.textContent = done + '/' + total; st.style.width = pct(done,total)+'%';
      }
    }catch(e){}
    scrollBottom();
  }

  function handleBatchStart(payload){ batch.total = payload.total; batch.done = 0; if (batchBar) setBar(batchBar,0,batch.total); if (batchText) batchText.textContent = '0/' + batch.total; }

  async function handleSuiteStart(payload){
    suite.total = payload.total; suite.done = 0; if (suiteBar) setBar(suiteBar,0,suite.total); if (suiteText) suiteText.textContent = '0/' + suite.total; if (stages) stages.innerHTML='';
    if (currentSuiteEl) currentSuiteEl.textContent = (payload.name || payload.path || '');
  currentSuitePath = payload.path || payload.name || null;
  try{ if (window.hydreqSuitesState) window.hydreqSuitesState.setCurrentSuitePath(currentSuitePath); }catch(e){}
    try{ started.clear(); }catch(e){}
    try{ suiteStagesFromStart = new Set(Object.keys(payload.stages||{}).map(k=> String(k))); dynamicStages = new Set(); }catch(e){ suiteStagesFromStart = new Set(); dynamicStages = new Set(); }
    renderHeaderTags(); renderHeaderEnv();
  try{ if (currentSuitePath && window.hydreqSuitesState && window.hydreqSuitesState.setTestStatus) {/* ensure map exists lazily */} }catch(e){}
    const nm = (payload.name || payload.path || '');
    const pth = payload.path || '';
    const base = pth ? pth.split('/').pop() : '';
    const ln = document.createElement('div'); ln.textContent = base && nm ? `=== running: ${nm} (${base}) ===` : `=== running: ${nm} ===`; if (results) results.appendChild(ln);
    scrollBottom();
    let stageMap = payload.stages || {};
    try{
      const li = document.querySelector('#suites li[data-path="'+(payload.path||'')+'"]');
      if (li) {
        const testsDiv = li.querySelector('.suite-tests');
        if (testsDiv && testsDiv.children.length) {
          const selectedTags = (window.getSelectedTags && window.getSelectedTags()) || [];
          if (Array.isArray(selectedTags) && selectedTags.length) {
            // keep backend-sent stageMap
          }
        }
      }
    }catch(e){}
  for(const k in stageMap){ try{ const { textEl, barEl } = window.hydreqSuitesDOM.ensureStageRow(k); if (textEl) textEl.textContent = '0/'+stageMap[k]; if (barEl) barEl.style.width = '0%'; }catch(e){} }
    try{ const target = payload.path || payload.name || ''; if (target) { try{ await expandSuiteByPath(target); }catch(e){} } }catch(e){}
  }

  function handleTest(payload){
    const {Name, Status, DurationMs, Stage, Messages, Tags, path: evPath} = payload;
    if (evPath && currentSuitePath && evPath !== currentSuitePath) return;
    const key = (currentSuitePath||'') + '::' + Name;
    let row = testRows.get(key);
    if (!row){
      const wrap = document.createElement('div'); wrap.className='runner-test-container';
      const line = document.createElement('div'); line.className='runner-test-item';
      wrap.appendChild(line);
      if (results) results.appendChild(wrap);
      row = {container: wrap, line}; testRows.set(key, row);
    }
  try{ if (window.hydreqSuitesState && window.hydreqSuitesState.setTestStatus) window.hydreqSuitesState.setTestStatus(currentSuitePath||'', Name, Status||''); }catch(e){}
  // Persist/update details in lastSuiteSummary for cross-view sync
  try{ if (window.hydreqSuitesState && window.hydreqSuitesState.upsertTest) window.hydreqSuitesState.upsertTest(currentSuitePath||'', Name, Status||'', DurationMs||0, Array.isArray(Messages)? Messages: []); }catch(e){}
  try{ if (window.hydreqStore && typeof window.hydreqStore.setTest==='function') window.hydreqStore.setTest(currentSuitePath||'', Name, { status: Status||'', durationMs: DurationMs||0, messages: Array.isArray(Messages)? Messages: [] }); }catch(e){}
    row.line.className = (Status==='passed'?'ok':(Status==='failed'?'fail':'skip'));
    if (Status==='skipped') {
      row.line.textContent = `- ${Name} (tags)`;
      // Show skip reasons if provided
      if (Array.isArray(Messages) && Messages.length){
        let det = row.container.querySelector('details.suite-test-details');
        if (!det){ det = document.createElement('details'); det.className='suite-test-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); row.container.appendChild(det); }
        let pre = det.querySelector('pre'); if (!pre){ pre = document.createElement('pre'); pre.className='message-block skip'; det.appendChild(pre); }
        pre.textContent = Messages.join('\n');
      }
    } else {
  row.line.textContent = (Status==='passed'?'✓':(Status==='failed'?'✗':'○')) + ' ' + Name + ' (' + DurationMs + ' ms)';
      if (Status==='failed' && Array.isArray(Messages) && Messages.length){
        let det = row.container.querySelector('details.suite-test-details');
        if (!det){ det = document.createElement('details'); det.className='suite-test-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); row.container.appendChild(det); }
        let pre = det.querySelector('pre'); if (!pre){ pre = document.createElement('pre'); pre.className='message-block fail'; det.appendChild(pre); }
        pre.textContent = Messages.join('\n');
      }
    }
    const skey = (currentSuitePath||'') + '::' + Name;
    const hadStarted = started.has(skey);
  let st = null, stt = null;
  try{ const h = window.hydreqSuitesDOM.ensureStageRow(Stage); st = h.barEl; stt = h.textEl; }catch(e){}
    const isDynamic = !(suiteStagesFromStart && suiteStagesFromStart.has(String(Stage)));
    if (hadStarted){ if(st && stt){ const txt = stt.textContent.split('/'); const done = (parseInt(txt[0],10)||0)+1; const total = parseInt(txt[1],10)||0; st.style.width = pct(done,total)+'%'; stt.textContent = done+'/'+total; } suite.done++; if (suiteBar) setBar(suiteBar, suite.done, suite.total); if (suiteText) suiteText.textContent = suite.done + '/' + suite.total; started.delete(skey); }
    else { if(st && stt){ const txt = stt.textContent.split('/'); let done = parseInt(txt[0],10)||0; let total = parseInt(txt[1],10)||0; if (isDynamic) { total += 1; } done += 1; st.style.width = pct(done,total)+'%'; stt.textContent = done+'/'+total; } suite.done++; if (suiteBar) setBar(suiteBar, suite.done, suite.total); if (suiteText) suiteText.textContent = suite.done + '/' + suite.total; }
    try {
      if (document.getElementById('editorModal')) return;
      const applyToLi = (li) => {
        if (!li) return;
        try {
          const sBadge = li.querySelector('.suite-badge');
          if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateSuiteBadge) {
            // Only upgrade status; don't downgrade a failed badge to passed/skipped mid-run
            const prev = sBadge && sBadge.dataset && sBadge.dataset.status;
            const next = (Status||'').toLowerCase();
            if (prev !== 'failed') window.hydreqSuitesDOM.updateSuiteBadge(sBadge, next);
          }
          const testsDiv = li.querySelector('.suite-tests');
          if (!testsDiv) return;
          const loaded = !!(li.querySelector('button[aria-controls]') || {}).dataset?.loaded;
          if (!loaded) return; // hydrate on expand instead
          const cont = window.hydreqSuitesDOM.findTestContainer(testsDiv, Name);
          if (!cont) return;
          const badgeEl = cont.querySelector('.suite-test-status');
          if (window.hydreqSuitesDOM.updateTestBadge) window.hydreqSuitesDOM.updateTestBadge(badgeEl, Status);
          if (Status === 'failed' || (Status === 'skipped' && Array.isArray(Messages) && Messages.length)){
            if (window.hydreqSuitesDOM.updateTestDetails) window.hydreqSuitesDOM.updateTestDetails(cont, Status, Messages);
          }
        } catch(e){}
      };
      if (currentSuitePath) {
        const li = document.querySelector('#suites li[data-path="' + currentSuitePath + '"]');
        applyToLi(li);
      }
      document.querySelectorAll('#suites li').forEach(li => {
        try {
          if (li.getAttribute('data-path') === currentSuitePath) return;
          const testsDiv = li.querySelector('.suite-tests');
          if (!testsDiv) return;
          const found = window.hydreqSuitesDOM.findTestContainer(testsDiv, Name);
          if (found) applyToLi(li);
        } catch (e) {}
      });
    } catch (e) {}
  }

  function handleSuiteEnd(payload){
    batch.done++; if (batchBar) setBar(batchBar, batch.done, batch.total); if (batchText) batchText.textContent = batch.done + '/' + batch.total;
    const name = payload.name || payload.path || '';
    const s = payload.summary || {};
    const line = `=== ${name} — ${s.passed||0} passed, ${s.failed||0} failed, ${s.skipped||0} skipped, total ${s.total||0} in ${s.durationMs||0} ms`;
    const div = document.createElement('div'); div.textContent = line; if (results) results.appendChild(div);
    agg.suites++; agg.durationMs += (s.durationMs||0);
    agg.passed += (s.passed||0); agg.failed += (s.failed||0); agg.skipped += (s.skipped||0); agg.total += (s.total||0);
    try{ const pth = payload.path || payload.name || currentSuitePath;
      if (Array.isArray(payload.tests) && pth){ const map = lastStatus.get(pth) || new Map(); payload.tests.forEach(t=>{ const nm=t.name||t.Name; const st=(t.status||t.Status||'').toLowerCase(); if (nm) map.set(nm, st); }); lastStatus.set(pth, map); }
  if (pth){ try{ if (window.hydreqSuitesState) window.hydreqSuitesState.setSuiteSummary(pth, s, Array.isArray(payload.tests)? payload.tests: []); else lastSuiteSummary.set(pth, { summary: s, tests: Array.isArray(payload.tests)? payload.tests: [] }); if (window.hydreqStore){ window.hydreqStore.setSummary(pth, s); if (Array.isArray(payload.tests)){ payload.tests.forEach(t=>{ const nm=t.name||t.Name; if (!nm) return; const st=t.status||t.Status||''; const dur=t.durationMs||t.DurationMs||0; const msgs=t.messages||t.Messages||[]; window.hydreqStore.setTest(pth, nm, { status: st, durationMs: dur, messages: Array.isArray(msgs)? msgs: [] }); }); } } }catch(e){}
  }
    }catch(e){}
    try{
      let li = document.querySelector('#suites li[data-path="'+(payload.path||'')+'"]');
      if (!li && payload.name){
        li = Array.from(document.querySelectorAll('#suites li .spec-title'))
          .map(n=> n.closest('li'))
          .find(li0 => (li0.querySelector('.spec-title')||{}).textContent === payload.name) || null;
      }
      if (li){
        const sb = li.querySelector('.suite-badge');
        if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateSuiteBadge){
          const status = (s.failed||0)>0 ? 'failed' : ((s.passed||0)>0 ? 'passed' : ((s.skipped||0)>0 ? 'skipped' : 'unknown'));
          window.hydreqSuitesDOM.updateSuiteBadge(sb, status);
          if (sb && sb.classList) { sb.classList.add('animate'); setTimeout(()=> sb.classList.remove('animate'), 220); }
        }
      }
    }catch(e){}
    scrollBottom();
  }

  function handleBatchEnd(payload){ const div = document.createElement('div'); div.textContent = `=== Batch summary — ${agg.passed} passed, ${agg.failed} failed, ${agg.skipped} skipped, total ${agg.total} in ${agg.durationMs} ms (suites ${agg.suites}/${batch.total}) ===`; if (results) results.appendChild(div); scrollBottom(); }

  function handleError(payload){ const d = document.createElement('div'); d.className='fail'; d.textContent = 'Error: ' + (payload.error||''); if (results) results.appendChild(d); try{ if (currentSuitePath){ const li = document.querySelector('#suites li[data-path="'+currentSuitePath+'"]'); if (li){ const sb = li.querySelector('.suite-badge'); if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.updateSuiteBadge) window.hydreqSuitesDOM.updateSuiteBadge(sb, 'failed'); } } }catch(e){} }

  function handleDone(payload){ try{ window.lastRunId = id; window.currentRunId = null; }catch(e){} }

  // Subscribe via suites-sse wrapper (which internally prefers hydreqRunListener)
  let unsub = null;
  if (window.hydreqSuitesSSE && typeof window.hydreqSuitesSSE.subscribeToRun === 'function'){
    unsub = window.hydreqSuitesSSE.subscribeToRun(id, {
      testStart: handleTestStart,
      batchStart: handleBatchStart,
      suiteStart: handleSuiteStart,
      test: handleTest,
      suiteEnd: handleSuiteEnd,
      batchEnd: handleBatchEnd,
      error: handleError,
      done: (p)=>{ handleDone(p); if (typeof unsub === 'function') try{ unsub(); }catch(e){} }
    });
  }
}

// Helper: find suite list item by path or friendly name
function getSuiteLiByPathOrName(path, name){
  try{
    let li = null;
    if (path){ li = document.querySelector('#suites li[data-path="'+path+'"]'); }
    if (!li && name){
      li = Array.from(document.querySelectorAll('#suites li .spec-title'))
        .map(n=> n.closest('li'))
        .find(li0 => (li0.querySelector('.spec-title')||{}).textContent === name) || null;
    }
    return li || null;
  }catch(e){ return null; }
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
  if (importBtn) importBtn.onclick = (window.importCollection||function(){ alert('Import not available'); });

  const newSuiteBtn = document.getElementById('newSuiteBtn');
  if (newSuiteBtn) newSuiteBtn.onclick = (window.promptNewSuite||function(){ alert('Editor not available'); });

  const expandAllBtn = document.getElementById('expandAll');
  if (expandAllBtn) expandAllBtn.onclick = () => { try{ window.expandAll && window.expandAll().catch(()=>{}); }catch(e){} };

  const collapseAllBtn = document.getElementById('collapseAll');
  if (collapseAllBtn) collapseAllBtn.onclick = () => { try{ window.collapseAll && window.collapseAll(); }catch(e){} };

  // Initial refresh
  refresh();
}

// Expose functions to window for backward compatibility
window.renderSuites = renderSuites;
// Actions now come from suites-actions.js; keep names for back-compat
// window.expandAll, window.collapseAll are defined in suites-actions.js
window.refresh = refresh;
window.run = run;
window.listen = listen;
window.promptNewSuite = promptNewSuite;
window.importCollection = importCollection;
window.initSuites = initSuites;
// Expose last run info for editor prepopulation
window.getSuiteLastStatus = function(path){ return (window.hydreqSuitesAPI && window.hydreqSuitesAPI.getSuiteLastStatus) ? window.hydreqSuitesAPI.getSuiteLastStatus(path) : {}; };
window.getSuiteSummary = function(path){ return (window.hydreqSuitesAPI && window.hydreqSuitesAPI.getSuiteSummary) ? window.hydreqSuitesAPI.getSuiteSummary(path) : null; };
window.getSuiteBadgeStatus = function(path){ return (window.hydreqSuitesAPI && window.hydreqSuitesAPI.getSuiteBadgeStatus) ? window.hydreqSuitesAPI.getSuiteBadgeStatus(path) : 'unknown'; };
// Back-compat helpers delegating to suites-api
window.setSuiteTestDetails = function(path, name, messages){ if (window.hydreqSuitesAPI && window.hydreqSuitesAPI.setSuiteTestDetails) window.hydreqSuitesAPI.setSuiteTestDetails(path, name, messages); };
window.setSuiteTestStatus = function(path, name, status){ if (window.hydreqSuitesAPI && window.hydreqSuitesAPI.setSuiteTestStatus) window.hydreqSuitesAPI.setSuiteTestStatus(path, name, status); };
// Keep chip selection highlighting in sync with sidebar tag selector
document.addEventListener('hydreq:tags-changed', ()=>{
  try{
    const sel = (window.getSelectedTags && window.getSelectedTags()) || [];
    document.querySelectorAll('#suites .tag-chip').forEach(el=>{
      try{ const t = el.dataset.tag; if (!t) return; if (sel.includes(t)) el.classList.add('selected'); else el.classList.remove('selected'); }catch(e){}
    });
  }catch(e){}
});

/**
 * Apply any buffered test events for a suite path into the UI (tests list and badges)
 */
// pending buffer removed; rely on store + hydration

/**
 * Hydrate an expanded suite's tests list from lastSuiteSummary: set badges and render details
 * so editor-originated updates (status/messages) appear even if no pending events exist.
 */
function hydrateFromSummary(pathKey){ if (window.hydreqSuitesAPI && window.hydreqSuitesAPI.hydrateFromSummary) window.hydreqSuitesAPI.hydrateFromSummary(pathKey); }

// Subscribe once to store updates to patch suites list incrementally
;(function setupStoreSubscription(){
  try{
    if (!window.hydreqStore || typeof window.hydreqStore.subscribe!=='function') return;
    if (window.__hydreq_store_subId) return; // already subscribed
    const subId = window.hydreqStore.subscribe((evt)=>{
      try{
        if (!evt || !evt.path) return;
        const li = document.querySelector('#suites li[data-path="'+evt.path+'"]');
        if (!li) return;
        // Patch suite badge on any badge event (or after test event if desired)
        if (evt.type === 'badge'){
          const sb = li.querySelector('.suite-badge'); if (sb){ const st = (evt.data||'').toLowerCase(); if (st==='failed'){ sb.textContent='✗'; sb.classList.remove('status-unknown','status-ok','status-skip'); sb.classList.add('status-fail'); sb.dataset.status='failed'; } else if (st==='passed'){ sb.textContent='✓'; sb.classList.remove('status-unknown','status-fail','status-skip'); sb.classList.add('status-ok'); sb.dataset.status='passed'; } else if (st==='skipped'){ sb.textContent='○'; sb.classList.remove('status-unknown','status-fail','status-ok'); sb.classList.add('status-skip'); sb.dataset.status='skipped'; } else { sb.textContent='·'; sb.classList.remove('status-ok','status-fail','status-skip'); sb.classList.add('status-unknown'); sb.dataset.status='unknown'; } }
          return;
        }
        if (evt.type === 'test'){
          // Only patch visible/expanded suites
          const testsDiv = li.querySelector('.suite-tests'); if (!testsDiv) return;
          // Find row for test name
          const name = evt.name || '';
          const cont = Array.from(testsDiv.children).find(r => { try{ return r.classList && r.classList.contains('suite-test-container') && r.querySelector('.suite-test-name') && (r.querySelector('.suite-test-name').dataset.name === name); }catch(e){ return false; } });
          if (!cont) return;
          const badgeEl = cont.querySelector('.suite-test-status');
          const st = (evt.data && evt.data.status) ? String(evt.data.status).toLowerCase() : '';
          const msgs = (evt.data && Array.isArray(evt.data.messages)) ? evt.data.messages : [];
          if (badgeEl){ if (st==='passed'){ badgeEl.textContent='✓'; badgeEl.classList.remove('status-unknown','status-fail','status-skip'); badgeEl.classList.add('status-ok'); } else if (st==='failed'){ badgeEl.textContent='✗'; badgeEl.classList.remove('status-unknown','status-ok','status-skip'); badgeEl.classList.add('status-fail'); } else if (st==='skipped'){ badgeEl.textContent='○'; badgeEl.classList.remove('status-unknown','status-ok','status-fail'); badgeEl.classList.add('status-skip'); } }
          if (st==='failed' || (st==='skipped' && msgs.length)){
            let det = cont.querySelector('details.suite-test-details'); if (!det){ det = document.createElement('details'); det.className='suite-test-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); cont.appendChild(det); }
            let pre = det.querySelector('pre'); if (!pre){ pre = document.createElement('pre'); pre.className='message-block'; det.appendChild(pre); }
            pre.className = 'message-block ' + (st==='failed'?'fail':(st==='skipped'?'skip':'ok'));
            pre.textContent = msgs.length ? msgs.join('\n') : 'No details reported';
          }
        }
      }catch(e){}
    });
    window.__hydreq_store_subId = subId;
  }catch(e){}
})();

// Expand a suite in the UI by its canonical path; awaits any expand promise
async function expandSuiteByPath(pathKey){ if (window.hydreqSuitesAPI && window.hydreqSuitesAPI.expandSuiteByPath) return window.hydreqSuitesAPI.expandSuiteByPath(pathKey); }