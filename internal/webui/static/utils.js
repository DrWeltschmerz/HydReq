// Utility functions
function slugify(name) {
  return name.toLowerCase()
             .replace(/[^\w\s-]/g, '')
             .trim()
             .replace(/\s+/g, '-')
             .replace(/-+/g, '-');
}

function pct(d, t) {
  return t > 0 ? Math.min(100, Math.round(100 * d / t)) : 0;
}

function setBar(el, d, t) {
  el.style.width = pct(d, t) + '%';
}

function parseEnv() {
  const env = {};
  const lines = envKV.value.split(/\n/);
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    const eq = s.indexOf('=');
    if (eq > 0) {
      const k = s.slice(0, eq).trim();
      const v = s.slice(eq + 1).trim();
      if (k) env[k] = v;
    }
  }
  return env;
}

function renderActiveEnv(env) {
  // Clear existing children without using innerHTML to comply with hygiene rules
  while (envActive.firstChild) {
    envActive.removeChild(envActive.firstChild);
  }
  Object.keys(env).forEach(k => {
    const b = document.createElement('span');
    b.className = 'pill';
    b.textContent = k;
    envActive.appendChild(b);
  });
}

function scrollBottom() {
  if (autoScroll.checked) {
    results.scrollTop = results.scrollHeight;
  }
}

async function downloadURL(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('Download failed: ' + txt);
    }
    const blob = await res.blob();
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = url.substring(url.lastIndexOf('/') + 1);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlObj);
  } catch (e) {
    alert(e.message);
  }
}

function downloadRun(fmt) {
  if (!currentRunId) {
    alert('No run data available yet. Please run the suite first.');
    return;
  }
  const url = '/api/report/download?runId=' + encodeURIComponent(currentRunId) + '&format=' + encodeURIComponent(fmt);
  downloadURL(url);
}