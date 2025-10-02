// Helpers for HydReq GUI (extracted from index.html)
// These are global functions relied upon by the main app code.

function slugify(name) {
  return name.toLowerCase()
             .replace(/[^\w\s-]/g, '')
             .trim()
             .replace(/\s+/g, '-')
             .replace(/-+/g, '-');
}

function pct(d,t){ return t>0 ? Math.min(100, Math.round(100*d/t)) : 0; }
function setBar(el, d, t){ if(!el) return; el.style.width = pct(d,t) + '%'; }

function parseEnv(){
  const env = {};
  const el = document.getElementById('env_kv');
  if (!el) return env;
  const lines = el.value.split(/\n/);
  for (const line of lines){
    const s = line.trim(); if (!s) continue; const eq = s.indexOf('=');
    if (eq>0){ const k=s.slice(0,eq).trim(); const v=s.slice(eq+1).trim(); if(k) env[k]=v; }
  }
  return env;
}

function renderActiveEnv(env){
  const envActive = document.getElementById('env_active');
  if (!envActive) return;
  envActive.innerHTML='';
  Object.keys(env).forEach(k=>{ const b=document.createElement('span'); b.className='pill'; b.textContent=k; envActive.appendChild(b); });
}

function debounce(fn, wait){ let t=null; return function(){ const args=arguments; clearTimeout(t); t=setTimeout(()=> fn.apply(this,args), wait); } }

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
  document.body.classList.toggle('dark', name === 'dark' || name === 'synthwave');
  document.body.classList.toggle('synthwave', name === 'synthwave');
  document.body.classList.toggle('hack', name === 'hack');
  document.body.classList.toggle('catppuccin-mocha', name === 'catppuccin-mocha');
  document.body.classList.toggle('catppuccin-latte', name === 'catppuccin-latte');
  try { localStorage.setItem('hydreq.theme', name); } catch{}
  // Sync CodeMirror theme if available
  try { if (typeof window.syncEditorTheme === 'function') window.syncEditorTheme(); } catch{}
}

// Expose helpers to window for legacy code that expects globals
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
