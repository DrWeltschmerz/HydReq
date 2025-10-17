// editor.js - Editor modal functionality

// Layout styles are defined in editor.css (no inline CSS injection here)

// Global variables that need to be accessible
let selIndex = 0;
let testRunCache = new Map();
let modal = null;
let working = { tests: [] };
// Getters for form sub-editors (populated in renderForm)
let suiteVarsGet = null, headersGet = null, queryGet = null, extractGet = null, matrixGet = null;
// Suite/Test hooks getters
let suitePreGet = null, suitePostGet = null, testPreGet = null, testPostGet = null;
// Assertions getters
let assertHeaderGet = null, assertJsonEqGet = null, assertJsonContainsGet = null, assertBodyContainsGet = null;
const LS_VER = 'v1';
const LS_ENC = (s) => { try { return btoa(unescape(encodeURIComponent(s||''))); } catch { return (s||''); } };
const LS_KEY = (p) => `hydreq.${LS_VER}.runCache:` + LS_ENC(p||'');
const RUNREC_KEY = (p) => `hydreq.${LS_VER}.editorRun:` + LS_ENC(p||'');

// Global renderForm function that can be called from renderTests
function renderForm() {
  if (!modal || !working) return;
  const prev = {
    suiteVarsGet, suitePreGet, suitePostGet,
    headersGet, queryGet, extractGet, matrixGet,
    testPreGet, testPostGet,
    assertHeaderGet, assertJsonEqGet, assertJsonContainsGet, assertBodyContainsGet
  };
  const fns = (window.hydreqEditorRenderForm && window.hydreqEditorRenderForm.render)
    ? window.hydreqEditorRenderForm.render(modal, working, selIndex, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} }, prev)
    : prev;
  suiteVarsGet = fns.suiteVarsGet || null;
  suitePreGet = fns.suitePreGet || null;
  suitePostGet = fns.suitePostGet || null;
  headersGet = fns.headersGet || null;
  queryGet = fns.queryGet || null;
  extractGet = fns.extractGet || null;
  matrixGet = fns.matrixGet || null;
  testPreGet = fns.testPreGet || null;
  testPostGet = fns.testPostGet || null;
  assertHeaderGet = fns.assertHeaderGet || null;
  assertJsonEqGet = fns.assertJsonEqGet || null;
  assertJsonContainsGet = fns.assertJsonContainsGet || null;
  assertBodyContainsGet = fns.assertBodyContainsGet || null;
  // Validation wiring after DOM ready
  setTimeout(() => { try { if (window.hydreqEditorValidation?.wire) window.hydreqEditorValidation.wire(modal); } catch {} }, 100);
}

// Function to collect form data into working model
function collectFormData() {
  if (!modal || !working) return;
  const getters = {
    suiteVarsGet, headersGet, queryGet, extractGet, matrixGet,
    suitePreGet, suitePostGet, testPreGet, testPostGet,
    assertHeaderGet, assertJsonEqGet, assertJsonContainsGet, assertBodyContainsGet
  };
  try{ if (window.hydreqEditorCollect && typeof window.hydreqEditorCollect.collect==='function'){ working = window.hydreqEditorCollect.collect(modal, working, selIndex, getters) || working; } }catch{}
}

// validation listener wiring handled in validation.js

// Validation wiring delegated

  // Render the test list in the editor modal
function renderTests() {
  if (!(window.hydreqEditorTestsList && typeof window.hydreqEditorTestsList.render==='function')) return;
  window.hydreqEditorTestsList.render(modal, working.tests || [], selIndex, {
    onSelect(index){ try{ if (typeof window.selectTestByIndex==='function') window.selectTestByIndex(index); }catch{} },
    async onDelete(index){
      const test = (working.tests||[])[index] || {};
      const nm = test.name || ('test '+(index+1));
      if (!confirm('Delete test "'+nm+'"?')) return;
      try{ working.tests.splice(index, 1); }catch{}
      selIndex = Math.max(0, Math.min(selIndex, (working.tests.length-1)));
      renderTests(); if (working.tests.length) renderForm();
      try {
        if (typeof window.__ed_sync === 'function') window.__ed_sync();
        if (typeof window.__ed_writeYamlFromWorking === 'function') {
          await window.__ed_writeYamlFromWorking(true);
        } else if (typeof window.__ed_mirrorYamlFromVisual === 'function') {
          await window.__ed_mirrorYamlFromVisual(true);
        }
      } catch {}
    },
    getResult(index, test){
      try {
        const key = index + ':' + (test && test.name ? test.name : ('test ' + (index + 1)));
        return testRunCache.get(key);
      } catch { return null; }
    }
  });
}

// Global selection helper so click handlers can always find it
function selectTestByIndex(index){
  try{
    if (!Array.isArray(working.tests)) return;
    if (index < 0 || index >= working.tests.length) return;
    selIndex = index;
    renderTests();
    renderForm();
    try{ if (typeof window.__ed_renderQuickRunForSelection==='function') window.__ed_renderQuickRunForSelection(); }catch{}
  }catch(e){}
}
try{ window.selectTestByIndex = selectTestByIndex; }catch(e){}

// Normalize parsed suite data into the working model
// removed: normalizeParsed (moved to editor/normalize.js)

// removed: setVisualEnabled (legacy toggle) — controls are always enabled; rely on validation and dirty state

// Debounce moved to utils if needed; avoid local duplicate

// removed: inline matrix and hooks fallbacks; rely on forms/hooks.js and forms/matrix.js

// Open the editor modal for a given path and data
function openEditor(path, data){
  // Begin initialization (suppresses dirty/UI until baseline is set)
  try{ if (window.hydreqEditorInit && window.hydreqEditorInit.beginInit) window.hydreqEditorInit.beginInit(); else window.__ed_initializing = true; }catch{}
  // Also suppress dirty UI during initialization to avoid a brief blink
  try{ window.__ed_uiSuppressDirty = true; }catch{}
  try {
    if (data && !data.parsed && (data.name || data.Name || Array.isArray(data.tests))) {
      data = { parsed: data };
    }
  } catch (e) {}
  data = data || {};
  
  // Declare working variable early
  working = (data.parsed ? (window.hydreqEditorNormalize && window.hydreqEditorNormalize.normalize ? window.hydreqEditorNormalize.normalize(JSON.parse(JSON.stringify(data.parsed))) : (data.parsed)) : { tests: [] });
  if (!Array.isArray(working.tests)) working.tests = [];
  
  modal = document.getElementById('editorModal');
  if (!modal || (modal && !modal.querySelector('#ed_close'))){
    // Use the modular modal shell
    if (window.hydreqEditorModal && typeof window.hydreqEditorModal.open === 'function') {
      modal = window.hydreqEditorModal.open({ title: 'Editor', create: !!(data && data._new), path });
    } else {
      // Fallback: create an empty container to avoid breaking further logic
      modal = document.createElement('div');
      modal.id = 'editorModal';
      document.body.appendChild(modal);
    }
    // Global modal UX hooks
    modal.addEventListener('wheel', (e)=>{ e.stopPropagation(); }, { passive: true });
    modal.addEventListener('touchmove', (e)=>{ e.stopPropagation(); }, { passive: true });
    modal.addEventListener('click', (e)=>{ if (e.target === modal) attemptClose(); });
  }
  // Ensure dirty indicator is hidden at start and state is clean
  try{
    const di = modal.querySelector('#ed_dirty_indicator');
    if (di){
      if (window.hydreqEditorUtils && window.hydreqEditorUtils.hide) window.hydreqEditorUtils.hide(di);
      else { di.classList.add('hidden'); try{ di.style.display = 'none'; }catch{} }
    }
  }catch{}
  try{ if (window.hydreqEditorState && window.hydreqEditorState.setDirty) window.hydreqEditorState.setDirty(false); }catch{}
  // Initialize editor tables with current modal
  try{ if (window.hydreqEditorTables && window.hydreqEditorTables.init) window.hydreqEditorTables.init(modal); }catch{}
  // Bind add/delete test buttons (ensure after modal exists)
  try {
    const addBtn = modal.querySelector('#ed_add_test');
    const delBtn = modal.querySelector('#ed_del_test');
    if (addBtn) {
      addBtn.onclick = async ()=>{
        const defaultName = `test ${working.tests.length+1}`;
        const name = prompt('Enter test name:', defaultName);
        const finalName = (name && name.trim()) ? name.trim() : defaultName;
        working.tests.push({ name: finalName, request:{ method:'GET', url:'' }, assert:{ status:200 } });
        selIndex = working.tests.length-1; renderTests(); renderForm(); try{ sync(); ensureYamlEditor(); await mirrorYamlFromVisual(true); }catch{} };
    }
    if (delBtn) {
      delBtn.onclick = async ()=>{
        if (working.tests.length===0) return;
        if (!confirm('Delete selected test?')) return;
        working.tests.splice(selIndex,1);
        selIndex = Math.max(0, selIndex-1);
        renderTests();
        if (working.tests.length) renderForm();
        try {
          if (typeof window.__ed_sync === 'function') window.__ed_sync();
          if (typeof window.__ed_writeYamlFromWorking === 'function') {
            await window.__ed_writeYamlFromWorking(true);
          } else if (typeof window.__ed_mirrorYamlFromVisual === 'function') {
            await window.__ed_mirrorYamlFromVisual(true);
          }
        } catch {}
      };
    }
  } catch(e){}
  try{ const pEl = modal.querySelector('#ed_path'); if (pEl) pEl.textContent = path; }catch{}
  const rawEl = modal.querySelector('#ed_raw');
  try {
    const nameFieldEarly = modal.querySelector && modal.querySelector('#ed_suite_name');
    if (data.parsed && nameFieldEarly) {
      const n = (data.parsed && (data.parsed.name || data.parsed.Name)) || '';
      if (n) nameFieldEarly.value = n;
    }
  } catch (e) {}
  const issuesEl = modal.querySelector('#ed_issues');
  const quickRunBox = modal.querySelector('#ed_quickrun');
  const paneVisual = modal.querySelector('#pane_visual');
  const paneYaml = modal.querySelector('#col-yaml .ed-col-content');
  const densityToggle = modal.querySelector('#ed_density');
  const editorRoot = modal.querySelector('.editor-root');
  const splitter = modal.querySelector('#ed_splitter');
  const rightPane = splitter ? splitter.nextElementSibling : null;
  const __hadRaw = !!(data.raw && data.raw.trim() !== '');
  try{
    if (__hadRaw) {
      if (yamlCtl && yamlCtl.setText) yamlCtl.setText(data.raw);
      else if (rawEl) rawEl.value = data.raw;
    } else if (data.parsed) {
      const dumped = (window.hydreqEditorSerialize && window.hydreqEditorSerialize.toYaml)
        ? window.hydreqEditorSerialize.toYaml(data.parsed || {})
        : (jsyaml && jsyaml.dump ? jsyaml.dump(data.parsed || {}, { noRefs: true, quotingType: '"' }) : '');
      if (yamlCtl && yamlCtl.setText) yamlCtl.setText(dumped || '');
      else if (rawEl) rawEl.value = dumped || '';
    } else {
      if (yamlCtl && yamlCtl.setText) yamlCtl.setText(''); else if (rawEl) rawEl.value = '';
    }
  }catch{}
  // YAML control API (delegated)
  const yamlCtl = (window.hydreqEditorYAMLControl && typeof window.hydreqEditorYAMLControl.mount==='function') ? window.hydreqEditorYAMLControl.mount(modal) : null;
  // Fallback: ensure CodeMirror mount if yaml-control is unavailable (test/env safety)
  try{ if (!yamlCtl && window.hydreqEditorYAML && typeof window.hydreqEditorYAML.mount==='function' && rawEl) window.hydreqEditorYAML.mount(rawEl); }catch{}
  try{ if (issuesEl){ while (issuesEl.firstChild) issuesEl.removeChild(issuesEl.firstChild); } }catch{}
  (function attachVisualDelegates(){
    const root = modal.querySelector('#pane_visual');
    if (!root) return;
    const handler = async ()=>{ try { if (window.__ed_initializing) return; sync(); await mirrorYamlFromVisual(); } catch {} };
    root.addEventListener('input', ()=>{ handler(); }, true);
    root.addEventListener('change', ()=>{ handler(); }, true);
    root.addEventListener('click', (e)=>{ const t = e.target; if (!t) return; if ((t.tagName && t.tagName.toLowerCase()==='button') || t.closest('button')) { handler(); } }, true);
  })();
  selIndex = 0;
  const persisted = (function(){ try{ return (localStorage.getItem('hydreq.editor.persistRuns')==='1') ? JSON.parse(localStorage.getItem(LS_KEY(path))||'{}') : {}; }catch{ return {} } })();
  testRunCache = new Map(Object.entries(persisted));
  let lastSuiteRun = null;
  function markDirty(){ try{ yamlCtl && yamlCtl.markDirty ? yamlCtl.markDirty() : null; }catch{} }
  function isDirty(){ try{ return (window.hydreqEditorState && typeof window.hydreqEditorState.isDirty==='function') ? !!window.hydreqEditorState.isDirty() : false; }catch{ return false; } }
  function attemptClose(){
    if (isDirty() && !confirm('Discard unsaved changes?')) return;
    try {
      if (window.hydreqEditorModal && typeof window.hydreqEditorModal.close === 'function') {
        window.hydreqEditorModal.close();
      } else if (modal) {
        modal.remove();
      }
    } finally {
      modal = null;
    }
  }
  async function serializeWorkingToYamlImmediate(){ 
    try{ 
      if (window.hydreqEditorSerialize && window.hydreqEditorSerialize.toYaml) return window.hydreqEditorSerialize.toYaml(working);
      // Fallback to direct dump when serialize module is unavailable (tests)
      if (typeof jsyaml !== 'undefined' && jsyaml && typeof jsyaml.dump === 'function') return jsyaml.dump(working || {}, { noRefs: true, quotingType: '"' });
      return '';
    }catch(e){ return ''; }
  }
  
  async function mirrorYamlFromVisual(force=false){ try{ collectFormData(); yamlCtl && yamlCtl.mirrorFromWorking && yamlCtl.mirrorFromWorking(working, force); }catch(e){ console.error('Failed to mirror YAML from visual:', e); } return true; }

  // Expose key helpers so handlers outside this closure (e.g., renderTests) can use them
  try{ window.__ed_mirrorYamlFromVisual = mirrorYamlFromVisual; }catch(e){}
  try{ window.__ed_ensureYamlEditor = function(){ return yamlCtl && yamlCtl.ensure ? yamlCtl.ensure() : null; }; }catch(e){}
  try{ window.__ed_sync = sync; }catch(e){}

  // Write YAML directly from current working model and mark as dirty
  async function writeYamlFromWorking(force=false){ try{ const yamlText = await serializeWorkingToYamlImmediate(); if (yamlCtl && yamlCtl.setText){ const cur = yamlCtl.getText ? yamlCtl.getText() : ''; if (force || cur !== yamlText) yamlCtl.setText(yamlText); } yamlCtl && yamlCtl.markDirty && yamlCtl.markDirty(); }catch(e){ console.warn('writeYamlFromWorking failed', e); } }
  try{ window.__ed_writeYamlFromWorking = writeYamlFromWorking; }catch(e){}
    
    // Note: variable/header/query/matrix collection happens within collectFormData()
  
  // Alias for collectFormData - used by event handlers
  const sync = collectFormData;
  
  // YAML sync is handled directly via mirrorYamlFromVisual; debounce utility available via editor/utils if needed
  
  // use top-level setVisualEnabled and debounce; duplicates removed
  
  async function validateRawAndApply(){ try{ if (!yamlCtl) return false; const parsed = yamlCtl.parseToWorking ? yamlCtl.parseToWorking() : {}; working = (window.hydreqEditorNormalize && window.hydreqEditorNormalize.normalize) ? window.hydreqEditorNormalize.normalize(parsed) : parsed; return true; }catch(e){ console.error('YAML validation failed:', e); return false; } }
  
  async function switchTab(which){ 
    if (which === 'visual') {
  try{ const parsed = yamlCtl && yamlCtl.parseToWorking ? yamlCtl.parseToWorking() : {}; if (parsed && Object.keys(parsed).length){ working = (window.hydreqEditorNormalize && window.hydreqEditorNormalize.normalize) ? window.hydreqEditorNormalize.normalize(parsed) : parsed; renderForm(); } }catch(e){ console.warn('Failed to parse YAML when switching to visual:', e); }
    } else if (which === 'yaml') {
      try { await mirrorYamlFromVisual(true); } catch (e) { console.warn('Failed to serialize visual to YAML:', e); }
      yamlCtl && yamlCtl.ensure && yamlCtl.ensure();
    }
    try { localStorage.setItem('hydreq.editor.tab', which); } catch {}
  }
  
  // Function to update visual editor from YAML editor
  function updateVisualFromYaml() {
    try {
      const parsed = yamlCtl && yamlCtl.parseToWorking ? yamlCtl.parseToWorking() : {};
      if (parsed && Object.keys(parsed).length) {
        working = (window.hydreqEditorNormalize && window.hydreqEditorNormalize.normalize) ? window.hydreqEditorNormalize.normalize(parsed) : parsed;
        renderForm();
        return true;
      }
    } catch (e) {
      console.error('Failed to update visual from YAML:', e);
    }
    return false;
  }

  // No need for YAML toggle - YAML editor is always visible
  const yamlPane = modal.querySelector('#pane_yaml');
  setTimeout(()=>{
    yamlCtl && yamlCtl.ensure && yamlCtl.ensure();
    try{ syncEditorTheme(); }catch{}
    if (__hadRaw) {
      // If we opened from raw YAML, do not immediately mirror/serialize back to avoid formatting deltas (quotes, spacing) marking dirty
      try { updateVisualFromYaml(); } catch {}
    } else {
      try { if (typeof window.__ed_mirrorYamlFromVisual === 'function') window.__ed_mirrorYamlFromVisual(true); } catch {}
    }
    // Finalize baseline and end initialization
    try{ if (window.hydreqEditorInit && window.hydreqEditorInit.finalizeBaseline) window.hydreqEditorInit.finalizeBaseline(yamlCtl, working, __hadRaw); }catch{}
    try{ if (window.hydreqEditorInit && window.hydreqEditorInit.endInit) window.hydreqEditorInit.endInit(); else window.__ed_initializing = false; }catch{}
    try{ if (window.hydreqEditorInit && window.hydreqEditorInit.afterSettle) window.hydreqEditorInit.afterSettle(yamlCtl); }catch{}
  }, 100);

  // Keep theme synced when document theme changes
  try{ const mo = new MutationObserver(()=>{ try{ syncEditorTheme(); }catch{} }); mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme','class'] }); }catch{}

  // Keep local working model in sync with YAML editor state updates
  try{
    document.addEventListener('hydreq:editor:state:changed', (e)=>{
      try{ const wk = (e && e.detail && e.detail.working) || {}; working = (window.hydreqEditorNormalize && window.hydreqEditorNormalize.normalize) ? window.hydreqEditorNormalize.normalize(wk) : wk; renderForm(); }catch{}
    });
    document.addEventListener('hydreq:editor:dirty:changed', (e)=>{
      try{
        const dty = !!(e && e.detail && e.detail.dirty);
        const di = modal && modal.querySelector && modal.querySelector('#ed_dirty_indicator');
        if (di) {
          if (window.__ed_uiSuppressDirty) return;
          if (window.hydreqEditorUtils && window.hydreqEditorUtils.show && window.hydreqEditorUtils.hide) {
            if (dty) window.hydreqEditorUtils.show(di); else window.hydreqEditorUtils.hide(di);
          } else {
            if (dty) { di.classList.remove('hidden'); try{ di.style.display=''; }catch{} }
            else { di.classList.add('hidden'); try{ di.style.display='none'; }catch{} }
          }
        }
      }catch{}
    });
  }catch{}
  
  // Setup collapse buttons for all columns via module
  try{ if (window.hydreqEditorCollapse && typeof window.hydreqEditorCollapse.setup==='function') window.hydreqEditorCollapse.setup(modal, yamlCtl); }catch{}
  
  const closeBtn = modal.querySelector('#ed_close'); if (closeBtn){ closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); attemptClose(); }); }
  document.addEventListener('keydown', function escClose(ev){ if (!document.getElementById('editorModal')) { document.removeEventListener('keydown', escClose); return; } if (ev.key === 'Escape'){ attemptClose(); } });
  (function(){ /* splitter implementation intentionally omitted */ })();
  try { const pref = localStorage.getItem('hydreq.editor.density') || 'compact'; if (pref === 'comfortable') { densityToggle.checked = true; editorRoot.classList.add('comfortable'); } } catch {}
  if (densityToggle) { densityToggle.addEventListener('change', ()=>{ const comfy = densityToggle.checked; if (comfy) editorRoot.classList.add('comfortable'); else editorRoot.classList.remove('comfortable'); try { localStorage.setItem('hydreq.editor.density', comfy ? 'comfortable' : 'compact'); } catch {} }); }
  
  // Form field changes are handled by forms/* modules and collectFormData
  
  renderTests();
  renderForm();
  yamlCtl && yamlCtl.ensure && yamlCtl.ensure();
  // Seed global editor state working model
  try{ if (window.hydreqEditorState && window.hydreqEditorState.setWorking) window.hydreqEditorState.setWorking(working); }catch{}
  const cacheKey = ()=>{ const t = (working.tests && working.tests[selIndex]) || {}; return selIndex + ':' + (t.name||('test '+(selIndex+1))); };
  function clearQuickRun(){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; while (qr.firstChild) qr.removeChild(qr.firstChild); }
  function appendQuickRunLine(text, cls){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; const d=document.createElement('div'); if (cls) d.className=cls; d.textContent=text; qr.appendChild(d); qr.scrollTop = qr.scrollHeight; }
  // Create run records helper with a dump-enabled local cache adapter
  const __updateLocalCache = (key, val)=>{ try{ testRunCache.set(key, val); }catch{} };
  try{ __updateLocalCache.__dump = ()=> { try{ return Object.fromEntries(testRunCache); }catch{ return {}; } }; }catch{}
  const runRecs = (window.hydreqEditorRunRecords && window.hydreqEditorRunRecords.create)
    ? window.hydreqEditorRunRecords.create(modal, ()=> working, ()=> selIndex, __updateLocalCache)
    : null;
  function setQuickRunBox(result){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; while (qr.firstChild) qr.removeChild(qr.firstChild); if (!result) return; const icon = result.status==='passed'?'✓':(result.status==='failed'?'✗':(result.status==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${result.name||''}`,(result.status==='passed'?'text-success':(result.status==='failed'?'text-error':'text-warning'))); }
  // Quick run rendering proxies
  function renderLatestForSelection(){ try{ if (runRecs && runRecs.renderLatestForSelection) return runRecs.renderLatestForSelection(); }catch{} }
  function renderQuickRunForSelection(){ try{ if (runRecs && runRecs.renderQuickRunForSelection) return runRecs.renderQuickRunForSelection(); }catch{} }
  // Expose for global selector
  try{ window.__ed_renderQuickRunForSelection = renderQuickRunForSelection; }catch(e){}
  // Expose suite results renderer for immediate refresh (e.g., to show running state)
  try{ window.__ed_renderSuiteResults = function(){ try{ if (runRecs && runRecs.renderSuiteResultsFromStore) runRecs.renderSuiteResultsFromStore(); }catch{} }; }catch(e){}
  function updateBadgesFromSuiteResult(res){
    try{
      if (!res) return;
      if (Array.isArray(res.cases)){
        res.cases.forEach(c=>{
          const nm = c.Name || c.name;
          const st = (c.Status || c.status || '').toLowerCase();
          const dur = c.DurationMs || c.durationMs || 0;
          const msgs = c.Messages || c.messages || [];
          const idx = runRecs && runRecs.getTestIndexByName ? runRecs.getTestIndexByName(nm) : -1;
          if (idx>=0 && runRecs && runRecs.updateTestBadgeByIndex) runRecs.updateTestBadgeByIndex(idx, st, msgs, nm);
          // persist per-test record for freshness
          if (runRecs && runRecs.setTestRecord) runRecs.setTestRecord(nm, st, dur, Array.isArray(msgs)? msgs: []);
        });
      } else if (res.name && res.status){
        const idx = runRecs && runRecs.getTestIndexByName ? runRecs.getTestIndexByName(res.name) : -1;
  if (idx>=0 && runRecs && runRecs.updateTestBadgeByIndex) runRecs.updateTestBadgeByIndex(idx, (res.status||'').toLowerCase(), res.messages || [], res.name);
        const st = (res.status||'').toLowerCase();
        if (runRecs && runRecs.setTestRecord) runRecs.setTestRecord(res.name, st, res.durationMs||0, res.messages||[]);
      }
    }catch(e){}
  }
  // Build quick-run UI handlers with local cache and badge helpers
  function makeRunHandlers(){
    const fallbackCache = (name, status, messages)=>{
      try{
        const key = cacheKey();
        testRunCache.set(key, { status, name, messages: messages||[] });
        try{ if (localStorage.getItem('hydreq.editor.persistRuns')==='1') localStorage.setItem(LS_KEY((modal.querySelector('#ed_path')||{}).textContent||''), JSON.stringify(Object.fromEntries(testRunCache))); }catch{}
      }catch{}
    };
    const getPath = ()=>{
      try{ return (modal.querySelector('#ed_path')||{}).textContent||''; }
      catch{ return ''; }
    };
    if (window.hydreqEditorRunUI &&
        typeof window.hydreqEditorRunUI.createHandlers==='function'){
      return window.hydreqEditorRunUI.createHandlers(modal, {
        appendQuickRunLine,
        getTestIndexByName: runRecs && runRecs.getTestIndexByName ? runRecs.getTestIndexByName : null,
        setTestRecord: runRecs && runRecs.setTestRecord ? runRecs.setTestRecord : null,
        updateTestBadgeByIndex: runRecs && runRecs.updateTestBadgeByIndex ? runRecs.updateTestBadgeByIndex : null,
        setSuiteRecord: runRecs && runRecs.setSuiteRecord ? runRecs.setSuiteRecord : null,
        fallbackCache,
        getPath
      });
    }
    return null;
  }
  // renderImmediateRunResult moved to hydreqEditorRun.dispatchImmediate
  function renderIssues(issues, yamlPreview){ try{ if (window.hydreqEditorIssues && typeof window.hydreqEditorIssues.renderIssues==='function') window.hydreqEditorIssues.renderIssues(modal, issues, yamlPreview); }catch{} }
  function parseEnvFromPage(){ try{ return (typeof parseEnv==='function') ? parseEnv() : {}; }catch{ return {}; } }
  let lastValidated = null;
  // Controls context used by hydreqEditorControls
  const getPath = ()=>{
    try{ return (modal.querySelector('#ed_path')||{}).textContent||''; }
    catch{ return ''; }
  };
  const getYamlText = async ()=>{
    try{
      if (yamlCtl && yamlCtl.getText) return yamlCtl.getText();
      if (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
        return window.hydreqEditorYAML.getText();
      return await serializeWorkingToYamlImmediate();
    }catch{ return await serializeWorkingToYamlImmediate(); }
  };
  const afterSaved = (yamlData)=>{
    try{
      try{ window.__ed_yamlSuppressUntil = Date.now() + 300; }catch{}
      if (yamlCtl && yamlCtl.setText) yamlCtl.setText(yamlData||'');
      try{
        if (window.hydreqEditorState && window.hydreqEditorState.setDirty)
          window.hydreqEditorState.setDirty(false);
      }catch{}
      setTimeout(()=>{ try{ yamlCtl && yamlCtl.resetBaseline && yamlCtl.resetBaseline(); }catch{} }, 50);
    }catch{}
  };
  const ctx = {
    getWorking: ()=> working,
    getSelIndex: ()=> selIndex,
    collectFormData,
    appendQuickRunLine,
    clearQuickRun,
    prepareQuickRun: (label, kind)=>{
      try{
        if (window.hydreqEditorRunUI &&
            typeof window.hydreqEditorRunUI.prepare==='function'){
          window.hydreqEditorRunUI.prepare(modal, label, kind);
        }
      }catch{}
    },
    makeRunHandlers,
    renderIssues,
    parseEnvFromPage,
    serializeWorkingToYamlImmediate,
    getYamlText,
    getPath,
    afterSaved,
    isDirty,
    attemptClose
  };
  // Wire buttons via controls module
  try{
    const btnRunTest = modal.querySelector('#ed_run_test');
    const btnValidate = modal.querySelector('#ed_validate');
    const btnRunSuite = modal.querySelector('#ed_run_suite');
    const btnSave = modal.querySelector('#ed_save');
    const btnSaveClose = modal.querySelector('#ed_save_close');
    // Prefer controls module
    if (btnRunTest){
      if (window.hydreqEditorControls?.runTest){ btnRunTest.onclick = ()=> window.hydreqEditorControls.runTest(modal, ctx); }
      else { btnRunTest.onclick = async ()=>{
          try{
            ctx.prepareQuickRun && ctx.prepareQuickRun('test');
            const includeDeps = !!(modal.querySelector('#ed_run_with_deps')?.checked);
            const includePrevStages = !!(modal.querySelector('#ed_run_with_prevstages')?.checked);
            const runId = await (window.hydreqEditorRun?.quickRun?.({ testIndex: selIndex, includeDeps, includePrevStages }) || null);
            if (runId) window.hydreqEditorRun?.listen?.(runId, ctx.makeRunHandlers());
          }catch{}
        }; }
    }
    if (btnValidate){
      if (window.hydreqEditorControls?.validate){ btnValidate.onclick = ()=> window.hydreqEditorControls.validate(modal, ctx); }
      else { btnValidate.onclick = async ()=>{
          try{ const raw = await ctx.getYamlText(); const res = await window.hydreqEditorRun?.validate?.(raw); ctx.renderIssues && ctx.renderIssues(res&&res.issues||[], raw); }catch{}
        }; }
    }
    if (btnRunSuite){
      if (window.hydreqEditorControls?.runSuite){ btnRunSuite.onclick = ()=> window.hydreqEditorControls.runSuite(modal, ctx); }
      else { btnRunSuite.onclick = async ()=>{
          try{
            ctx.prepareQuickRun && ctx.prepareQuickRun('suite');
            const includeDeps = !!(modal.querySelector('#ed_run_with_deps')?.checked);
            const includePrevStages = !!(modal.querySelector('#ed_run_with_prevstages')?.checked);
            const qr = await (window.hydreqEditorRun?.quickRun?.({ runAll:true, includeDeps, includePrevStages }) || null);
            // Back-compat: when quickRun returns a payload, delegate to hydreqRun.start if available
            if (qr && typeof qr === 'object' && window.hydreqRun && typeof window.hydreqRun.start==='function'){
              const rid = await window.hydreqRun.start(qr);
              // hydreqRun.start may call listen() itself; do not force listen here for tests
              return;
            }
            // Otherwise, assume quickRun returned a runId and proceed to listen
            if (qr && typeof qr === 'string') window.hydreqEditorRun?.listen?.(qr, ctx.makeRunHandlers());
          }catch{}
        }; }
    }
    if (btnSave){
      if (window.hydreqEditorControls?.save){ btnSave.onclick = ()=> window.hydreqEditorControls.save(modal, ctx); }
      else { btnSave.onclick = async ()=>{
          try{
            const raw = await ctx.getYamlText();
            const path = ctx.getPath();
            const res = await fetch('/api/editor/save', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ path, raw }) });
            const data = res && res.ok ? (await res.json().catch(()=>({}))) : {};
            ctx.afterSaved && ctx.afterSaved(raw);
            return data;
          }catch(e){ console.error('save failed', e); return null; }
        }; }
    }
    if (btnSaveClose){
      if (window.hydreqEditorControls?.saveClose){ btnSaveClose.onclick = ()=> window.hydreqEditorControls.saveClose(modal, ctx); }
      else { btnSaveClose.onclick = async ()=>{ try{ await (btnSave && btnSave.onclick ? btnSave.onclick() : Promise.resolve()); ctx.attemptClose && ctx.attemptClose(); }catch{} }; }
    }
  }catch{}
  
  // listenToQuickRun moved to hydreqEditorRun.listen
  
  // Validation now delegated via controls (see wiring above)

  // Run suite button
  // Run suite now delegated via controls (see wiring above)

  // Copy Issues button
  const copyIssuesBtn = modal.querySelector('#ed_copy_issues');
  if (copyIssuesBtn){ copyIssuesBtn.onclick = async ()=>{ try{ const el = modal.querySelector('#ed_issues'); const txt = el? el.innerText : ''; await navigator.clipboard.writeText(txt); copyIssuesBtn.textContent='Copied'; setTimeout(()=> copyIssuesBtn.textContent='Copy', 1200); }catch(e){ console.error('Copy failed', e); } }; }
  
  // At top of openEditor() after computing working and modal existence
  const isNewFile = !!(data && data._new);
  try{
    const bannerWrap = modal.querySelector('#ed_new_banner');
    if (isNewFile && !bannerWrap){
      const b = document.createElement('div');
      b.id='ed_new_banner';
      b.className='badge badge-info mr-8';
      b.textContent = 'New suite (will create file at ' + path + ')';
      const headerLeft = modal.querySelector('.ed-header-left');
      if (headerLeft) headerLeft.insertBefore(b, headerLeft.firstChild);
    }
  }catch(e){}
  try{ const saveBtn = modal.querySelector('#ed_save'); const saveCloseBtn = modal.querySelector('#ed_save_close'); if (isNewFile){ if (saveBtn) saveBtn.textContent = 'Create'; if (saveCloseBtn) saveCloseBtn.textContent = 'Create & Close'; modal.dataset.isNew = '1'; } else { modal.dataset.isNew = '0'; } }catch{}

  // Save and Save & Close now delegated via controls (see wiring above)
  
  // Prefer modal close() if available; otherwise fallback
  modal.querySelector('#ed_close').onclick = ()=> attemptClose();
  function syncEditorTheme(){ try{ if (window.hydreqEditorYAML && window.hydreqEditorYAML.syncTheme) window.hydreqEditorYAML.syncTheme(); else if (yamlEditor){ yamlEditor.setOption('theme', isDocDark() ? 'material-darker' : 'default'); yamlEditor.refresh && yamlEditor.refresh(); } }catch{} }
  const lastTab = (function(){ try{ return localStorage.getItem('hydreq.editor.tab') }catch{ return null } })() || 'yaml';
  switchTab(lastTab === 'visual' ? 'visual' : 'yaml');
  if (working.tests && working.tests.length) { try{ renderQuickRunForSelection(); }catch{} }

  // Delegated click on tests container to catch clicks anywhere inside item
  try{
    const testsContainer = modal.querySelector('#ed_tests');
    if (testsContainer && !testsContainer.dataset.bound){
      testsContainer.addEventListener('click', (e)=>{
        const item = e.target && e.target.closest ? e.target.closest('.ed-test-item') : null;
        if (item && item.dataset && item.dataset.index){
          const idx = parseInt(item.dataset.index,10);
          if (!isNaN(idx)) { try{ if (typeof window.selectTestByIndex==='function') window.selectTestByIndex(idx); }catch{} }
        }
      });
      testsContainer.dataset.bound = '1';
    }
  }catch(e){}

  // Pre-seed Quick run cache from runner view if available
  try{
    const summary = (typeof window.getSuiteSummary==='function') ? window.getSuiteSummary(path) : null;
    const lastMap = (typeof window.getSuiteLastStatus==='function') ? window.getSuiteLastStatus(path) : {};
    const badgeStatus = (typeof window.getSuiteBadgeStatus==='function') ? window.getSuiteBadgeStatus(path) : 'unknown';
    if (summary || Object.keys(lastMap).length){
      // Persist per-test records
      Object.keys(lastMap).forEach(nm=>{
        const st = (lastMap[nm]||'').toLowerCase();
        if (!st) return;
        // Try to find details/duration from summary.tests
        let dur = 0; let msgs = [];
        try{ const tc = summary && Array.isArray(summary.tests) ? summary.tests.find(c=> (c.name||c.Name)===nm) : null; if (tc){ dur = tc.durationMs||tc.DurationMs||0; msgs = tc.messages || tc.Messages || []; } }catch{}
        if (runRecs && runRecs.setTestRecord) runRecs.setTestRecord(nm, st, dur, Array.isArray(msgs)?msgs:[]);
        const idx = runRecs && runRecs.getTestIndexByName ? runRecs.getTestIndexByName(nm) : -1;
        if (idx>=0 && runRecs && runRecs.updateTestBadgeByIndex) runRecs.updateTestBadgeByIndex(idx, st, Array.isArray(msgs)?msgs:[]);
      });
      // Suite-level record based on summary or badge
      if (summary && summary.summary){
        const s = summary.summary; const st = ((s.failed||0)>0)?'failed':(((s.passed||0)>0)?'passed':(((s.skipped||0)>0)?'skipped':'unknown'));
        if (runRecs && runRecs.setSuiteRecord) runRecs.setSuiteRecord(st, s.durationMs||0, []);
      } else if (badgeStatus && badgeStatus!=='unknown'){
        if (runRecs && runRecs.setSuiteRecord) runRecs.setSuiteRecord(badgeStatus, 0, []);
      }
      // Refresh Quick run pane for current selection
      try{ renderQuickRunForSelection(); }catch{}
      // Refresh tests list so badges appear immediately
      try{ renderTests(); }catch{}
    }
  }catch(e){}

  // Re-render editor list on test update events from run-records
  try{
    const onUpd = (e)=>{
      try{
        const d = e && e.detail || {};
        const pth = (modal.querySelector('#ed_path')||{}).textContent||'';
        if (!d || d.path !== pth) return;
        // Update local cache so tests list can render a badge immediately
        try{
          const key = (typeof d.idx==='number' ? d.idx : (function(){ const wk=(working||{}).tests||[]; for(let i=0;i<wk.length;i++){ if ((wk[i].name||'')===d.name) return i; } return 0; })()) + ':' + (d.name||'');
          if (testRunCache && typeof testRunCache.set==='function') testRunCache.set(key, { status: d.status, name: d.name, messages: Array.isArray(d.messages)? d.messages: [] });
        }catch{}
        // Re-render tests and quick run to reflect new status/details
        renderTests();
        try{ renderQuickRunForSelection(); }catch{}
      }catch{}
    };
    document.addEventListener('hydreq:editor:test:update', onUpd);
    // Remember to remove on modal close
    const remove = ()=>{ try{ document.removeEventListener('hydreq:editor:test:update', onUpd); }catch{} };
    modal.addEventListener('close', remove);
  }catch{}

  // Note: Removed handlers for non-modal controls (clearLog/download buttons) to avoid referencing missing elements here.
  // Initial population of suites list
  try{ if (typeof window.refresh === 'function') window.refresh(); }catch{}
}

// Expose to window for backward compatibility
window.openEditor = openEditor;