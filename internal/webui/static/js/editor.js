// editor.js - Editor modal functionality

// Add dynamic styles for 4-column layout
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .ed-main { display: flex; flex-direction: row; height: calc(100vh - 60px); overflow: hidden; }
    .ed-col { display: flex; flex-direction: column; border-right: 1px solid var(--bd); box-sizing: border-box; min-width: 240px; max-width: none; transition: width 0.2s ease, flex-basis 0.2s ease; overflow: hidden; }
    .ed-col.collapsed { flex: 0 0 40px !important; min-width: 40px; max-width: 40px; }
    .ed-col-content { display: flex; flex-direction: column; flex: 1; overflow: auto; box-sizing: border-box; }
    .ed-col-header { display: flex; align-items: center; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--bd); background-color: var(--surface); box-sizing: border-box; }
    .ed-col.collapsed .ed-col-header { flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-bottom: none; height: 100%; padding: 6px 4px; cursor: default; }
    .ed-col.collapsed .ed-col-header .btn { padding: 2px 4px; }
    .ed-col.collapsed .ed-col-header .fw-600 { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); text-align: center; }
    .ed-col.collapsed .ed-col-header .ed-row-6 > :not(.ed-collapse-btn) { display: none; }
    .ed-col.collapsed .ed-col-header .ed-row-6 .ed-collapse-btn { display: inline-flex; }
    .ed-col.collapsed .ed-col-content { display: none; }
    /* Column sizing: tests fixed; others flex to fill remaining space */
    #col-tests { flex: 0 0 280px; min-width: 240px; }
    #col-visual { flex: 2 1 500px; min-width: 0; }
    #col-yaml { flex: 1 1 400px; min-width: 0; }
    #col-results { flex: 1 1 400px; min-width: 0; }
    /* When tests column is collapsed, override its fixed/min width */
    #col-tests.collapsed { flex: 0 0 40px !important; min-width: 40px !important; max-width: 40px !important; }
    .ed-yaml-header { padding: 8px; background-color: var(--surface); border-bottom: 1px solid var(--bd); display: flex; justify-content: space-between; align-items: center; }
    .ed-yaml-body { flex: 1; overflow: auto; }
    .CodeMirror { height: 100%; min-height: 180px; }
    #col-yaml .ed-col-content { overflow: hidden; }
    #ed_yaml_editor, #pane_yaml { height: 100%; }
    /* Ensure editable test list selection is visibly highlighted */
    #col-tests .ed-test-item { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-radius:6px; cursor:pointer; }
    #col-tests .ed-test-item:not(.selected):hover { background: var(--li-hov); }
    #col-tests .ed-test-item.selected { background: var(--li-sel); border: 1px solid var(--bd); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bd) 40%, transparent); position: relative; outline: 1px solid var(--link); outline-offset: -1px; }
    #col-tests .ed-test-item.selected::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background: var(--link); border-top-left-radius:6px; border-bottom-left-radius:6px; }
    #col-tests .ed-test-item .ed-test-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #col-tests .ed-test-item.selected .ed-test-name { font-weight:600; }
  `;
  document.head.appendChild(style);
})();

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
  
  // Delegate suite-level fields and hooks
  try{
    if (window.hydreqEditorForms && window.hydreqEditorForms.suite && typeof window.hydreqEditorForms.suite.wire === 'function'){
      const suiteFns = window.hydreqEditorForms.suite.wire(modal, working, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
      suiteVarsGet = suiteFns.suiteVarsGet || suiteVarsGet;
      suitePreGet = suiteFns.suitePreGet || suitePreGet;
      suitePostGet = suiteFns.suitePostGet || suitePostGet;
    }
  }catch{}
  
  // Update test-specific fields if a test is selected
  if (working.tests && Array.isArray(working.tests) && selIndex >= 0 && selIndex < working.tests.length) {
    const test = working.tests[selIndex];
    // Delegate to test meta form module (name, depends, stage, skip/only, tags)
    try {
      if (window.hydreqEditorForms && window.hydreqEditorForms.testmeta && typeof window.hydreqEditorForms.testmeta.wire === 'function') {
        window.hydreqEditorForms.testmeta.wire(modal, test, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
      }
    } catch {}
    const methodEl = modal.querySelector('#ed_method');
    const urlEl = modal.querySelector('#ed_url');
    const timeoutEl = modal.querySelector('#ed_timeout');
    const bodyEl = modal.querySelector('#ed_body');
    const headersEl = modal.querySelector('#ed_headers');
    const queryEl = modal.querySelector('#ed_query');
    const extractEl = modal.querySelector('#ed_extract');
    const tagsEl = modal.querySelector('#ed_tags');
    const matrixEl = modal.querySelector('#ed_matrix');
    const oapiEl = modal.querySelector('#ed_oapi_enabled');
    
    
    // Delegate to request form module
    try {
      if (window.hydreqEditorForms && window.hydreqEditorForms.request && typeof window.hydreqEditorForms.request.wire === 'function') {
        const reqFns = window.hydreqEditorForms.request.wire(modal, test, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
        headersGet = reqFns.headersGet || headersGet;
        queryGet = reqFns.queryGet || queryGet;
      }
    } catch {}
  // Extract mapping (key -> jsonPath)
    if (extractEl) {
      try { extractGet = extractTable(extractEl, test.extract || {}, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} }); } catch{}
    }
    // Tags handled by testmeta module
    // Matrix editor (delegated)
    if (matrixEl) {
      try {
        if (window.hydreqEditorForms && window.hydreqEditorForms.matrix && typeof window.hydreqEditorForms.matrix.render === 'function') {
          matrixGet = window.hydreqEditorForms.matrix.render(modal, matrixEl, test.matrix || {}, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
        } else {
          matrixGet = renderMatrix(matrixEl, test.matrix || {}, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
        }
      } catch{}
    }
    // OpenAPI override (delegated)
    try {
      if (window.hydreqEditorForms && window.hydreqEditorForms.openapi && typeof window.hydreqEditorForms.openapi.wire === 'function') {
        window.hydreqEditorForms.openapi.wire(modal, test, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
      }
    } catch {}
    
    // Stage handled by testmeta module
    
    // Delegate to assertions form module
    try {
      if (window.hydreqEditorForms && window.hydreqEditorForms.assert && typeof window.hydreqEditorForms.assert.wire === 'function') {
        const asFns = window.hydreqEditorForms.assert.wire(modal, test, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
        assertHeaderGet = asFns.assertHeaderGet || assertHeaderGet;
        assertJsonEqGet = asFns.assertJsonEqGet || assertJsonEqGet;
        assertJsonContainsGet = asFns.assertJsonContainsGet || assertJsonContainsGet;
        assertBodyContainsGet = asFns.assertBodyContainsGet || assertBodyContainsGet;
      }
    } catch {}

    // Test hooks (pre/post)
    try {
      const preC = modal.querySelector('#ed_test_prehooks');
      const postC = modal.querySelector('#ed_test_posthooks');
      if (preC) testPreGet = hookList(preC, Array.isArray(test.pre)? test.pre: [], { scope: 'testPre' }, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
      if (postC) testPostGet = hookList(postC, Array.isArray(test.post)? test.post: [], { scope: 'testPost' }, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
    } catch {}

    // Retry policy (delegated)
    try{
      if (window.hydreqEditorForms && window.hydreqEditorForms.retry && typeof window.hydreqEditorForms.retry.wire === 'function') {
        window.hydreqEditorForms.retry.wire(modal, test, ()=>{ try{ collectFormData(); mirrorYamlFromVisual(); }catch{} });
      }
    }catch{}
    
    // Skip/Only handled by testmeta module
  }
  
  // Add validation event listeners after a short delay to ensure DOM is ready
  setTimeout(() => {
    try {
      if (window.hydreqEditorValidation && typeof window.hydreqEditorValidation.wire === 'function') {
        window.hydreqEditorValidation.wire(modal);
      }
    } catch {}
  }, 100);
}

// Function to collect form data into working model
function collectFormData() {
  if (!modal || !working) return;
  
  // Collect suite-level data
  const suiteNameEl = modal.querySelector('#ed_suite_name');
  const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
  const authBearerEl = modal.querySelector('#ed_auth_bearer');
  const authBasicEl = modal.querySelector('#ed_auth_basic');
  const suiteVarsEl = modal.querySelector('#ed_suite_vars');
  
  if (suiteNameEl) working.name = suiteNameEl.value;
  if (baseUrlEl) working.baseUrl = baseUrlEl.value;
  // Suite vars from table
  try { if (suiteVarsEl && typeof suiteVarsGet === 'function') { const v = suiteVarsGet(); if (v && Object.keys(v).length) working.vars = v; else delete working.vars; } } catch{}
  
  // Only include auth if any value is provided
  const bearerVal = authBearerEl ? (authBearerEl.value||'').trim() : '';
  const basicVal = authBasicEl ? (authBasicEl.value||'').trim() : '';
  if (bearerVal || basicVal) {
    working.auth = working.auth || {};
    // Persist using bearerEnv/basicEnv to match model
    if (bearerVal) working.auth.bearerEnv = bearerVal; else delete working.auth.bearerEnv;
    if (basicVal) working.auth.basicEnv = basicVal; else delete working.auth.basicEnv;
    // Clean up legacy keys if present
    delete working.auth.bearer; delete working.auth.basic;
    if (!working.auth.bearerEnv && !working.auth.basicEnv) delete working.auth;
  } else {
    delete working.auth;
  }
  
  // Collect test-level data if a test is selected
  if (working.tests && Array.isArray(working.tests) && selIndex >= 0 && selIndex < working.tests.length) {
    const test = working.tests[selIndex];
    
    const testNameEl = modal.querySelector('#ed_test_name');
    const methodEl = modal.querySelector('#ed_method');
    const urlEl = modal.querySelector('#ed_url');
    const timeoutEl = modal.querySelector('#ed_timeout');
    const bodyEl = modal.querySelector('#ed_body');
    const skipEl = modal.querySelector('#ed_skip');
    const onlyEl = modal.querySelector('#ed_only');
    const stageEl = modal.querySelector('#ed_stage');
  const statusEl = modal.querySelector('#ed_assert_status');
  const maxDurationEl = modal.querySelector('#ed_assert_maxDuration');
    const dependsEl = modal.querySelector('#ed_test_depends');
    const tagsEl = modal.querySelector('#ed_tags');
    const oapiEl = modal.querySelector('#ed_oapi_enabled');
    
  if (testNameEl && testNameEl.value) test.name = testNameEl.value;
    
    if (!test.request) test.request = {};
    if (methodEl) test.request.method = methodEl.value;
    if (urlEl) test.request.url = urlEl.value;
    if (timeoutEl) {
      const to = timeoutEl.value ? parseInt(timeoutEl.value,10) : NaN;
      if (!isNaN(to)) test.request.timeout = to; else delete test.request.timeout;
    }
    if (bodyEl) {
      try {
        const bodyValue = bodyEl.value.trim();
        if (bodyValue) { test.request.body = JSON.parse(bodyValue); } else { delete test.request.body; }
      } catch (e) {
        if ((bodyEl.value||'').trim()) test.request.body = bodyEl.value; else delete test.request.body;
      }
    }
    // Headers and Query from kv tables
    try{ if (typeof headersGet === 'function'){ const hv = headersGet(); if (hv && Object.keys(hv).length) test.request.headers = hv; else delete test.request.headers; } }catch{}
    try{ if (typeof queryGet === 'function'){ const qv = queryGet(); if (qv && Object.keys(qv).length) test.request.query = qv; else delete test.request.query; } }catch{}
    // Assertions: include only when provided
    if (statusEl || maxDurationEl) { if (!test.assert) test.assert = {}; }
    if (statusEl) {
      const st = statusEl.value ? parseInt(statusEl.value,10) : NaN;
      if (!isNaN(st)) test.assert.status = st; else if (test.assert) delete test.assert.status;
    }
    if (maxDurationEl) {
      const md = maxDurationEl.value ? parseInt(maxDurationEl.value,10) : NaN;
      if (!isNaN(md)) test.assert.maxDurationMs = md; else if (test.assert) delete test.assert.maxDurationMs;
    }
    // Assertions maps and lists
    function tryParse(s){ try{ return JSON.parse(s); }catch{ return s; } }
    try{
      if (!test.assert) test.assert = {};
      if (typeof assertHeaderGet === 'function'){
        const hv = assertHeaderGet();
        if (hv && Object.keys(hv).length) test.assert.headerEquals = hv; else delete test.assert.headerEquals;
      }
      if (typeof assertJsonEqGet === 'function'){
        const jv = assertJsonEqGet();
        const out = {}; Object.keys(jv||{}).forEach(k=>{ const v = jv[k]; if (v!=='' && v!=null) out[k] = tryParse(v); });
        if (Object.keys(out).length) test.assert.jsonEquals = out; else delete test.assert.jsonEquals;
      }
      if (typeof assertJsonContainsGet === 'function'){
        const jc = assertJsonContainsGet();
        const out = {}; Object.keys(jc||{}).forEach(k=>{ const v = jc[k]; if (v!=='' && v!=null) out[k] = tryParse(v); });
        if (Object.keys(out).length) test.assert.jsonContains = out; else delete test.assert.jsonContains;
      }
      if (typeof assertBodyContainsGet === 'function'){
        const bc = assertBodyContainsGet();
        if (Array.isArray(bc) && bc.length) test.assert.bodyContains = bc; else delete test.assert.bodyContains;
      }
    }catch{}
    if (test.assert && Object.keys(test.assert).length === 0) delete test.assert;
    // Flags and meta: only include when set
    if (skipEl) { if (skipEl.checked) test.skip = true; else delete test.skip; }
    if (onlyEl) { if (onlyEl.checked) test.only = true; else delete test.only; }
    if (stageEl) {
      const stg = stageEl.value ? parseInt(stageEl.value,10) : NaN;
      if (!isNaN(stg)) test.stage = stg; else delete test.stage;
    }
    // dependsOn (comma-separated)
    if (dependsEl){ const arr = (dependsEl.value||'').split(',').map(s=>s.trim()).filter(Boolean); if (arr.length) test.dependsOn = arr; else delete test.dependsOn; }
    // tags
    if (tagsEl){ const tg = (tagsEl.value||'').split(',').map(s=>s.trim()).filter(Boolean); if (tg.length) test.tags = tg; else delete test.tags; }
  // extract
    try{ if (typeof extractGet === 'function'){ const ex = extractGet(); if (ex && Object.keys(ex).length) test.extract = ex; else delete test.extract; } }catch{}
    // matrix
    try{ if (typeof matrixGet === 'function'){ const mx = matrixGet(); if (mx && Object.keys(mx).length) test.matrix = mx; else delete test.matrix; } }catch{}
    // openapi override
    if (oapiEl){ const v = (oapiEl.value||'inherit'); if (v==='inherit'){ delete test.openApi; } else { test.openApi = { enabled: (v==='true') }; } }
    // test hooks
    try{
      if (typeof testPreGet === 'function'){ const arr = testPreGet(); if (Array.isArray(arr) && arr.length) test.pre = arr; else delete test.pre; }
      if (typeof testPostGet === 'function'){ const arr = testPostGet(); if (Array.isArray(arr) && arr.length) test.post = arr; else delete test.post; }
    }catch{}
    // retry policy
    try{
      const en = modal.querySelector('#ed_retry_enable');
      const mx = modal.querySelector('#ed_retry_max');
      const bo = modal.querySelector('#ed_retry_backoff');
      const ji = modal.querySelector('#ed_retry_jitter');
      const enabled = !!(en && en.checked);
      const r = {};
      if (mx && mx.value){ const n = parseInt(mx.value,10); if (!isNaN(n)) r.max = n; }
      if (bo && bo.value){ const n = parseInt(bo.value,10); if (!isNaN(n)) r.backoffMs = n; }
      if (ji && ji.value){ const n = parseInt(ji.value,10); if (!isNaN(n)) r.jitterPct = n; }
      if (enabled || Object.keys(r).length){ test.retry = r; } else { delete test.retry; }
    }catch{}
  }

  // Suite hooks collect
  try{
    if (typeof suitePreGet === 'function'){ const arr = suitePreGet(); if (Array.isArray(arr) && arr.length) working.preSuite = arr; else delete working.preSuite; }
    if (typeof suitePostGet === 'function'){ const arr = suitePostGet(); if (Array.isArray(arr) && arr.length) working.postSuite = arr; else delete working.postSuite; }
  }catch{}
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
function normalizeParsed(inObj){
  if (!inObj || typeof inObj !== 'object') return { tests: [] };
  const out = {};
  out.name = inObj.Name || inObj.name || '';
  out.baseUrl = inObj.BaseURL || inObj.baseUrl || '';
  out.vars = inObj.Variables || inObj.vars || {};
  const au = inObj.Auth || inObj.auth || null;
  out.auth = au ? { bearerEnv: (au.BearerEnv || au.bearerEnv || ''), basicEnv: (au.BasicEnv || au.basicEnv || '') } : null;
  // suite hooks
  out.preSuite = inObj.PreSuite || inObj.preSuite || [];
  out.postSuite = inObj.PostSuite || inObj.postSuite || [];
  // suite-level
  const testsArr = Array.isArray(inObj.Tests) ? inObj.Tests : (Array.isArray(inObj.tests) ? inObj.tests : []);
  if (Array.isArray(testsArr)){
    out.tests = testsArr.map(tc=>{
      const t = {};
      t.name = tc.Name || tc.name || '';
      // request
      const rq = tc.Request || tc.request || {};
      t.request = {
        method: rq.Method || rq.method || 'GET',
        url: rq.URL || rq.url || '',
        headers: rq.Headers || rq.headers || {},
        query: rq.Query || rq.query || {},
        body: (rq.Body !== undefined ? rq.Body : rq.body)
      };
      // assert (only set provided fields)
      const as = tc.Assert || tc.assert || {};
      const aOut = {};
      if (as.Status !== undefined || as.status !== undefined) aOut.status = as.Status ?? as.status;
      if (as.HeaderEquals || as.headerEquals) aOut.headerEquals = as.HeaderEquals || as.headerEquals;
      if (as.JSONEquals || as.jsonEquals) aOut.jsonEquals = as.JSONEquals || as.jsonEquals;
      if (as.JSONContains || as.jsonContains) aOut.jsonContains = as.JSONContains || as.jsonContains;
      if (as.BodyContains || as.bodyContains) aOut.bodyContains = as.BodyContains || as.bodyContains;
      if (as.MaxDurationMs !== undefined || as.maxDurationMs !== undefined) aOut.maxDurationMs = as.MaxDurationMs ?? as.maxDurationMs;
      if (Object.keys(aOut).length) t.assert = aOut;
      // extract
      const ex = tc.Extract || tc.extract || {};
      const exOut = {};
      Object.keys(ex||{}).forEach(k=>{
        const v = ex[k]||{}; exOut[k] = { jsonPath: v.JSONPath || v.jsonPath || '' };
      });
      t.extract = exOut;
      // flow/meta
      if ((tc.Skip ?? tc.skip) === true) t.skip = true;
      if ((tc.Only ?? tc.only) === true) t.only = true;
      if ((tc.TimeoutMs ?? tc.timeoutMs) !== undefined) t.timeoutMs = tc.TimeoutMs ?? tc.timeoutMs;
      if ((tc.Repeat ?? tc.repeat) !== undefined) t.repeat = tc.Repeat ?? tc.repeat;
  t.tags = tc.Tags || tc.tags || [];
  const __stg = (tc.Stage ?? tc.stage);
  if (__stg !== undefined && __stg !== 0) t.stage = __stg;
      t.vars = tc.Vars || tc.vars || {};
      t.dependsOn = tc.DependsOn || tc.dependsOn || [];
      t.pre = tc.Pre || tc.pre || [];
      t.post = tc.Post || tc.post || [];
      // retry
      const rt = tc.Retry || tc.retry || null;
      if (rt){
        const rOut = {};
        if (rt.Max !== undefined || rt.max !== undefined) rOut.max = rt.Max ?? rt.max;
        if (rt.BackoffMs !== undefined || rt.backoffMs !== undefined) rOut.backoffMs = rt.BackoffMs ?? rt.backoffMs;
        if (rt.JitterPct !== undefined || rt.jitterPct !== undefined) rOut.jitterPct = rt.JitterPct ?? rt.jitterPct;
        if (Object.keys(rOut).length) t.retry = rOut;
      }
      // matrix
      t.matrix = tc.Matrix || tc.matrix || {};
      // openapi
      const oa = tc.OpenAPI || tc.openApi || null;
      if (oa && (oa.Enabled !== undefined || oa.enabled !== undefined)) t.openApi = { enabled: (oa.Enabled ?? oa.enabled) };
      return t;
    });
  } else {
    out.tests = [];
  }
  return out;
}

// Enable/disable visual editor controls
function setVisualEnabled(enabled){
  // Disable/enable all controls in visual pane and tests list
  const ctrlSel = '#pane_visual input, #pane_visual select, #pane_visual textarea, #pane_visual button';
  modal.querySelectorAll(ctrlSel).forEach(el=>{ el.disabled = !enabled; });
  const testsPanel = modal.querySelector('.ed-tests-panel');
  if (testsPanel){ if (!enabled) testsPanel.classList.add('ed-disabled'); else testsPanel.classList.remove('ed-disabled'); }
  // Disable Visual tab interaction
  if (!enabled) tabVisual.classList.add('disabled'); else tabVisual.classList.remove('disabled');
}

// Debounce function for delaying execution
function debounce(fn, wait){ let t=null; return function(){ const args=arguments; clearTimeout(t); t=setTimeout(()=> fn.apply(this,args), wait); } }

// Remove quotes around purely-numeric mapping keys in YAML string
function unquoteNumericKeys(yamlText){
  if (!yamlText) return yamlText;
  // Replace lines like "  "123": value" with "  123: value" but only for simple mappings
  return yamlText.split('\n').map(line=>{
    // match indentation, quoted key, colon
    const m = line.match(/^(\s*)("|')([0-9]+)("|')\s*:\s*(.*)$/);
    if (m) return m[1] + m[3] + ': ' + m[5];
    return line;
  }).join('\n');
}

// Initialize tables module with modal reference
try{ if (window.hydreqEditorTables && window.hydreqEditorTables.init) window.hydreqEditorTables.init(modal); }catch{}

// Create a matrix editor for data-driven test expansion
function renderMatrix(container, matrix, onChange) {
  const c = (typeof container === 'string') ? modal.querySelector(container) : container;
  c.innerHTML = '';
  
  const table = document.createElement('div');
  table.className = 'ed-matrix-table';
  
  function addRow(key = '', values = []) {
  const row = document.createElement('div');
  row.className = 'ed-matrix-row';
    
    // Variable name input
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Variable name';
    keyInput.value = key;
    keyInput.className = 'ed-matrix-key';
    if (onChange) {
      ['input', 'change', 'blur'].forEach(ev => keyInput.addEventListener(ev, onChange));
    }
    
    // Values container (list of strings)
  const valuesContainer = document.createElement('div');
  valuesContainer.className = 'ed-matrix-values';
    
    function addValueInput(value = '') {
  const valueDiv = document.createElement('div');
  valueDiv.className = 'ed-matrix-value';
      
      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.placeholder = 'Value';
      valueInput.value = value;
  valueInput.className = 'w-full';
      if (onChange) {
        ['input', 'change', 'blur'].forEach(ev => valueInput.addEventListener(ev, onChange));
      }
      
      const removeValueBtn = document.createElement('button');
      removeValueBtn.textContent = '×';
      removeValueBtn.className = 'btn btn-xs btn-ghost';
      removeValueBtn.title = 'Remove value';
      removeValueBtn.onclick = () => {
        valueDiv.remove();
        if (onChange) onChange();
      };
      
      valueDiv.appendChild(valueInput);
      valueDiv.appendChild(removeValueBtn);
      valuesContainer.appendChild(valueDiv);
    }
    
    // Add existing values
    if (Array.isArray(values) && values.length > 0) {
      values.forEach(value => addValueInput(value));
    } else {
      addValueInput(); // At least one empty value input
    }
    
    // Add value button
    const addValueBtn = document.createElement('button');
    addValueBtn.textContent = '+ Value';
  addValueBtn.className = 'btn btn-xs btn-secondary mt-8';
  addValueBtn.onclick = () => {
      addValueInput();
      if (onChange) onChange();
    };
    valuesContainer.appendChild(addValueBtn);
    
    // Remove row button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'btn btn-xs btn-ghost';
    removeBtn.title = 'Remove variable';
    removeBtn.onclick = () => {
      row.remove();
      if (onChange) onChange();
    };
    
    row.appendChild(keyInput);
    row.appendChild(valuesContainer);
    row.appendChild(removeBtn);
    table.appendChild(row);
  }
  
  // Add existing matrix entries
  if (matrix && typeof matrix === 'object') {
    Object.keys(matrix).forEach(key => {
      const values = Array.isArray(matrix[key]) ? matrix[key] : [];
      addRow(key, values);
    });
  }
  
  // If no entries, add one empty row
  if (!matrix || Object.keys(matrix).length === 0) {
    addRow();
  }
  
  // Add variable button
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add Variable';
  addBtn.className = 'btn btn-sm btn-primary';
  addBtn.style.marginTop = '8px';
  addBtn.onclick = () => {
    addRow();
    if (onChange) onChange();
  };
  
  c.appendChild(table);
  c.appendChild(addBtn);
  
  // Return function to collect current matrix data
  return () => {
    const result = {};
    const rows = table.querySelectorAll('.ed-matrix-row');
    rows.forEach(row => {
      const keyInput = row.querySelector('.ed-matrix-key');
      const valueInputs = row.querySelectorAll('.ed-matrix-values input[type="text"]');
      
      if (keyInput && keyInput.value.trim()) {
        const key = keyInput.value.trim();
        const values = [];
        valueInputs.forEach(input => {
          if (input.value.trim()) {
            values.push(input.value.trim());
          }
        });
        if (values.length > 0) {
          result[key] = values;
        }
      }
    });
    return result;
  };
}

// Create a hook list editor (delegates to extracted module; no inline fallback per Phase 2)
function hookList(container, hooks, options, onChange){
  if (window.hydreqEditorHooks && typeof window.hydreqEditorHooks.hookList === 'function') {
    return window.hydreqEditorHooks.hookList(container, hooks, options, onChange);
  }
  console.warn('hydreqEditorHooks.hookList not loaded; hooks UI unavailable');
  try {
    const c = (typeof container==='string') ? modal.querySelector(container) : container;
    if (c) c.innerHTML = '<div class="dim">Hooks module not loaded.</div>';
  } catch {}
  return ()=>[];
}

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
  working = (data.parsed ? normalizeParsed(JSON.parse(JSON.stringify(data.parsed))) : { tests: [] });
  if (!Array.isArray(working.tests)) working.tests = [];
  
  modal = document.getElementById('editorModal');
  if (!modal){
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
    document.body.classList.add('modal-open');
    modal.addEventListener('wheel', (e)=>{ e.stopPropagation(); }, { passive: true });
    modal.addEventListener('touchmove', (e)=>{ e.stopPropagation(); }, { passive: true });
    modal.addEventListener('click', (e)=>{ if (e.target === modal) attemptClose(); });
  }
  // Ensure dirty indicator is hidden at start and state is clean
  try{ const di = modal.querySelector('#ed_dirty_indicator'); if (di) di.style.display = 'none'; }catch{}
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
  issuesEl.innerHTML = '';
  (function attachVisualDelegates(){
    const root = modal.querySelector('#pane_visual');
    if (!root) return;
    const handler = async ()=>{ try { if (window.__ed_initializing) return; sync(); await mirrorYamlFromVisual(); } catch {} };
    root.addEventListener('input', ()=>{ handler(); }, true);
    root.addEventListener('change', ()=>{ handler(); }, true);
    root.addEventListener('click', (e)=>{ const t = e.target; if (!t) return; if ((t.tagName && t.tagName.toLowerCase()==='button') || t.closest('button')) { handler(); } }, true);
  })();
  selIndex = 0;
  const persisted = (function(){ try{ return JSON.parse(localStorage.getItem(LS_KEY(path))||'{}') }catch{ return {} } })();
  testRunCache = new Map(Object.entries(persisted));
  let lastSuiteRun = null;
  function markDirty(){ try{ yamlCtl && yamlCtl.markDirty ? yamlCtl.markDirty() : null; }catch{} }
  function isDirty(){ try{ return (window.hydreqEditorState && typeof window.hydreqEditorState.isDirty==='function') ? !!window.hydreqEditorState.isDirty() : false; }catch{ return false; } }
  function attemptClose(){ if (isDirty() && !confirm('Discard unsaved changes?')) return; modal.remove(); document.body.classList.remove('modal-open'); }
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
  
  const syncYamlPreviewFromVisual = debounce(()=>{
    try { mirrorYamlFromVisual(); }
    catch(e){ console.error('Error syncing YAML:', e); }
  }, 300);
  
  function setVisualEnabled(enabled){ 
    const ctrlSel = '#pane_visual input, #pane_visual select, #pane_visual textarea, #pane_visual button';
    modal.querySelectorAll(ctrlSel).forEach(el=>{ el.disabled = !enabled; });
    const testsPanel = modal.querySelector('.ed-tests-panel');
    if (testsPanel){ 
      if (!enabled) testsPanel.classList.add('ed-disabled'); 
      else testsPanel.classList.remove('ed-disabled'); 
    }
  }
  
  function debounce(fn, wait){ 
    let t=null; 
    return function(){ 
      const args=arguments; 
      clearTimeout(t); 
      t=setTimeout(()=> fn.apply(this,args), wait); 
    }; 
  }
  
  async function validateRawAndApply(){ try{ if (!yamlCtl) return false; const parsed = yamlCtl.parseToWorking ? yamlCtl.parseToWorking() : {}; working = normalizeParsed(parsed); return true; }catch(e){ console.error('YAML validation failed:', e); return false; } }
  
  async function switchTab(which){ 
    if (which === 'visual') {
      try{ const parsed = yamlCtl && yamlCtl.parseToWorking ? yamlCtl.parseToWorking() : {}; if (parsed && Object.keys(parsed).length){ working = normalizeParsed(parsed); renderForm(); } }catch(e){ console.warn('Failed to parse YAML when switching to visual:', e); }
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
        working = normalizeParsed(parsed);
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
      try{ const wk = (e && e.detail && e.detail.working) || {}; working = normalizeParsed(wk); renderForm(); }catch{}
    });
    document.addEventListener('hydreq:editor:dirty:changed', (e)=>{
      try{
        const dty = !!(e && e.detail && e.detail.dirty);
        const di = modal && modal.querySelector && modal.querySelector('#ed_dirty_indicator');
        if (di) {
          if (window.__ed_uiSuppressDirty) return;
          di.style.display = dty ? '' : 'none';
        }
      }catch{}
    });
  }catch{}
  
  // Column collapse functionality
  function setupColumnCollapseButton(buttonId, columnId) {
    const collapseBtn = modal.querySelector(buttonId);
    const column = modal.querySelector(columnId);
    
    if (collapseBtn && column) {
      collapseBtn.addEventListener('click', () => {
        column.classList.toggle('collapsed');
        collapseBtn.textContent = column.classList.contains('collapsed') ? '▶' : '◀';
        collapseBtn.title = column.classList.contains('collapsed') ? 'Expand' : 'Collapse';
        
        // Ensure YAML editor if it's the YAML column
        if (columnId === '#col-yaml' && !column.classList.contains('collapsed')) {
          setTimeout(() => { try{ yamlCtl && yamlCtl.ensure && yamlCtl.ensure(); }catch{} }, 10);
        }
      });
    }
  }
  
  
  // Setup collapse buttons for all columns
  setupColumnCollapseButton('#ed_collapse_tests', '#col-tests');
  setupColumnCollapseButton('#ed_collapse_visual', '#col-visual');
  setupColumnCollapseButton('#ed_collapse_yaml', '#col-yaml');
  setupColumnCollapseButton('#ed_collapse_results', '#col-results');
  
  const closeBtn = modal.querySelector('#ed_close'); if (closeBtn){ closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); attemptClose(); }); }
  document.addEventListener('keydown', function escClose(ev){ if (!document.getElementById('editorModal')) { document.removeEventListener('keydown', escClose); return; } if (ev.key === 'Escape'){ attemptClose(); } });
  (function(){ /* splitter implementation intentionally omitted */ })();
  try { const pref = localStorage.getItem('hydreq.editor.density') || 'compact'; if (pref === 'comfortable') { densityToggle.checked = true; editorRoot.classList.add('comfortable'); } } catch {}
  if (densityToggle) { densityToggle.addEventListener('change', ()=>{ const comfy = densityToggle.checked; if (comfy) editorRoot.classList.add('comfortable'); else editorRoot.classList.remove('comfortable'); try { localStorage.setItem('hydreq.editor.density', comfy ? 'comfortable' : 'compact'); } catch {} }); }
  
  // Event handlers for form fields
  function handleSuiteNameChange(e) { working.name = e.target.value; markDirty(); }
  function handleBaseUrlChange(e) { working.baseUrl = e.target.value; markDirty(); }
  function handleAuthBearerChange(e) { 
    if (!working.auth) working.auth = {};
    working.auth.bearerEnv = e.target.value; 
    // remove legacy key if present
    delete working.auth.bearer;
    markDirty(); 
  }
  function handleAuthBasicChange(e) { 
    if (!working.auth) working.auth = {};
    working.auth.basicEnv = e.target.value; 
    delete working.auth.basic;
    markDirty(); 
  }
  
  function handleTestNameChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      working.tests[selIndex].name = e.target.value;
      markDirty();
      renderTests(); // Update test list to show new name
    }
  }
  
  function handleMethodChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      if (!working.tests[selIndex].request) working.tests[selIndex].request = {};
      working.tests[selIndex].request.method = e.target.value;
      markDirty();
    }
  }
  
  function handleUrlChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      if (!working.tests[selIndex].request) working.tests[selIndex].request = {};
      working.tests[selIndex].request.url = e.target.value;
      markDirty();
    }
  }
  
  function handleTimeoutChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      if (!working.tests[selIndex].request) working.tests[selIndex].request = {};
      working.tests[selIndex].request.timeout = e.target.value ? parseInt(e.target.value) : undefined;
      markDirty();
    }
  }
  
  function handleBodyChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      if (!working.tests[selIndex].request) working.tests[selIndex].request = {};
      working.tests[selIndex].request.body = e.target.value;
      markDirty();
    }
  }
  
  function handleSkipChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      working.tests[selIndex].skip = e.target.checked;
      markDirty();
    }
  }
  
  function handleOnlyChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      working.tests[selIndex].only = e.target.checked;
      markDirty();
    }
  }
  
  function handleStageChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      working.tests[selIndex].stage = e.target.value ? parseInt(e.target.value) : undefined;
      markDirty();
    }
  }
  
  function handleStatusChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      if (!working.tests[selIndex].assert) working.tests[selIndex].assert = {};
      working.tests[selIndex].assert.status = e.target.value ? parseInt(e.target.value) : undefined;
      markDirty();
    }
  }
  
  function handleMaxDurationChange(e) { 
    if (working.tests && working.tests[selIndex]) {
      if (!working.tests[selIndex].assert) working.tests[selIndex].assert = {};
      working.tests[selIndex].assert.maxDurationMs = e.target.value ? parseInt(e.target.value) : undefined;
      markDirty();
    }
  }
  
  renderTests();
  renderForm();
  yamlCtl && yamlCtl.ensure && yamlCtl.ensure();
  // Seed global editor state working model
  try{ if (window.hydreqEditorState && window.hydreqEditorState.setWorking) window.hydreqEditorState.setWorking(working); }catch{}
  const cacheKey = ()=>{ const t = (working.tests && working.tests[selIndex]) || {}; return selIndex + ':' + (t.name||('test '+(selIndex+1))); };
  function clearQuickRun(){ const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.innerHTML = ''; }
  function appendQuickRunLine(text, cls){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; const d=document.createElement('div'); if (cls) d.className=cls; d.textContent=text; qr.appendChild(d); qr.scrollTop = qr.scrollHeight; }
  function setQuickRunBox(result){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; qr.innerHTML=''; if (!result) return; const icon = result.status==='passed'?'✓':(result.status==='failed'?'✗':(result.status==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${result.name||''}`,(result.status==='passed'?'text-success':(result.status==='failed'?'text-error':'text-warning'))); }
  // Run record persistence and rendering
  function getRunRecord(){ try{ const k = RUNREC_KEY((modal.querySelector('#ed_path')||{}).textContent||''); return JSON.parse(localStorage.getItem(k)||'{}'); }catch{return {}} }
  function saveRunRecord(rec){ try{ const k = RUNREC_KEY((modal.querySelector('#ed_path')||{}).textContent||''); localStorage.setItem(k, JSON.stringify(rec)); }catch{} }
  function setSuiteRecord(status, durationMs, messages){ const rec = getRunRecord(); rec.suite = { status, durationMs: durationMs||0, messages: messages||[], ts: Date.now() }; saveRunRecord(rec); try{ updateSuiteBadgeUI((modal.querySelector('#ed_path')||{}).textContent||'', status); }catch{} try{ const pth=(modal.querySelector('#ed_path')||{}).textContent||''; if (window.hydreqStore){ window.hydreqStore.setSummary(pth, { passed: status==='passed'?1:0, failed: status==='failed'?1:0, skipped: status==='skipped'?1:0, total: 1, durationMs: durationMs||0 }); window.hydreqStore.setBadge(pth, status||'unknown'); } }catch{}
 }
  function setTestRecord(name, status, durationMs, messages){ const rec = getRunRecord(); rec.tests = rec.tests||{}; rec.tests[name||''] = { name, status, durationMs: durationMs||0, messages: messages||[], ts: Date.now() }; saveRunRecord(rec); try{ if (status==='failed' || status==='passed' || status==='skipped'){ updateSuiteBadgeUI((modal.querySelector('#ed_path')||{}).textContent||'', status); } }catch{} try{ const pth=(modal.querySelector('#ed_path')||{}).textContent||''; if (window.hydreqStore){ window.hydreqStore.setTest(pth, name||'', { status, durationMs: durationMs||0, messages: Array.isArray(messages)?messages:[] }); } }catch{} }
  function renderLatestForSelection(){
    try{
      const rec = getRunRecord();
      const t = (working.tests && working.tests[selIndex]) || {};
      const nm = t.name || '';
      const tr = (rec.tests||{})[nm];
      clearQuickRun();
      // Prefer exact per-test record when present
      if (tr){
        const s=(tr.status||'').toLowerCase();
        const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·'));
        appendQuickRunLine(`${icon} ${nm}${tr.durationMs?` (${tr.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning'));
        if (Array.isArray(tr.messages) && tr.messages.length){
          const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = tr.messages.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det);
        }
        return;
      }
      // Fallback: if runner view summary is available, try to extract this test's status
      try{
        if (typeof window.getSuiteSummary==='function'){
          const path = (modal.querySelector('#ed_path')||{}).textContent||'';
          const sm = window.getSuiteSummary(path);
          const tc = sm && Array.isArray(sm.tests) ? sm.tests.find(c=> (c.name||c.Name) === nm) : null;
          if (tc){
            const s = (tc.status||tc.Status||'').toLowerCase();
            const d = tc.durationMs||tc.DurationMs||0;
            const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·'));
            appendQuickRunLine(`${icon} ${nm}${d?` (${d}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning'));
            const msgs = tc.messages || tc.Messages || [];
            if (Array.isArray(msgs) && msgs.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = msgs.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det); }
            return;
          }
        }
      }catch(e){}
      // As a last resort, show last suite record if present
      const sr = rec.suite;
      if (sr){
        const s=(sr.status||'').toLowerCase();
        const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·'));
        appendQuickRunLine(`${icon} ${nm}${sr.durationMs?` (${sr.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning'));
        if (Array.isArray(sr.messages) && sr.messages.length){
          const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className='message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok'));
          pre.textContent=sr.messages.join('\n'); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(pre);
        }
        return;
      }
      appendQuickRunLine('No previous run');
    }catch(e){}
  }
  function renderQuickRunForSelection(){ renderLatestForSelection(); const qrBox = modal.querySelector('#ed_quickrun_box'); if (qrBox) qrBox.open = true; }
  // Expose for global selector
  try{ window.__ed_renderQuickRunForSelection = renderQuickRunForSelection; }catch(e){}
  function updateSuiteBadgeUI(path, status){ try{ if (!path) return; const li = document.querySelector('#suites li[data-path="'+path+'"]'); if (!li) return; const sb = li.querySelector('.suite-badge'); if (!sb) return; const st=(status||'').toLowerCase(); if (st==='failed'){ sb.textContent='✗'; sb.classList.remove('status-unknown','status-ok','status-skip'); sb.classList.add('status-fail'); sb.dataset.status='failed'; } else if (st==='passed'){ if (sb.dataset.status!=='failed'){ sb.textContent='✓'; sb.classList.remove('status-unknown','status-fail','status-skip'); sb.classList.add('status-ok'); sb.dataset.status='passed'; } } else if (st==='skipped'){ if (sb.dataset.status!=='failed' && sb.dataset.status!=='passed'){ sb.textContent='○'; sb.classList.remove('status-unknown','status-fail','status-ok'); sb.classList.add('status-skip'); sb.dataset.status='skipped'; } } else { sb.textContent='·'; sb.classList.remove('status-ok','status-fail','status-skip'); sb.classList.add('status-unknown'); sb.dataset.status='unknown'; } }catch(e){} }
  function getTestIndexByName(name){ if (!name) return -1; if (!Array.isArray(working.tests)) return -1; for (let i=0;i<working.tests.length;i++){ if ((working.tests[i].name||'') === name) return i; } return -1; }
  function updateTestBadgeByIndex(idx, status, messages){ 
    try{ 
      if (idx<0) return; 
      const t = (working.tests && working.tests[idx]) || {}; 
      const key = idx + ':' + (t.name||('test '+(idx+1))); 
      testRunCache.set(key, { 
        status: status, 
        name: t.name,
        messages: messages || []
      }); 
      try{ 
        localStorage.setItem(LS_KEY((modal.querySelector('#ed_path')||{}).textContent||''), JSON.stringify(Object.fromEntries(testRunCache))); 
      }catch{} 
      // Push details to suites sidebar so both views are in sync
      try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (typeof window.setSuiteTestDetails==='function'){ const st=(status||'').toLowerCase(); if (st==='failed' || (st==='skipped' && Array.isArray(messages) && messages.length)) window.setSuiteTestDetails(pth, t.name||'', messages||[]); } }catch{}
      renderTests(); 
    }catch(e){} 
  }
  function updateBadgesFromSuiteResult(res){
    try{
      if (!res) return;
      if (Array.isArray(res.cases)){
        res.cases.forEach(c=>{
          const nm = c.Name || c.name;
          const st = (c.Status || c.status || '').toLowerCase();
          const dur = c.DurationMs || c.durationMs || 0;
          const msgs = c.Messages || c.messages || [];
          const idx = getTestIndexByName(nm);
          if (idx>=0) updateTestBadgeByIndex(idx, st, msgs);
          // persist per-test record for freshness
          setTestRecord(nm, st, dur, Array.isArray(msgs)? msgs: []);
          // propagate to suites list if available
          try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (window.setSuiteTestStatus) window.setSuiteTestStatus(pth, nm, st); if (typeof window.setSuiteTestDetails==='function' && (st==='failed' || (st==='skipped' && Array.isArray(msgs) && msgs.length))) window.setSuiteTestDetails(pth, nm, Array.isArray(msgs)?msgs:[]); }catch{}
        });
      } else if (res.name && res.status){
        const idx = getTestIndexByName(res.name);
        if (idx>=0) updateTestBadgeByIndex(idx, (res.status||'').toLowerCase(), res.messages || []);
        const st = (res.status||'').toLowerCase();
        setTestRecord(res.name, st, res.durationMs||0, res.messages||[]);
  try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (window.setSuiteTestStatus) window.setSuiteTestStatus(pth, res.name, st); if (typeof window.setSuiteTestDetails==='function' && (st==='failed' || (st==='skipped' && Array.isArray(res.messages) && res.messages.length))) window.setSuiteTestDetails(pth, res.name, Array.isArray(res.messages)?res.messages:[]); }catch{}
      }
    }catch(e){}
  }
  function renderImmediateRunResult(res, label){ const details = modal.querySelector('#ed_quickrun_box'); if (details) details.open = true; const s = (res.status||'').toLowerCase(); if (res.name){ const icon = s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${res.name}${res.durationMs?` (${res.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning')); }
  if (Array.isArray(res.messages) && res.messages.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = res.messages.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det); }
  if (Array.isArray(res.cases) && res.cases.length){ res.cases.forEach(c=>{ const cs=(c.Status||'').toLowerCase(); const icon = cs==='passed'?'✓':(cs==='failed'?'✗':(cs==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${c.Name}${c.DurationMs?` (${c.DurationMs}ms)`:''}`, cs==='passed'?'text-success':(cs==='failed'?'text-error':'text-warning')); if (Array.isArray(c.Messages) && c.Messages?.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (cs==='failed'?'fail':(cs==='skipped'?'skip':'ok')); pre.textContent = c.Messages.join('\n'); det.appendChild(pre); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(det); } }); }
  }
  function renderIssues(issues, yamlPreview){ try{ if (window.hydreqEditorIssues && typeof window.hydreqEditorIssues.renderIssues==='function') window.hydreqEditorIssues.renderIssues(modal, issues, yamlPreview); }catch{} }
  function parseEnvFromPage(){ try{ return (typeof parseEnv==='function') ? parseEnv() : {}; }catch{ return {}; } }
  let lastValidated = null;
  modal.querySelector('#ed_run_test').onclick = async ()=>{ 
    try{
      collectFormData(); if (!working.tests || !working.tests[selIndex]){ appendQuickRunLine('No test selected','text-warning'); return; }
      const includeDeps = !!(modal.querySelector('#ed_run_with_deps')?.checked);
      const includePrevStages = !!(modal.querySelector('#ed_run_with_prevstages')?.checked);
      const env = parseEnvFromPage();
      clearQuickRun(); appendQuickRunLine('Starting test...', 'dim');
      // Try modular quick-run path first
      try { if (window.hydreqEditorState && window.hydreqEditorState.setWorking) window.hydreqEditorState.setWorking(working); } catch {}
      let started = false;
      try{
        if (window.hydreqEditorRun && typeof window.hydreqEditorRun.quickRun === 'function'){
          const runId = await window.hydreqEditorRun.quickRun({ runAll: false, includeDeps, includePrevStages, testIndex: selIndex });
          if (runId){ listenToQuickRun(runId, working.tests[selIndex].name || `test ${selIndex+1}`); started = true; }
        }
      }catch{}
      if (!started){
        const payload = { parsed: working, testIndex: selIndex, env, runAll: false, includeDeps, includePrevStages };
        const res = await fetch('/api/editor/testrun', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (!res.ok){ let txt=''; try{ txt=await res.text(); }catch{} throw new Error('HTTP '+res.status+(txt?(': '+txt):'')); }
        const data = await res.json();
        if (data && data.runId){ listenToQuickRun(data.runId, working.tests[selIndex].name || `test ${selIndex+1}`); }
        else {
        // Immediate result mode
        renderImmediateRunResult(data, working.tests[selIndex].name || `test ${selIndex+1}`);
        const status = (data.status||'').toLowerCase();
        const name = data.name || (working.tests[selIndex].name || `test ${selIndex+1}`);
        setTestRecord(name, status, data.durationMs||0, data.messages||[]);
        updateTestBadgeByIndex(selIndex, status, data.messages || []);
        // propagate to suites list and suite badge
        try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (window.setSuiteTestStatus) window.setSuiteTestStatus(pth, name, status); }catch{}
        try{ setSuiteRecord(status, data.durationMs||0, data.messages||[]); }catch{}
        }
      }
    }catch(e){ console.error(e); appendQuickRunLine('Run failed: '+e.message, 'text-error'); }
  };
  
  // Listen to quick run results
  function listenToQuickRun(runId, label){
    const quickRunBox = modal.querySelector('#ed_quickrun'); if (!quickRunBox) return; quickRunBox.innerHTML = `<div>Running ${label}...</div>`;
    const quickRunDetails = modal.querySelector('#ed_quickrun_box'); if (quickRunDetails) quickRunDetails.open = true;
    const es = new EventSource('/api/stream?runId=' + encodeURIComponent(runId));
    es.onmessage = (event)=>{
      try{
        const raw = JSON.parse(event.data);
        const type = raw.type || (raw.Status || raw.status ? 'test' : null);
        const payload = raw.payload || raw;
        if (type === 'test'){
          const name = payload.Name || payload.name || label;
          const s = (payload.Status || payload.status || '').toLowerCase();
          const icon = s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·'));
          const dur = payload.DurationMs || payload.durationMs;
          const line = document.createElement('div'); line.textContent = `${icon} ${name}${dur?` (${dur}ms)`:''}`;
          if (s==='passed') line.className='text-success'; else if (s==='failed') line.className='text-error'; else if (s==='skipped') line.className='text-warning';
          quickRunBox.appendChild(line); quickRunBox.scrollTop = quickRunBox.scrollHeight;
          try{ 
            const idx = getTestIndexByName(name); 
            const messages = payload.Messages || [];
            setTestRecord(name, s, dur||0, messages); 
            if (idx>=0) {
              updateTestBadgeByIndex(idx, s, messages);
            } else { 
              const key = cacheKey(); 
              testRunCache.set(key, { status: s, name, messages }); 
              localStorage.setItem(LS_KEY((modal.querySelector('#ed_path')||{}).textContent||''), JSON.stringify(Object.fromEntries(testRunCache))); 
            } 
          }catch{}
          // propagate to suites list
          try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (window.setSuiteTestStatus) window.setSuiteTestStatus(pth, name, s); if (typeof window.setSuiteTestDetails==='function'){ const msgs = Array.isArray(payload.Messages)?payload.Messages:[]; if (s==='failed' || (s==='skipped' && msgs.length)) window.setSuiteTestDetails(pth, name, msgs); } }catch{}
          if (Array.isArray(payload.Messages) && payload.Messages.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = payload.Messages.join('\n'); det.appendChild(pre); quickRunBox.appendChild(det); }
        } else if (type === 'suiteEnd'){
          const s = payload.summary || {};
          appendQuickRunLine(`=== ${payload.name || payload.path || 'suite'} — ${(s.passed||0)} passed, ${(s.failed||0)} failed, ${(s.skipped||0)} skipped, total ${(s.total||0)} in ${(s.durationMs||0)} ms`);
          const st = ((s.failed||0)>0)? 'failed' : (((s.passed||0)>0)? 'passed' : (((s.skipped||0)>0)? 'skipped' : 'unknown'));
          setSuiteRecord(st, s.durationMs||0, []);
          // We may not get individual test events; try to update badges from payload if available
          try{ 
            if (Array.isArray(payload.tests)){ 
              payload.tests.forEach(t=>{ 
                const idx=getTestIndexByName(t.name||t.Name); 
                const st=(t.status||t.Status||'').toLowerCase(); 
                const msgs = t.messages || t.Messages || [];
                if (idx>=0) updateTestBadgeByIndex(idx, st, msgs); 
              }); 
            } 
          }catch{}
        } else if (type === 'error'){
          appendQuickRunLine('Error: '+(payload.error||''), 'text-error');
          setSuiteRecord('failed', 0, [payload.error||'']);
        } else if (type === 'done'){
          appendQuickRunLine('Done.'); es.close();
        }
      }catch(e){ console.error('stream parse', e); }
    };
    es.onerror = ()=>{ es.close(); appendQuickRunLine('Run failed or connection lost', 'text-error'); };
  }
  
  modal.querySelector('#ed_validate').onclick = async ()=>{ 
    try{
      collectFormData();
      let raw = '';
      if (window.hydreqEditorYAML && window.hydreqEditorYAML.getText) raw = window.hydreqEditorYAML.getText();
      else if (yamlEditor && yamlEditor.getValue) raw = yamlEditor.getValue();
      else raw = await serializeWorkingToYamlImmediate();
      const response = await fetch('/api/editor/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ raw }) });
      if (!response.ok) throw new Error('HTTP '+response.status);
      const v = await response.json(); renderIssues(v.issues || v.errors || [], v.yaml || raw);
      const vb = modal.querySelector('#ed_validation_box'); if (vb) vb.open = true;
    }catch(e){ console.error(e); renderIssues([{ message: e.message }]); }
  };

  // Run suite button
  const runSuiteBtn = modal.querySelector('#ed_run_suite');
  if (runSuiteBtn){ runSuiteBtn.onclick = async ()=>{
    try{
      collectFormData(); const env = parseEnvFromPage();
      clearQuickRun(); appendQuickRunLine('Starting suite...', 'dim');
      // Try modular quick-run first
      try { if (window.hydreqEditorState && window.hydreqEditorState.setWorking) window.hydreqEditorState.setWorking(working); } catch {}
      let started = false;
      try{
        if (window.hydreqEditorRun && typeof window.hydreqEditorRun.quickRun === 'function'){
          const runId = await window.hydreqEditorRun.quickRun({ runAll: true, includeDeps: true });
          if (runId){ listenToQuickRun(runId, working.name || 'suite'); started = true; }
        }
      }catch{}
      if (!started){
        const response = await fetch('/api/editor/testrun', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parsed: working, env, runAll: true, includeDeps: true }) });
        if (!response.ok){ let txt=''; try{ txt=await response.text(); }catch{} throw new Error('HTTP '+response.status+(txt?(': '+txt):'')); }
        const data = await response.json();
        if (data && data.runId){ listenToQuickRun(data.runId, working.name || 'suite'); }
        else { renderImmediateRunResult(data, working.name || 'suite'); updateBadgesFromSuiteResult(data); setSuiteRecord((data.status||'').toLowerCase(), data.durationMs||0, data.messages||[]); }
      }
    }catch(e){ console.error(e); appendQuickRunLine('Suite run failed: '+e.message, 'text-error'); }
  }; }

  // Copy Issues button
  const copyIssuesBtn = modal.querySelector('#ed_copy_issues');
  if (copyIssuesBtn){ copyIssuesBtn.onclick = async ()=>{ try{ const el = modal.querySelector('#ed_issues'); const txt = el? el.innerText : ''; await navigator.clipboard.writeText(txt); copyIssuesBtn.textContent='Copied'; setTimeout(()=> copyIssuesBtn.textContent='Copy', 1200); }catch(e){ console.error('Copy failed', e); } }; }
  
  // At top of openEditor() after computing working and modal existence
  const isNewFile = !!(data && data._new);
  try{ const bannerWrap = modal.querySelector('#ed_new_banner'); if (isNewFile && !bannerWrap){ const b = document.createElement('div'); b.id='ed_new_banner'; b.className='pill'; b.style.background='#eef6ff'; b.style.color='#0369a1'; b.style.marginRight='8px'; b.textContent = 'New suite (will create file at ' + path + ')'; const headerLeft = modal.querySelector('.ed-header-left'); if (headerLeft) headerLeft.insertBefore(b, headerLeft.firstChild); } }catch(e){}
  try{ const saveBtn = modal.querySelector('#ed_save'); const saveCloseBtn = modal.querySelector('#ed_save_close'); if (isNewFile){ if (saveBtn) saveBtn.textContent = 'Create'; if (saveCloseBtn) saveCloseBtn.textContent = 'Create & Close'; modal.dataset.isNew = '1'; } else { modal.dataset.isNew = '0'; } }catch{}

  // Enhanced save handler: validate and re-check existence before saving
  modal.querySelector('#ed_save').onclick = async ()=>{ 
    try {
      collectFormData();
      // Prefer saving raw YAML from editor to preserve formatting; fallback to serialize
      let yamlData = '';
      try{
        if (yamlCtl && yamlCtl.getText) yamlData = yamlCtl.getText();
        else if (window.hydreqEditorYAML && window.hydreqEditorYAML.getText) yamlData = window.hydreqEditorYAML.getText();
        else yamlData = await serializeWorkingToYamlImmediate();
      }catch{ yamlData = await serializeWorkingToYamlImmediate(); }
      // If still empty, attempt a final serialization; otherwise abort save
      if (!yamlData || !yamlData.trim()){
        try{ yamlData = await serializeWorkingToYamlImmediate(); }catch{}
      }
      if (!yamlData || !yamlData.trim()){
        alert('Nothing to save: YAML is empty.');
        return;
      }

      // Re-check path existence to guard against race conditions
      try{
        if (modal.dataset.isNew === '1'){
          const ck = await fetch('/api/editor/checkpath', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path }) });
          if (ck.ok){ const info = await ck.json(); if (info.exists){ if (!confirm('File was created on disk since you opened the editor. Overwrite?')) return; } }
        }
      }catch(e){ /* ignore checkpath on dev builds */ }

      // Validate before saving; surface warnings/errors
      try{
        const valRes = await fetch('/api/editor/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ raw: yamlData }) });
        if (valRes.ok){ const v = await valRes.json(); const issues = v.issues || v.errors || [];
          if (Array.isArray(issues) && issues.length){
            const txt = issues.slice(0,8).map(i=>i.message||JSON.stringify(i)).join('\n');
            if (!confirm('Validation returned issues:\n' + txt + '\n\nProceed and save anyway?')) return;
          }
        }
      }catch(e){ /* validation failed to run; allow save but warn */ if(!confirm('Validation failed to run. Proceed to save?')) return; }

      // Send to save endpoint (backend expects `raw` to preserve formatting)
      const response = await fetch('/api/editor/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ path: path, raw: yamlData })
      });
      
      if (response.ok) {
        alert('✓ Suite saved successfully');
  // Update baseline to latest YAML and recompute dirty
  try{ yamlCtl && yamlCtl.setText && yamlCtl.setText(yamlData||''); yamlCtl && yamlCtl.resetBaseline && yamlCtl.resetBaseline(); }catch{}
        // If this was a new file, update UI state so subsequent saves are normal
        if (modal.dataset.isNew === '1'){
          modal.dataset.isNew = '0';
          if (saveBtn) saveBtn.textContent = 'Save'; if (saveCloseBtn) saveCloseBtn.textContent = 'Save & Close';
        }
      } else {
        const error = await response.text();
        alert('✗ Save failed: ' + error);
      }
    } catch (e) {
      console.error('Save failed:', e);
      alert('Save error: ' + e.message);
    }
  };
  
  // Save & Close also respects new-mode
  modal.querySelector('#ed_save_close').onclick = async ()=>{ 
    try {
      await modal.querySelector('#ed_save').onclick();
      if (!isDirty()) {
        attemptClose();
      }
    } catch (e) {
      console.error('Save and close failed:', e);
    }
  };
  
  // Prefer modal close() if available; otherwise fallback
  modal.querySelector('#ed_close').onclick = ()=> {
    try{
      if (isDirty() && !confirm('Discard unsaved changes?')) return;
      if (window.hydreqEditorModal && typeof window.hydreqEditorModal.close === 'function') window.hydreqEditorModal.close();
      else attemptClose();
    }catch{}
  };
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
        setTestRecord(nm, st, dur, Array.isArray(msgs)?msgs:[]);
        const idx = getTestIndexByName(nm);
        if (idx>=0) updateTestBadgeByIndex(idx, st, Array.isArray(msgs)?msgs:[]);
      });
      // Suite-level record based on summary or badge
      if (summary && summary.summary){
        const s = summary.summary; const st = ((s.failed||0)>0)?'failed':(((s.passed||0)>0)?'passed':(((s.skipped||0)>0)?'skipped':'unknown'));
        setSuiteRecord(st, s.durationMs||0, []);
      } else if (badgeStatus && badgeStatus!=='unknown'){
        setSuiteRecord(badgeStatus, 0, []);
      }
      // Refresh Quick run pane for current selection
      try{ renderQuickRunForSelection(); }catch{}
    }
  }catch(e){}

  // Note: Removed handlers for non-modal controls (clearLog/download buttons) to avoid referencing missing elements here.
  // Initial population of suites list
  try{ if (typeof window.refresh === 'function') window.refresh(); }catch{}
}

// Expose to window for backward compatibility
window.openEditor = openEditor;