// utils.js - Utility functions for HydReq GUI

// Utility: create a safe filename from a suite name
function slugify(name) {
  return name.toLowerCase()
             .replace(/[^\w\s-]/g, '')
             .trim()
             .replace(/\s+/g, '-')
             .replace(/-+/g, '-');
}

// Percentage calculation
function pct(d,t){ return t>0 ? Math.min(100, Math.round(100*d/t)) : 0; }

// Set progress bar width
function setBar(el, d, t){ if(!el) return; el.style.width = pct(d,t) + '%'; }

// Parse environment variables from textarea
function parseEnv(){
  const env = {};
  const root = document.getElementById('env_kv_list');
  if (!root) return env;
  const rows = root.querySelectorAll('.env-row');
  rows.forEach(row=>{
    const k = (row.querySelector('.env-k')?.value||'').trim();
    const v = (row.querySelector('.env-v')?.value||'').trim();
    if (k) env[k] = v;
  });
  return env;
}

// Render active environment variables as pills
function renderActiveEnv(env){
  const envActive = document.getElementById('env_active');
  if (!envActive) return;
  envActive.innerHTML='';
  Object.keys(env).forEach(k=>{ const b=document.createElement('span'); b.className='pill'; b.textContent=k; envActive.appendChild(b); });
}

// Debounce function for delaying execution
function debounce(fn, wait){ let t=null; return function(){ const args=arguments; clearTimeout(t); t=setTimeout(()=> fn.apply(this,args), wait); } }

// Remove quotes around purely-numeric mapping keys in YAML string
function unquoteNumericKeys(yamlText){
  if (!yamlText) return yamlText;
  return yamlText.split('\n').map(line=>{
    const m = line.match(/^(\s*)("|')([0-9]+)("|')\s*:\s*(.*)$/);
    if (m) return m[1] + m[3] + ': ' + m[5];
    return line;
  }).join('\n');
}

// Download helpers
async function downloadURL(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(()=>res.statusText);
      alert('Download failed: ' + res.status + ' - ' + txt);
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    let filename = 'report';
    const m = cd.match(/filename\*?=(?:UTF-8''")?"?([^;"\n]+)/i);
    if (m && m[1]) filename = decodeURIComponent(m[1]);
    const a = document.createElement('a');
    const urlObj = URL.createObjectURL(blob);
    a.href = urlObj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(urlObj);
  } catch (e) {
    alert('Download error: ' + (e && e.message ? e.message : String(e)));
  }
}

function downloadSuite(path, format) {
  const runId = window.currentRunId || window.lastRunId;
  if (!runId) { alert('No run available to download from. Start a run first.'); return; }
  const url = '/api/report/suite?runId=' + encodeURIComponent(runId) + '&path=' + encodeURIComponent(path) + '&format=' + encodeURIComponent(format);
  downloadURL(url);
}

function downloadRun(format) {
  const runId = window.currentRunId || window.lastRunId;
  if (!runId) { alert('No run available to download from. Start a run first.'); return; }
  const url = '/api/report/run?runId=' + encodeURIComponent(runId) + '&format=' + encodeURIComponent(format);
  downloadURL(url);
}

// Theme helpers
function themeToDaisy(name){
  switch(name){
    case 'dark': return 'dark';
    case 'synthwave': return 'synthwave';
    case 'hack': return 'forest';
    case 'catppuccin-mocha': return 'dracula';
    case 'catppuccin-latte': return 'cupcake';
    default: return 'light';
  }
}

function isDocDark(){
  return document.body.classList.contains('dark') ||
         document.body.classList.contains('hack') ||
         document.body.classList.contains('catppuccin-mocha');
}

function applyTheme(name){
  const root = document.documentElement;
  root.setAttribute('data-theme', themeToDaisy(name));
  
  // If body isn't ready yet, defer until DOMContentLoaded
  if (!document.body) {
    const deferred = ()=> applyTheme(name);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function onReady(){
        document.removeEventListener('DOMContentLoaded', onReady);
        deferred();
      });
      return;
    }
    // If somehow still no body, bail silently
    return;
  }

  // Remove all theme classes first
  document.body.classList.remove('dark', 'synthwave', 'hack', 'catppuccin-mocha', 'catppuccin-latte');
  
  // Add the appropriate theme class
  if (name === 'dark' || name === 'synthwave') {
    document.body.classList.add('dark');
  }
  if (name === 'synthwave') {
    document.body.classList.add('synthwave');
  }
  if (name === 'hack') {
    document.body.classList.add('hack');
  }
  if (name === 'catppuccin-mocha') {
    document.body.classList.add('catppuccin-mocha');
  }
  if (name === 'catppuccin-latte') {
    document.body.classList.add('catppuccin-latte');
  }
  
  try { localStorage.setItem('hydreq.theme', name); } catch{}
  // Sync CodeMirror theme if available
  try { if (typeof window.syncEditorTheme === 'function') window.syncEditorTheme(); } catch{}
}

// Scroll to bottom of results if auto-scroll is enabled
function scrollBottom() {
  const autoScroll = document.getElementById('autoScroll');
  const results = document.getElementById('results');
  if (autoScroll && autoScroll.checked && results) {
    results.scrollTop = results.scrollHeight;
  }
}

// Expose to window for backward compatibility
window.slugify = slugify;
window.pct = pct;
window.setBar = setBar;
window.parseEnv = parseEnv;
window.renderActiveEnv = renderActiveEnv;
window.debounce = debounce;
window.unquoteNumericKeys = unquoteNumericKeys;
window.downloadURL = downloadURL;
window.downloadSuite = downloadSuite;
window.downloadRun = downloadRun;
window.themeToDaisy = themeToDaisy;
window.isDocDark = isDocDark;
window.applyTheme = applyTheme;
window.scrollBottom = scrollBottom;