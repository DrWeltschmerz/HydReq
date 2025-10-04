// app.js - Main HydReq GUI application

// Early probe: mark that client-side script execution started. This helps E2E detect
// whether the script was aborted early by a runtime error.
try{
  console.log('HYDREQ-INIT: script start');
  try{ window.__HYDREQ_INIT = (window.__HYDREQ_INIT || 0) + 1; }catch(e){}
  // If #results exists append a small marker so Playwright can snapshot it
  (function(){ try{ const r=document.getElementById('results'); if (r){ const d=document.createElement('div'); d.textContent='HYDREQ-INIT: script start'; d.className='opacity-50 text-xs'; r.appendChild(d); } }catch(e){} })();
}catch(e){ /* ignore */ }

// Global variables
let currentRunId = null;
let lastRunId = null; // retain last run id for downloads after completion

function scrollBottom(){ 
  const autoScroll = document.getElementById('autoScroll');
  if (autoScroll && autoScroll.checked) { 
    const results = document.getElementById('results');
    if (results) results.scrollTop = results.scrollHeight; 
  } 
}

// Initialize the application
function initApp(){
  // Initialize theme first
  let saved = 'dark';
  try { saved = localStorage.getItem('hydreq.theme') || 'dark'; } catch{}
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) { 
    themeSelect.value = saved; 
    themeSelect.addEventListener('change', ()=> applyTheme(themeSelect.value)); 
  }
  applyTheme(saved);

  // Get DOM elements
  const envKVList = document.getElementById('env_kv_list');
  const envActive = document.getElementById('env_active');
  const tagsKVList = document.getElementById('tags_kv_list');
  const tagsActive = document.getElementById('tags_active');
  const onlyFailed = document.getElementById('onlyFailed');
  const autoScroll = document.getElementById('autoScroll');
  const cancelBtn = document.getElementById('cancel');
  const tagsEl = document.getElementById('tags');
  const defToEl = document.getElementById('defaultTimeout');
  const results = document.getElementById('results');
  const activeTagsTop = document.getElementById('activeTagsTop');
  const activeTagsTopWrap = document.getElementById('activeTagsTopWrap');

  // Restore persisted values
  console.log('tagsEl:', tagsEl);
  if (tagsEl) {
    tagsEl.value = localStorage.getItem('hydreq.tags') || '';
    tagsEl.addEventListener('input', () => {
      console.log('Saving tags:', tagsEl.value);
      localStorage.setItem('hydreq.tags', tagsEl.value);
    });
  }
  
  if (defToEl) {
    defToEl.value = localStorage.getItem('hydreq.defaultTimeout') || '';
    defToEl.addEventListener('input', () => localStorage.setItem('hydreq.defaultTimeout', defToEl.value));
  }

  // Build Env overrides KV UI
  (function initEnvKV(){
    if (!envKVList) return;
    const root = envKVList;
  while (root.firstChild) root.removeChild(root.firstChild);
  const head = document.createElement('div'); head.className='row';
  const headLabel = document.createElement('div'); headLabel.className='fw-600'; headLabel.textContent='Overrides';
  const headSpacer = document.createElement('div'); headSpacer.className='flex-1';
  const headBtn = document.createElement('button'); headBtn.id='env_add'; headBtn.className='btn btn-xs'; headBtn.textContent='+ Add';
  head.appendChild(headLabel); head.appendChild(headSpacer); head.appendChild(headBtn);
    root.appendChild(head);
    const list = document.createElement('div'); list.className='col'; root.appendChild(list);
    function addRow(k='', v=''){
  const row = document.createElement('div'); row.className='env-row row gap-6';
  const ki = document.createElement('input'); ki.className='env-k w-40p'; ki.placeholder='KEY'; ki.value=k;
  const vi = document.createElement('input'); vi.className='env-v flex-1'; vi.placeholder='value'; vi.value=v;
      const del = document.createElement('button'); del.className='btn btn-xs'; del.textContent='×'; del.title='Remove'; del.onclick = ()=>{ row.remove(); renderActiveEnv(parseEnv()); };
      [ki,vi].forEach(el=> el.addEventListener('input', ()=> renderActiveEnv(parseEnv())));
      row.appendChild(ki); row.appendChild(vi); row.appendChild(del); list.appendChild(row);
    }
    const addBtn = head.querySelector('#env_add'); addBtn.onclick = ()=> addRow();
    // Preload from persisted string (backward compat from textarea-based storage)
    try{ const raw = localStorage.getItem('hydreq.envRaw')||''; if (raw){ raw.split(/\n/).forEach(line=>{ const s=line.trim(); if(!s) return; const eq=s.indexOf('='); if (eq>0){ addRow(s.slice(0,eq).trim(), s.slice(eq+1).trim()); } }); } }catch{}
    // Attempt to preload from /env if backend exposes it; fallback to /.env static if accessible
    (async ()=>{
      try{
        const tryUrls = ['/api/env', '/env', '/.env'];
        for (const u of tryUrls){
          try{
            const res = await fetch(u); if (!res.ok) continue; const txt = await res.text();
            if (txt && txt.trim()){
              const lines = txt.split(/\n/);
              lines.forEach(line=>{ const s=line.trim(); if(!s || s.startsWith('#')) return; const eq=s.indexOf('='); if (eq>0){ const k=s.slice(0,eq).trim(); const v=s.slice(eq+1).trim(); const exists = Array.from(root.querySelectorAll('.env-row .env-k')).some(inp=> inp.value.trim()===k); if (!exists) addRow(k,v); } });
              renderActiveEnv(parseEnv());
              break;
            }
          }catch(e){}
        }
      }catch(e){}
    })();
  })();

  // Central tag selection helpers (shared across modules)
  function readTagState(){
    let list = [], sel = [];
    try{ list = JSON.parse(localStorage.getItem('hydreq.tags.list')||'[]')||[]; }catch{}
    try{ sel = JSON.parse(localStorage.getItem('hydreq.tags.selected')||'[]')||[]; }catch{}
    return { list: Array.isArray(list)? list: [], selected: Array.isArray(sel)? sel: [] };
  }
  function writeTagState(list, selected){
    try{ localStorage.setItem('hydreq.tags.list', JSON.stringify(list||[])); }catch{}
    try{ localStorage.setItem('hydreq.tags.selected', JSON.stringify(selected||[])); }catch{}
    // Back-compat with existing input wiring: keep #tags value in sync
    try{ const legacy = document.getElementById('tags'); if (legacy) legacy.value = (selected||[]).join(','); }catch{}
    // Broadcast to any listeners (suites/test chips)
    try{ document.dispatchEvent(new CustomEvent('hydreq:tags-changed')); }catch{}
  }
  if (!window.getSelectedTags) window.getSelectedTags = function(){ return readTagState().selected; };
  if (!window.setSelectedTags) window.setSelectedTags = function(arr){
    const st = readTagState();
    const uniq = Array.from(new Set((arr||[]).filter(Boolean)));
    writeTagState(st.list, uniq);
    // Re-render chips
    try{ __hydreq_renderActiveTags && __hydreq_renderActiveTags(); }catch{}
    // Rebuild rows/checkboxes if the helper is available
    try{ typeof __hydreq_syncTagRows === 'function' ? __hydreq_syncTagRows() : (window.__hydreq_syncTagRows && window.__hydreq_syncTagRows()); }catch{}
  };
  if (!window.toggleSelectedTag) window.toggleSelectedTag = function(tag){
    if (!tag) return;
    const st = readTagState();
    const s = new Set(st.selected);
    if (s.has(tag)) s.delete(tag); else s.add(tag);
    writeTagState(st.list.includes(tag)? st.list : st.list.concat([tag]), Array.from(s));
    // Re-render chips
    try{ __hydreq_renderActiveTags && __hydreq_renderActiveTags(); }catch{}
    // Rebuild rows/checkboxes if helper exists
    try{ typeof __hydreq_syncTagRows === 'function' ? __hydreq_syncTagRows() : (window.__hydreq_syncTagRows && window.__hydreq_syncTagRows()); }catch{}
  };

  // Build Tags selector UI (rows with [x] checkbox + tag input + delete)
  (function initTagsUI(){
    if (!tagsKVList) return;
    const root = tagsKVList;
  while (root.firstChild) root.removeChild(root.firstChild);
  const head = document.createElement('div'); head.className='row';
  const headLabel = document.createElement('div'); headLabel.className='fw-600'; headLabel.textContent='Tags';
  const headSpacer = document.createElement('div'); headSpacer.className='flex-1';
  const headBtn = document.createElement('button'); headBtn.id='tag_add'; headBtn.className='btn btn-xs'; headBtn.textContent='+ Add';
  head.appendChild(headLabel); head.appendChild(headSpacer); head.appendChild(headBtn);
    root.appendChild(head);
    const list = document.createElement('div'); list.className='col'; root.appendChild(list);
    function addRow(tag='', checked=false){
  const row = document.createElement('div'); row.className='row gap-6 mb-6';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!checked; cb.title='Include this tag in filter';
  const ti = document.createElement('input'); ti.type='text'; ti.placeholder='tag'; ti.value=tag; ti.className='flex-1';
      const del = document.createElement('button'); del.className='btn btn-xs'; del.textContent='×'; del.title='Remove';
      del.onclick = ()=>{ row.remove(); persistTags(); renderActiveTags(); };
      [cb, ti].forEach(el=> el.addEventListener('input', ()=>{ persistTags(); renderActiveTags(); }));
      row.appendChild(cb); row.appendChild(ti); row.appendChild(del); list.appendChild(row);
    }
    function persistTags(){
      const rows = Array.from(list.children);
      const tags = []; const selected = [];
      rows.forEach(r=>{ const cb=r.querySelector('input[type="checkbox"]'); const ti=r.querySelector('input[type="text"]'); if (!ti) return; const v=(ti.value||'').trim(); if (!v) return; tags.push(v); if (cb && cb.checked) selected.push(v); });
      writeTagState(tags, selected);
    }
    function renderActiveTags(){
      if (!tagsActive) return;
  while (tagsActive.firstChild) tagsActive.removeChild(tagsActive.firstChild);
      try{
        const sel = readTagState().selected;
        sel.forEach(v=>{ const b=document.createElement('span'); b.className='pill tag-chip selected'; b.textContent='#'+v; b.dataset.tag=v; b.title='Click to unselect';
          b.addEventListener('click', ()=> window.toggleSelectedTag(v));
          tagsActive.appendChild(b); 
        });
        if (activeTagsTop){
          while (activeTagsTop.firstChild) activeTagsTop.removeChild(activeTagsTop.firstChild);
          sel.forEach(v=>{ const b=document.createElement('span'); b.className='pill tag-chip selected'; b.textContent='#'+v; b.dataset.tag=v; b.title='Click to unselect'; b.addEventListener('click', ()=> window.toggleSelectedTag(v)); activeTagsTop.appendChild(b); });
        }
  if (activeTagsTopWrap){ activeTagsTopWrap.classList.toggle('invisible', sel.length === 0); }
      }catch{}
    }
    function syncTagRowsFromState(){
      const st = readTagState();
      // rebuild rows to reflect any external changes
      const current = Array.from(list.children).map(r=> ({ cb: r.querySelector('input[type="checkbox"]'), ti: r.querySelector('input[type="text"]') }));
      // Simple approach: clear and rebuild
  while (list.firstChild) list.removeChild(list.firstChild);
      st.list.forEach(tag=> addRow(tag, st.selected.includes(tag)));
    }
    // preload
    try{
      const st = readTagState();
      if (st.list.length){ st.list.forEach(t=> addRow(t, st.selected.includes(t))); }
      else { addRow('smoke', true); addRow('slow', false); writeTagState(['smoke','slow'], ['smoke']); }
    }catch{ addRow('smoke', true); addRow('slow', false); writeTagState(['smoke','slow'], ['smoke']); }
    const addBtn = head.querySelector('#tag_add'); addBtn.onclick = ()=> addRow('', true);
    renderActiveTags();
    persistTags();
    // Re-render chips when external change occurs
    document.addEventListener('hydreq:tags-changed', renderActiveTags);
    window.__hydreq_renderActiveTags = renderActiveTags;
    window.__hydreq_syncTagRows = syncTagRowsFromState;
  })();

  // Initialize suites
  initSuites();

  // Optional: periodically refresh the suites list to pick up new/removed files (e.g., after importing)
  // Enabled by default in dev mode; persists toggle in localStorage
  (function setupSuitesAutoRefresh(){
    try{
      const key = 'hydreq.autoRefreshSuites';
      const defaultOn = true; // default on; user can toggle off
      let on = (localStorage.getItem(key) || (defaultOn ? '1':'0')) === '1';
      // If a checkbox exists in the toolbar use it; otherwise run silently in the background
      const cb = document.getElementById('autoRefreshSuites');
      if (cb){ cb.checked = on; cb.onchange = ()=>{ on = cb.checked; localStorage.setItem(key, on ? '1':'0'); }; }
      let t = null;
      function loop(){
        try{
          if (!on){ t = setTimeout(loop, 5000); return; }
          // Refresh only if the page/tab is visible to avoid background noise
          if (document.visibilityState !== 'visible'){ t = setTimeout(loop, 5000); return; }
          refresh();
        }catch(e){}
        t = setTimeout(loop, 5000);
      }
      loop();
      window.addEventListener('beforeunload', ()=>{ try{ if (t) clearTimeout(t); }catch{} });
    }catch(e){}
  })();

  // Set up event handlers
  if (onlyFailed) {
    const ofInit = localStorage.getItem('hydreq.onlyFailed') === '1'; 
    onlyFailed.checked = ofInit;
    onlyFailed.onchange = ()=>{ localStorage.setItem('hydreq.onlyFailed', onlyFailed.checked ? '1' : '0'); };
  }

  if (autoScroll) {
    const asInit = localStorage.getItem('hydreq.autoScroll') !== '0'; 
    autoScroll.checked = asInit; 
    autoScroll.onchange = ()=>{ localStorage.setItem('hydreq.autoScroll', autoScroll.checked ? '1' : '0'); };
  }

  if (cancelBtn) {
    cancelBtn.onclick = async ()=>{ 
      if (!currentRunId) return; 
      try{ await fetch('/api/cancel?runId='+encodeURIComponent(currentRunId), { method:'POST' }); } catch(e){} 
    };
  }

  // Clear log button
  const clearLogBtn = document.getElementById('clearLog');
  if (clearLogBtn) {
    clearLogBtn.onclick = ()=>{ 
      if (results) results.textContent=''; 
    };
  }

  // Download buttons
  const downloadRunJSON = document.getElementById('downloadRunJSON');
  if (downloadRunJSON) downloadRunJSON.onclick = ()=> downloadRun('json');
  
  const downloadRunJUnit = document.getElementById('downloadRunJUnit');
  if (downloadRunJUnit) downloadRunJUnit.onclick = ()=> downloadRun('junit');
  
  const downloadRunHTML = document.getElementById('downloadRunHTML');
  if (downloadRunHTML) downloadRunHTML.onclick = ()=> downloadRun('html');

  // Keyboard shortcuts
  document.addEventListener('keydown', (e)=>{ 
    const tag = (e.target && (e.target.tagName||'')).toLowerCase(); 
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return; 
    if (e.key === 'r') { run(); e.preventDefault(); } 
    if (e.key === 's') { if (cancelBtn) cancelBtn.click(); e.preventDefault(); } 
    if (e.key === 'c') { if (clearLogBtn) clearLogBtn.click(); e.preventDefault(); } 
    if (e.key === 'f') { if (onlyFailed) { onlyFailed.checked = !onlyFailed.checked; onlyFailed.dispatchEvent(new Event('change')); } e.preventDefault(); } 
    if (e.key === 'd') { 
      const cur = (localStorage.getItem('hydreq.theme')||'dark'); 
      const next = (cur==='dark')?'light':'dark'; 
      const themeSelect = document.getElementById('themeSelect');
      if (themeSelect){ themeSelect.value = next; } 
      applyTheme(next); 
      e.preventDefault(); 
    } 
  });

  // E2E testing hooks
  try{
    window.__E2E_startRun = async function(suites, workers){
      try{
        const payload = { suites: suites || [], workers: workers || 1 };
        const res = await fetch('/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('run failed');
        const j = await res.json();
        const runId = j.runId;
        try{ currentRunId = runId; listen(runId); }catch(e){}
        return runId;
      }catch(e){ return null; }
    };
  }catch(e){}

  // Error handling
  try{
    window.addEventListener('error', function(ev){ 
      try{ console.error('HYDREQ: window error', ev && ev.message, ev && ev.error); }catch{} 
    });
    window.addEventListener('unhandledrejection', function(ev){ 
      try{ console.error('HYDREQ: unhandledrejection', ev && ev.reason); }catch{} 
    });
    
    // Post-load checks for debugging
    setTimeout(()=>{ 
      try{ 
        console.log('HYDREQ: post-load check 1, __HYDREQ_REFRESH=', window.__HYDREQ_REFRESH); 
        const count = document.querySelectorAll('#suites li').length; 
        console.log('HYDREQ: post-load check 1, suites li count=', count); 
        try{ if (results) { const d=document.createElement('div'); d.textContent = 'HYDREQ-DBG: post-load-1 count=' + count; d.className='opacity-50 text-xs'; results.appendChild(d); } }catch(e){} 
      }catch(e){ console.error('HYDREQ: post-load check 1 failed', e); } 
    }, 800);
    
    setTimeout(()=>{ 
      try{ 
        console.log('HYDREQ: post-load check 2, __HYDREQ_REFRESH=', window.__HYDREQ_REFRESH); 
        const count = document.querySelectorAll('#suites li').length; 
        console.log('HYDREQ: post-load check 2, suites li count=', count); 
  try{ if (results) { const d=document.createElement('div'); d.textContent = 'HYDREQ-DBG: post-load-2 count=' + count; d.className='opacity-50 text-xs'; results.appendChild(d); } }catch(e){} 
      }catch(e){ console.error('HYDREQ: post-load check 2 failed', e); } 
    }, 2500);
    
    setTimeout(()=>{ 
      try{ 
        const probe = window.__HYDREQ_REFRESH || {}; 
        const info = 'HYDREQ-FINAL: status=' + (probe.status||'') + ' len=' + (probe.len||0) + ' err=' + (probe.err||''); 
        console.log(info); 
  try{ if (results) { const d=document.createElement('div'); d.textContent = info; d.className='opacity-50 text-xs'; results.appendChild(d); } }catch(e){} 
      }catch(e){ console.error('HYDREQ: final probe failed', e); } 
    }, 3500);
  }catch(e){}
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
