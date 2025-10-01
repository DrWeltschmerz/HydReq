// app.js - Main HydReq GUI application

// Early probe: mark that client-side script execution started. This helps E2E detect
// whether the script was aborted early by a runtime error.
try{
  console.log('HYDREQ-INIT: script start');
  try{ window.__HYDREQ_INIT = (window.__HYDREQ_INIT || 0) + 1; }catch(e){}
  // If #results exists append a small marker so Playwright can snapshot it
  (function(){ try{ const r=document.getElementById('results'); if (r){ const d=document.createElement('div'); d.textContent='HYDREQ-INIT: script start'; d.style.opacity='0.6'; d.style.fontSize='12px'; r.appendChild(d); } }catch(e){} })();
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
  const envKV = document.getElementById('env_kv');
  const envActive = document.getElementById('env_active');
  const onlyFailed = document.getElementById('onlyFailed');
  const autoScroll = document.getElementById('autoScroll');
  const cancelBtn = document.getElementById('cancel');
  const tagsEl = document.getElementById('tags');
  const defToEl = document.getElementById('defaultTimeout');
  const results = document.getElementById('results');

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

  // Initialize suites
  initSuites();

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
        try{ if (results) { const d=document.createElement('div'); d.textContent = 'HYDREQ-DBG: post-load-1 count=' + count; results.appendChild(d); } }catch(e){} 
      }catch(e){ console.error('HYDREQ: post-load check 1 failed', e); } 
    }, 800);
    
    setTimeout(()=>{ 
      try{ 
        console.log('HYDREQ: post-load check 2, __HYDREQ_REFRESH=', window.__HYDREQ_REFRESH); 
        const count = document.querySelectorAll('#suites li').length; 
        console.log('HYDREQ: post-load check 2, suites li count=', count); 
        try{ if (results) { const d=document.createElement('div'); d.textContent = 'HYDREQ-DBG: post-load-2 count=' + count; results.appendChild(d); } }catch(e){} 
      }catch(e){ console.error('HYDREQ: post-load check 2 failed', e); } 
    }, 2500);
    
    setTimeout(()=>{ 
      try{ 
        const probe = window.__HYDREQ_REFRESH || {}; 
        const info = 'HYDREQ-FINAL: status=' + (probe.status||'') + ' len=' + (probe.len||0) + ' err=' + (probe.err||''); 
        console.log(info); 
        try{ if (results) { const d=document.createElement('div'); d.textContent = info; results.appendChild(d); } }catch(e){} 
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
