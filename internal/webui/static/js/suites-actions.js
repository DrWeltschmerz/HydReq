// suites-actions.js — Extracted user actions from suites.js for modularity
// Depends on: utils.js (slugify), editor.js (openEditor) at call time, not load time.

(function(){
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

  // Prompt user to create a new suite
  async function promptNewSuite() {
    const name = prompt('Enter suite name (e.g. My API tests):');
    if (!name) return;
    const slug = (typeof slugify==='function') ? slugify(name) : name.toLowerCase().replace(/\s+/g,'-');
    const path = 'testdata/' + slug + '.hrq.yaml';
    // quick client-side validation
    if (!path.startsWith('testdata/') || !path.endsWith('.hrq.yaml')) {
      alert('Invalid path generated. Please choose a different name.');
      return;
    }

    // Server-side safety/existence check
    let exists = false;
    try {
      const resp = await fetch('/api/editor/checkpath', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path }) });
      if (resp.ok) {
        const info = await resp.json();
        if (!info.safe) { alert('Proposed path is not allowed by server policy'); return; }
        exists = !!info.exists;
      } else {
        // Fallback: probe GET editor/suite
        try { const r = await fetch('/api/editor/suite?path=' + encodeURIComponent(path)); exists = r.ok; } catch(e){}
      }
    } catch(e){
      // Network issues: probe gentle GET
      try { const r = await fetch('/api/editor/suite?path=' + encodeURIComponent(path)); exists = r.ok; }catch(e){}
    }

    if (exists){
      if (!confirm('A suite already exists at ' + path + '. Overwrite?')) return;
    }

    const parsed = {
      name: name,
      baseUrl: "",
      vars: {},
      tests: [ { name: "example test", request: { method: "GET", url: "/" }, assert: { status: 200 } } ]
    };

    try { if (typeof openEditor==='function') openEditor(path, { parsed, _new: !exists, exists }); }
    catch (e) { console.error('openEditor failed', e); alert('Failed to open editor: ' + (e && e.message ? e.message : e)); }
  }

  // Import collection from external format
  async function importCollection(){
    const format = (document.getElementById('importFormat')||{}).value;
    const fileInput = document.getElementById('importFile');
    const statusEl = document.getElementById('importStatus');

    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      if (statusEl) statusEl.textContent = 'Please select a file';
      return;
    }

    const file = fileInput.files[0];
    if (statusEl) statusEl.textContent = 'Importing...';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format||'');

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      if (!res.ok) {
        const error = await res.text().catch(()=>res.statusText);
        if (statusEl) statusEl.textContent = 'Import failed: ' + error;
        return;
      }

      const yaml = await res.text();
      const blob = new Blob([yaml], { type: 'application/x-yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'imported-suite.hrq.yaml'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      if (statusEl) statusEl.textContent = 'Import successful! Downloaded as imported-suite.hrq.yaml';
      fileInput.value = '';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Import failed: ' + (e && e.message ? e.message : String(e));
    }
  }

  // Expose to window
  window.expandAll = expandAll;
  window.collapseAll = collapseAll;
  window.promptNewSuite = promptNewSuite;
  window.importCollection = importCollection;
})();
