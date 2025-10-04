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
function setBar(el, d, t){
  if(!el) return;
  const p = pct(d,t);
  el.style.width = p + '%';
  try{
    el.setAttribute('aria-valuenow', String(d));
    el.setAttribute('aria-valuemax', String(t));
    el.setAttribute('role','progressbar');
  }catch{}
}

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
  if (envActive){
    envActive.replaceChildren();
    Object.keys(env).forEach(k=>{ const b=document.createElement('span'); b.className='pill'; b.textContent=k; envActive.appendChild(b); });
  }
  // Also mirror into header next to Batch progress
  const topWrap = document.getElementById('activeEnvTopWrap');
  const top = document.getElementById('activeEnvTop');
  if (topWrap && top){
    top.replaceChildren();
    const keys = Object.keys(env);
    if (keys.length){
      topWrap.classList.remove('invisible');
      keys.slice(0,12).forEach(k=>{
        const b = document.createElement('span');
        b.className = 'pill text-10';
        b.textContent = k;
        top.appendChild(b);
      });
    } else {
      topWrap.classList.add('invisible');
    }
  }
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
    case 'light': return 'light';
    case 'dark': return 'dark';
    case 'synthwave': return 'synthwave';
    case 'hack': return 'forest';
    case 'catppuccin-mocha': return 'dracula';
    case 'catppuccin-latte': return 'cupcake';
    case 'catppuccin-frappe': return 'nord';
    case 'catppuccin-macchiato': return 'dracula';
    case 'nord': return 'nord';
    case 'dracula': return 'dracula';
    case 'monokai': return 'night';
    case 'gruvbox-dark': return 'coffee';
    case 'gruvbox-light': return 'autumn';
    case 'solarized-dark': return 'night';
    case 'solarized-light': return 'winter';
    case 'tokyo-night': return 'night';
    case 'one-dark-pro': return 'dim';
    case 'palenight': return 'night';
    case 'rose-pine': return 'sunset';
    case 'everforest-dark': return 'forest';
    case 'everforest-light': return 'garden';
    case 'ayu-dark': return 'black';
    default: return 'light';
  }
}

function isDocDark(){
  const b = document.body.classList;
  if (b.contains('dark')) return true;
  const darkClasses = [
    'hack', 'synthwave', 'catppuccin-mocha', 'catppuccin-frappe', 'catppuccin-macchiato',
    'nord', 'dracula', 'monokai', 'gruvbox-dark', 'solarized-dark', 'tokyo-night',
    'one-dark-pro', 'palenight', 'rose-pine', 'everforest-dark', 'ayu-dark'
  ];
  return darkClasses.some(c => b.contains(c));
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
  document.body.classList.remove(
    'dark', 'synthwave', 'hack', 'catppuccin-mocha', 'catppuccin-latte',
    'catppuccin-frappe', 'catppuccin-macchiato', 'nord', 'dracula', 'monokai',
    'gruvbox-dark', 'gruvbox-light', 'solarized-dark', 'solarized-light',
    'tokyo-night', 'one-dark-pro', 'palenight', 'rose-pine', 'everforest-dark',
    'everforest-light', 'ayu-dark'
  );

  // Add the appropriate theme class + ensure dark base for dark themes
  const darkSet = new Set([
    'dark', 'synthwave', 'hack', 'catppuccin-mocha', 'catppuccin-frappe', 'catppuccin-macchiato',
    'nord', 'dracula', 'monokai', 'gruvbox-dark', 'solarized-dark', 'tokyo-night',
    'one-dark-pro', 'palenight', 'rose-pine', 'everforest-dark', 'ayu-dark'
  ]);
  if (darkSet.has(name)) document.body.classList.add('dark');

  // Add specific class if not plain light/dark
  const specificClasses = new Set([
    'synthwave','hack','catppuccin-mocha','catppuccin-latte','catppuccin-frappe','catppuccin-macchiato',
    'nord','dracula','monokai','gruvbox-dark','gruvbox-light','solarized-dark','solarized-light',
    'tokyo-night','one-dark-pro','palenight','rose-pine','everforest-dark','everforest-light','ayu-dark'
  ]);
  if (specificClasses.has(name)) document.body.classList.add(name);
  
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