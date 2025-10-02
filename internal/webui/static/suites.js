// Suite management functions
let selected;
let batch = { done: 0, total: 0 };
let suite = { done: 0, total: 0 };
const testRows = new Map(); // Name -> {container, line}
const agg = { passed: 0, failed: 0, skipped: 0, total: 0, suites: 0, durationMs: 0 };
let currentSuitePath = null; // canonical path/key for suite currently running
const pendingTestEvents = new Map(); // path -> [events]
let currentRunId = null;
let lastRunId = null; // retain last run id for downloads after completion

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

function renderSuites(list) {
  suitesEl.innerHTML = '';
  console.log('renderSuites: rendering', list.length, 'items');
  // Debug: if list is empty, surface a visible banner for E2E to catch
  try {
    if ((!list || list.length === 0) && typeof window !== 'undefined') {
      // avoid duplicating banner
      if (!document.getElementById('hydreq-debug-banner')) {
        const banner = document.createElement('div');
        banner.id = 'hydreq-debug-banner';
        banner.style.padding = '12px';
        banner.style.background = 'rgba(255,0,0,0.06)';
        banner.style.border = '1px solid rgba(255,0,0,0.12)';
        banner.style.margin = '8px';
        banner.style.borderRadius = '6px';
        banner.textContent = 'HYDREQ-DBG: No suites returned from /api/editor/suites';
        const aside = document.querySelector('aside');
        if (aside) aside.insertBefore(banner, aside.firstChild);
      }
    } else {
      const b = document.getElementById('hydreq-debug-banner');
      if (b && b.parentNode) b.parentNode.removeChild(b);
    }
  } catch (e) {}
  list.forEach(item => {
    // new server shape: { path: string, name?: string }
    const path = (typeof item === 'string') ? item : (item.path || item.Path || item.file || JSON.stringify(item));
    const pathKey = path; // canonical string key for selection and fetches
    const base = (typeof path === 'string' ? path.split('/').pop() : String(path));
    const friendly = (item && item.name) ? item.name : null;
    // (no-op removed) keep DOM operations explicit so per-button handlers always read their own data attributes
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.gap = '8px';
    li.dataset.path = pathKey;
    // Title + filename layout (name column is taller so long names wrap)
    const name = document.createElement('span');
    name.style.flex = '1';
    name.style.display = 'flex';
    name.style.flexDirection = 'column';
    name.style.alignItems = 'flex-start';
    name.style.gap = '2px';
    const titleRow = document.createElement('div');
    titleRow.style.display = 'flex';
    titleRow.style.flexDirection = 'row';
    titleRow.style.alignItems = 'baseline';
    titleRow.style.gap = '8px';
    // Expand/collapse button to show suite tests (display-only)
    const expandBtn = document.createElement('button');
    expandBtn.className = 'btn btn-ghost btn-xs';
    expandBtn.textContent = '▸';
    expandBtn.title = 'Show tests';
    expandBtn.style.width = '28px';
    expandBtn.setAttribute('aria-expanded', 'false');
    expandBtn.setAttribute('aria-label', 'Toggle tests');
    expandBtn.tabIndex = 0;
    expandBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        expandBtn.click();
      }
    });
    // Provide a promise-based expand helper per-list-item so programmatic callers can await load completion
    expandBtn._expandPromise = null;
    expandBtn._resolveExpand = null;
    expandBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      const open = expandBtn.dataset.open === '1';
      if (open) {
        expandBtn.dataset.open = '0';
        expandBtn.textContent = '▸';
        expandBtn.setAttribute('aria-expanded', 'false');
        testsDiv.classList.remove('open');
        testsDiv.style.display = 'none';
        return;
      }
      // open path
      expandBtn.dataset.open = '1';
      expandBtn.textContent = '▾';
      expandBtn.setAttribute('aria-expanded', 'true');
      // show inline spinner while loading
      let spinner = null;
      if (!expandBtn.dataset.loaded) {
        spinner = document.createElement('span');
        spinner.className = 'spinner';
        expandBtn.insertBefore(spinner, expandBtn.firstChild);
      }
      // create a promise so callers can await when tests are ready
      if (!expandBtn._expandPromise) {
        expandBtn._expandPromise = new Promise((res) => {
          expandBtn._resolveExpand = res;
        });
      }
      if (!expandBtn.dataset.loaded) {
        try {
          const p = encodeURIComponent(pathKey);
          const res = await fetch('/api/editor/suite?path=' + p);
          if (res.ok) {
            const dd = await res.json();
            const parsed = dd.parsed || dd;
            const tests = (parsed && parsed.tests) ? parsed.tests : [];
            testsDiv.innerHTML = '';
            tests.forEach(t => {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.justifyContent = 'space-between';
              row.style.padding = '4px 6px';
              const nm = document.createElement('span');
              nm.textContent = t.name || t.Name || '(unnamed)';
              nm.title = nm.textContent;
              const badge = document.createElement('span');
              badge.className = 'pill';
              const tr = testRows.get(nm.textContent);
              if (tr && tr.line) {
                const cls = tr.line.className || '';
                if (cls.indexOf('ok') >= 0) {
                  badge.textContent = '✓';
                  badge.style.background = 'rgba(16,185,129,0.12)';
                } else if (cls.indexOf('fail') >= 0) {
                  badge.textContent = '✗';
                  badge.style.background = 'rgba(239,68,68,0.08)';
                } else if (cls.indexOf('skip') >= 0) {
                  badge.textContent = '-';
                  badge.style.background = 'rgba(245,158,11,0.06)';
                } else {
                  badge.textContent = '·';
                  badge.style.opacity = '.6';
                }
              } else {
                badge.textContent = '·';
                badge.style.opacity = '.6';
              }
              row.appendChild(nm);
              row.appendChild(badge);
              testsDiv.appendChild(row);
            });
            expandBtn.dataset.loaded = '1';
            try {
              flushPendingForPath(pathKey);
            } catch (e) {}
          }
        } catch (err) {
          testsDiv.innerHTML = '<div class="dim">Failed to load tests</div>';
        }
      }
      // remove spinner if present
      try {
        if (spinner && spinner.parentNode) spinner.remove();
      } catch {}
      // set an id for aria-controls (slug from pathKey)
      try {
        const id = 'tests-' + slugify(pathKey);
        testsDiv.id = id;
        expandBtn.setAttribute('aria-controls', id);
      } catch {}
      testsDiv.classList.add('open');
      testsDiv.style.display = 'block';
      // resolve any pending promise so programmatic expansion knows we're ready
      try {
        if (expandBtn._resolveExpand) {
          expandBtn._resolveExpand();
          expandBtn._expandPromise = null;
          expandBtn._resolveExpand = null;
        }
      } catch (e) {}
    });
    const titleSpan = document.createElement('span');
    titleSpan.className = 'spec-title';
    titleSpan.style.fontWeight = '600';
    titleSpan.style.fontSize = '14px';
    titleSpan.textContent = friendly && (typeof friendly === 'string') && friendly.trim() !== '' ? friendly : base;
    // suite-level status badge (updated live)
    const suiteBadge = document.createElement('span');
    suiteBadge.className = 'pill suite-badge';
    suiteBadge.textContent = '·';
    suiteBadge.style.opacity = '.6';
    suiteBadge.title = 'suite status';
    suiteBadge.dataset.status = 'unknown';
    const fileSpan = document.createElement('span');
    fileSpan.textContent = base;
    fileSpan.style.opacity = 0.6;
    fileSpan.style.fontSize = '12px';
    fileSpan.className = 'spec-file';
    titleRow.appendChild(expandBtn);
    titleRow.appendChild(titleSpan);
    titleRow.appendChild(suiteBadge);
    titleRow.appendChild(fileSpan);
    name.appendChild(titleRow);
    // Hidden container for test list; toggled by expandBtn
    const testsDiv = document.createElement('div');
    testsDiv.className = 'suite-tests';
    testsDiv.style.display = 'none';
    testsDiv.style.marginTop = '6px';
    testsDiv.style.paddingLeft = '6px';
    testsDiv.style.borderLeft = '2px solid rgba(0,0,0,0.04)';
    name.appendChild(testsDiv);
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.title = 'Open editor';
    editBtn.dataset.path = pathKey;
    editBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const pth = btn && btn.getAttribute && btn.getAttribute('data-path');
      console.log('editBtn clicked, data-path=', pth);
      if (!pth) {
        console.error('Edit handler: missing data-path on clicked element');
        return;
      }
      const res = await fetch('/api/editor/suite?path=' + encodeURIComponent(pth));
      if (!res.ok) {
        alert('Failed to load suite');
        return;
      }
      const data = await res.json();
      try {
        openEditor(pth, data);
      } catch (err) {
        console.error('openEditor failed', err);
        alert('Failed to open editor: ' + (err && err.message ? err.message : err));
      }
    });
    // Compact download dropdown
    const dlWrap = document.createElement('span');
    dlWrap.style.position = 'relative';
    dlWrap.style.display = 'inline-block';
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn-ghost btn-xs';
    dlBtn.textContent = '▾';
    dlBtn.title = 'Download';
    dlBtn.dataset.path = pathKey;
    const dlMenu = document.createElement('div');
    dlMenu.style.position = 'absolute';
    dlMenu.style.right = '0';
    dlMenu.style.top = '28px';
    dlMenu.style.minWidth = '140px';
    dlMenu.style.border = '1px solid var(--bd)';
    dlMenu.style.background = 'var(--bg)';
    dlMenu.style.padding = '6px';
    dlMenu.style.borderRadius = '6px';
    dlMenu.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)';
    dlMenu.style.display = 'none';
    dlMenu.style.zIndex = '10';
    const addDl = (label, fmt) => {
      const b = document.createElement('div');
      b.textContent = label;
      b.style.padding = '6px';
      b.style.cursor = 'pointer';
      b.style.borderRadius = '4px';
      b.onclick = (e) => {
        e.stopPropagation();
        const p = dlBtn.getAttribute && dlBtn.getAttribute('data-path');
        if (!p) {
          console.error('download: missing data-path');
          return;
        }
        downloadSuite(p, fmt);
        dlMenu.style.display = 'none';
      };
      b.onmouseenter = () => b.style.background = 'var(--li-hov)';
      b.onmouseleave = () => b.style.background = 'transparent';
      dlMenu.appendChild(b);
    };
    addDl('Download JSON', 'json');
    addDl('Download JUnit', 'junit');
    addDl('Download HTML', 'html');
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dlMenu.style.display = (dlMenu.style.display === 'none') ? 'block' : 'none';
    });
    document.addEventListener('click', () => {
      try {
        dlMenu.style.display = 'none';
      } catch {}
    });
    dlWrap.appendChild(dlBtn);
    dlWrap.appendChild(dlMenu);
    li.appendChild(name);
    li.appendChild(dlWrap);
    li.appendChild(editBtn);
    // add a bit of vertical whitespace for readability
    li.style.marginBottom = '6px';
    if (selected.has(pathKey)) li.classList.add('selected');
    li.onclick = () => {
      if (selected.has(pathKey)) selected.delete(pathKey);
      else selected.add(pathKey);
      localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected)));
      selCount.textContent = selected.size + ' selected';
      renderSuites(list);
    };
    suitesEl.appendChild(li);
  });
  selCount.textContent = selected.size + ' selected';
}

// Expand/Collapse all helpers
async function expandAll() {
  const lis = Array.from(document.querySelectorAll('#suites li'));
  for (const li of lis) {
    try {
      const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
      if (!btn) continue;
      if (btn.dataset.open === '1') continue; // already open
      btn.click();
      // await per-button promise if provided
      if (btn._expandPromise && typeof btn._expandPromise.then === 'function') {
        try {
          await btn._expandPromise;
        } catch (e) {}
      }
    } catch (e) {}
  }
}

function collapseAll() {
  const lis = Array.from(document.querySelectorAll('#suites li'));
  for (const li of lis) {
    try {
      const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
      if (!btn) continue;
      if (btn.dataset.open === '1') btn.click();
    } catch (e) {}
  }
}

async function refresh() {
  console.log('refresh: fetching /api/editor/suites');
  try {
    const res = await fetch('/api/editor/suites');
    console.log('refresh: fetch complete, status=', res && res.status);
    try {
      window.__HYDREQ_REFRESH = window.__HYDREQ_REFRESH || {};
      window.__HYDREQ_REFRESH.status = res && res.status;
    } catch {}
    let list = [];
    try {
      list = await res.json();
    } catch (e) {
      console.error('refresh: failed parsing JSON', e);
    }
    console.log('refresh: got list (len=', (Array.isArray(list) ? list.length : 0), ')');
    try {
      window.__HYDREQ_REFRESH.list = list;
      window.__HYDREQ_REFRESH.len = Array.isArray(list) ? list.length : 0;
    } catch {}
    try {
      renderSuites(list || []);
    } catch (e) {
      console.error('refresh: renderSuites threw', e);
      try {
        window.__HYDREQ_REFRESH.err = String(e);
      } catch {}
    }
    try {
      if (results) {
        const d = document.createElement('div');
        d.textContent = 'DEBUG: refresh list len=' + (Array.isArray(list) ? list.length : 0);
        results.appendChild(d);
      }
    } catch (e) {}
  } catch (err) {
    console.error('refresh: fetch failed', err);
  }
}

async function run() {
  console.log('run called');
  let suites = Array.from(selected);
  if (suites.length === 0) {
    // If user hasn't selected any suites, default to all discovered suites
    // Use the editor suites endpoint which may return objects {path,name}
    const resAll = await fetch('/api/editor/suites');
    if (!resAll.ok) {
      alert('No suites selected and failed to load suites');
      return;
    }
    const alllist = await resAll.json();
    // normalize to string paths
    suites = alllist.map(i => (typeof i === 'string') ? i : (i.path || i.Path || JSON.stringify(i)));
  }
  const env = parseEnv();
  renderActiveEnv(env);
  const tags = (tagsEl && tagsEl.value) ? tagsEl.value.split(',').map(s => s.trim()).filter(Boolean) : [];
  console.log('tags:', tags);
  const defaultTimeoutMs = (defToEl && defToEl.value) ? (parseInt(defToEl.value, 10) || 0) : 0;
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
  if (!res.ok) {
    let txt = '';
    try {
      txt = await res.text();
    } catch {}
    alert('Run failed: ' + res.status + (txt ? (' - ' + txt) : ''));
    return;
  }
  const { runId } = await res.json();
  currentRunId = runId;
  listen(runId);
}

// E2E helper: start a run programmatically from tests and ensure the page subscribes
try {
  window.__E2E_startRun = async function (suites, workers) {
    try {
      const payload = { suites: suites || [], workers: workers || 1 };
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('run failed');
      const j = await res.json();
      const runId = j.runId;
      try {
        currentRunId = runId;
        listen(runId);
      } catch (e) {}
      return runId;
    } catch (e) {
      return null;
    }
  };
} catch (e) {}

async function importCollection() {
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
    // Create a download link for the YAML
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

function listen(id) {
  batch = { done: 0, total: 0 };
  suite = { done: 0, total: 0 };
  try {
    window.__E2E_LISTENED = id;
  } catch (e) {}
  results.textContent = '';
  stages.innerHTML = '';
  testRows.clear();
  agg.passed = agg.failed = agg.skipped = agg.total = agg.suites = agg.durationMs = 0;
  setBar(batchBar, 0, 1);
  setBar(suiteBar, 0, 1);
  batchText.textContent = '0/0';
  suiteText.textContent = '0/0';
  const es = new EventSource('/api/stream?runId=' + encodeURIComponent(id));
  try {
    es.onopen = function () {
      try {
        window.__E2E_ES_OPEN = true;
      } catch (e) {}
    };
  } catch (e) {}
  es.onmessage = async (e) => {
    const ev = JSON.parse(e.data);
    const type = ev.type;
    const payload = ev.payload || {};
    // Helper to programmatically expand a suite entry by path or name
    async function expandSuiteByPath(target) {
      try {
        const list = document.querySelectorAll('#suites li');
        for (const li of list) {
          try {
            const btnEl = li.querySelector('button[aria-controls]');
            const pathKey = li.getAttribute('data-path') || (btnEl && btnEl.getAttribute && btnEl.getAttribute('data-path')) || null;
            if (!pathKey) continue;
            if (pathKey === target || li.querySelector('.spec-title')?.textContent === target) {
              const btn = btnEl || li.querySelector('button'); // expand button
              const testsDiv = li.querySelector('.suite-tests');
              if (!testsDiv) return;
              if (btn && btn.dataset.open !== '1') {
                // programmatic click to open; if the button provides an expand promise, await it
                try {
                  btn.click();
                  if (btn._expandPromise && typeof btn._expandPromise.then === 'function') {
                    await btn._expandPromise;
                  }
                  // ensure pending events flush
                  try {
                    flushPendingForPath(pathKey);
                  } catch (e) {}
                } catch (e) {}
              }
              return; // done
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    function flushPendingForPath(path) {
      try {
        const evs = pendingTestEvents.get(path);
        if (!evs || !evs.length) return;
        const li = document.querySelector('#suites li[data-path="' + path + '"]');
        if (!li) {
          pendingTestEvents.delete(path);
          return;
        }
        const testsDiv = li.querySelector('.suite-tests');
        if (!testsDiv) {
          pendingTestEvents.delete(path);
          return;
        }
        // apply queued events
        evs.forEach(ev => {
          try {
            const { Name, Status, DurationMs, Messages } = ev;
            Array.from(testsDiv.children).forEach(r => {
              try {
                const nm = r.children[0];
                const badge = r.children[1];
                if (!nm || !badge) return;
                if (nm.textContent === Name) {
                  if (Status === 'passed') {
                    badge.textContent = '✓';
                    badge.style.background = 'rgba(16,185,129,0.12)';
                    badge.style.opacity = '1';
                  } else if (Status === 'failed') {
                    badge.textContent = '✗';
                    badge.style.background = 'rgba(239,68,68,0.08)';
                    badge.style.opacity = '1';
                  } else if (Status === 'skipped') {
                    badge.textContent = '-';
                    badge.style.background = 'rgba(245,158,11,0.06)';
                    badge.style.opacity = '1';
                  }
                }
              } catch (e) {}
            });
          } catch (e) {}
        });
        pendingTestEvents.delete(path);
      } catch (e) {}
    }
    if (type === 'testStart') {
      const { Name } = payload;
      const wrap = document.createElement('div');
      const line = document.createElement('div');
      line.className = 'run';
      line.textContent = '… ' + Name;
      wrap.appendChild(line);
      results.appendChild(wrap);
      try {
        window.__E2E_TESTSTART = true;
      } catch (e) {}
      testRows.set(Name, { container: wrap, line });
      scrollBottom();
    }
    if (type === 'batchStart') {
      batch.total = payload.total;
      batch.done = 0;
      setBar(batchBar, 0, batch.total);
      batchText.textContent = '0/' + batch.total;
    }
    if (type === 'suiteStart') {
      suite.total = payload.total;
      suite.done = 0;
      setBar(suiteBar, 0, suite.total);
      suiteText.textContent = '0/' + suite.total;
      stages.innerHTML = '';
      currentSuiteEl.textContent = (payload.name || payload.path || '');
      // record canonical path so we can update suite badges and auto-expand
      currentSuitePath = payload.path || payload.name || null;
      // log start of suite
      const nm = (payload.name || payload.path || '');
      const ln = document.createElement('div');
      ln.textContent = `=== running: ${nm} ===`;
      results.appendChild(ln);
      scrollBottom();
      const stageMap = payload.stages || {};
      for (const k in stageMap) {
        const d = document.createElement('div');
        d.className = 'row';
        d.innerHTML = '<div class="w-120px">stage ' + k + '</div><div class="progress flex-1"><div id="stage_' + k + '" style="width:0%"></div></div><div class="pill" id="stage_txt_' + k + '">0/' + stageMap[k] + '</div>';
        stages.appendChild(d);
      }
      // Auto-expand this suite in the left list to show live status and wait for tests to load
      try {
        const target = payload.path || payload.name || '';
        if (target) {
          try {
            await expandSuiteByPath(target);
          } catch (e) {}
        }
      } catch (e) {}
    }
    if (type === 'test') {
      const { Name, Status, DurationMs, Stage, Messages, Tags } = payload;
      agg.total++;
      if (Status === 'passed') agg.passed++;
      else if (Status === 'failed') agg.failed++;
      else if (Status === 'skipped') agg.skipped++;
      let row = testRows.get(Name);
      if (!row) {
        const wrap = document.createElement('div');
        const line = document.createElement('div');
        wrap.appendChild(line);
        results.appendChild(wrap);
        row = { container: wrap, line };
        testRows.set(Name, row);
      }
      row.line.className = (Status === 'passed' ? 'ok' : (Status === 'failed' ? 'fail' : 'skip'));
      if (Status === 'skipped') {
        row.line.textContent = `- ${Name} (tags)`;
      } else {
        row.line.textContent = (Status === 'passed' ? '✓' : (Status === 'failed' ? '✗' : '-')) + ' ' + Name + ' (' + DurationMs + ' ms)';
        if (Status === 'failed' && Array.isArray(Messages) && Messages.length) {
          let det = row.container.querySelector('details');
          if (!det) {
            det = document.createElement('details');
            const sum = document.createElement('summary');
            sum.textContent = 'details';
            det.appendChild(sum);
            row.container.appendChild(det);
          }
          let pre = det.querySelector('pre');
          if (!pre) {
            pre = document.createElement('pre');
            pre.className = 'fail';
            det.appendChild(pre);
          }
          pre.textContent = Messages.join('\n');
        }
      }
      // progress and stages after rendering
      suite.done++;
      setBar(suiteBar, suite.done, suite.total);
      suiteText.textContent = suite.done + '/' + suite.total;
      const st = document.getElementById('stage_' + Stage);
      const stt = document.getElementById('stage_txt_' + Stage);
      if (st && stt) {
        const txt = stt.textContent.split('/');
        const done = (parseInt(txt[0], 10) || 0) + 1;
        const total = parseInt(txt[1], 10) || 0;
        st.style.width = pct(done, total) + '%';
        stt.textContent = done + '/' + total;
      }
      // Update any expanded suite test badges if we are on the runner view (editor modal not open)
      try {
        // if modal present, skip updating expanded suite badges — per requirement only update in runner view
        if (!document.getElementById('editorModal')) {
          // Update suite-level badges and expanded test badges.
          // If currentSuitePath is set, prefer updating that li; otherwise attempt to match any li containing this test name.
          try {
            const updateBadgeForLi = (li) => {
              if (!li) return;
              try {
                const sBadge = li.querySelector('.suite-badge');
                // if a failure occurs, mark suite badge failed
                if (Status === 'failed') {
                  if (sBadge) {
                    sBadge.textContent = '✗';
                    sBadge.style.background = 'rgba(239,68,68,0.08)';
                    sBadge.style.opacity = '1';
                    sBadge.dataset.status = 'failed';
                  }
                } else if (Status === 'passed') {
                  if (sBadge && sBadge.textContent !== '✗') {
                    sBadge.textContent = '✓';
                    sBadge.style.background = 'rgba(16,185,129,0.12)';
                    sBadge.style.opacity = '1';
                    sBadge.dataset.status = 'passed';
                  }
                } else if (Status === 'skipped') {
                  if (sBadge && sBadge.textContent !== '✗') {
                    sBadge.textContent = '-';
                    sBadge.style.background = 'rgba(245,158,11,0.06)';
                    sBadge.style.opacity = '1';
                    sBadge.dataset.status = 'skipped';
                  }
                }
                // update inside expanded testsDiv rows if present
                const testsDiv = li.querySelector('.suite-tests');
                if (testsDiv) {
                  // If testsDiv hasn't been populated yet (not loaded), queue the event for later
                  const expandBtnLocal = li.querySelector('button[aria-controls]');
                  const loaded = expandBtnLocal && expandBtnLocal.dataset && expandBtnLocal.dataset.loaded === '1';
                  if (!loaded) { // queue
                    try {
                      const p = li.getAttribute('data-path') || (li.querySelector('.spec-title') && li.querySelector('.spec-title').textContent) || '';
                      if (p) {
                        const arr = pendingTestEvents.get(p) || [];
                        arr.push({ Name, Status, DurationMs, Messages });
                        pendingTestEvents.set(p, arr);
                      }
                    } catch (e) {}
                  } else {
                    Array.from(testsDiv.children).forEach(r => {
                      try {
                        const nmEl = r.children[0], badgeEl = r.children[1];
                        if (!nmEl || !badgeEl) return;
                        if (nmEl.textContent === Name) {
                          if (Status === 'passed') {
                            badgeEl.textContent = '✓';
                            badgeEl.style.background = 'rgba(16,185,129,0.12)';
                            badgeEl.style.opacity = '1';
                          } else if (Status === 'failed') {
                            badgeEl.textContent = '✗';
                            badgeEl.style.background = 'rgba(239,68,68,0.08)';
                            badgeEl.style.opacity = '1';
                          } else if (Status === 'skipped') {
                            badgeEl.textContent = '-';
                            badgeEl.style.background = 'rgba(245,158,11,0.06)';
                            badgeEl.style.opacity = '1';
                          }
                        }
                      } catch (e) {}
                    });
                    // Restore badge fallback for missing test rows
                    // If not found, ensure badge is set to default
                    const found = Array.from(testsDiv.children).some(r => r.children && r.children[0] && r.children[0].textContent === Name);
                    if (!found && sBadge) {
                      sBadge.textContent = '·';
                      sBadge.style.opacity = '.6';
                      sBadge.style.background = '';
                      sBadge.dataset.status = 'unknown';
                    }
                  }
                }
                // End of listen()
              } catch (e) {}
            };
            // Update current suite first
            if (currentSuitePath) {
              const li = document.querySelector('#suites li[data-path="' + currentSuitePath + '"]');
              if (li) updateBadgeForLi(li);
            }
            // Update any other lists that might contain the test name (if not found above)
            document.querySelectorAll('#suites li').forEach(li => {
              try { // skip if already current suite
                if (li.getAttribute('data-path') === currentSuitePath) return; // check testsDiv content
                const testsDiv = li.querySelector('.suite-tests');
                if (!testsDiv) return;
                const found = Array.from(testsDiv.children).some(r => r.children && r.children[0] && r.children[0].textContent === Name);
                if (found) {
                  updateBadgeForLi(li);
                } else {
                  const sBadge = li.querySelector('.suite-badge');
                  if (sBadge) {
                    sBadge.textContent = '·';
                    sBadge.style.opacity = '.6';
                    sBadge.style.background = '';
                    sBadge.dataset.status = 'unknown';
                  }
                }
              } catch (e) {}
            });
          } catch (e) {}
        }
      } catch (e) {}
    }
    if (type === 'suiteEnd') {
      batch.done++;
      setBar(batchBar, batch.done, batch.total);
      batchText.textContent = batch.done + '/' + batch.total;
      const name = payload.name || payload.path || '';
      const s = payload.summary || {};
      const line = `=== ${name} — ${s.passed || 0} passed, ${s.failed || 0} failed, ${s.skipped || 0} skipped, total ${s.total || 0} in ${s.durationMs || 0} ms`;
      const div = document.createElement('div');
      div.textContent = line;
      results.appendChild(div);
      agg.suites++;
      agg.durationMs += (s.durationMs || 0);
      // Update suite badge based on final summary
      try {
        const li = document.querySelector('#suites li[data-path="' + (payload.path || payload.name || '') + '"]');
        if (li) {
          const sb = li.querySelector('.suite-badge');
          if (sb) {
            if ((s.failed || 0) > 0) {
              sb.textContent = '✗';
              sb.style.background = 'rgba(239,68,68,0.08)';
              sb.style.opacity = '1';
              sb.dataset.status = 'failed';
            } else {
              sb.textContent = '✓';
              sb.style.background = 'rgba(16,185,129,0.12)';
              sb.style.opacity = '1';
              sb.dataset.status = 'passed';
            }
            sb.classList.add('animate');
            setTimeout(() => sb.classList.remove('animate'), 220);
          }
        }
      } catch (e) {}
      scrollBottom();
    }
    if (type === 'batchEnd') {
      const div = document.createElement('div');
      div.textContent = `=== Batch summary — ${agg.passed} passed, ${agg.failed} failed, ${agg.skipped} skipped, total ${agg.total} in ${agg.durationMs} ms (suites ${agg.suites}/${batch.total}) ===`;
      results.appendChild(div);
      scrollBottom();
    }
    if (type === 'error') {
      const d = document.createElement('div');
      d.className = 'fail';
      d.textContent = 'Error: ' + (payload.error || '');
      results.appendChild(d);
    }
    if (type === 'done') {
      es.close();
      lastRunId = id;
      currentRunId = null;
    }
  };
}