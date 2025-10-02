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
const LS_VER = 'v1';
const LS_ENC = (s) => { try { return btoa(unescape(encodeURIComponent(s||''))); } catch { return (s||''); } };
const LS_KEY = (p) => `hydreq.${LS_VER}.runCache:` + LS_ENC(p||'');
const RUNREC_KEY = (p) => `hydreq.${LS_VER}.editorRun:` + LS_ENC(p||'');

// Global renderForm function that can be called from renderTests
function renderForm() {
  if (!modal || !working) return;
  
  // Update suite-level fields
  const suiteNameEl = modal.querySelector('#ed_suite_name');
  const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
  const authBearerEl = modal.querySelector('#ed_auth_bearer');
  const authBasicEl = modal.querySelector('#ed_auth_basic');
  
  if (suiteNameEl) suiteNameEl.value = working.name || '';
  if (baseUrlEl) baseUrlEl.value = working.baseUrl || working.baseURL || '';
  // Use bearerEnv/basicEnv keys consistently with Suite model
  if (authBearerEl) authBearerEl.value = (working.auth && (working.auth.bearerEnv || working.auth.bearer)) || '';
  if (authBasicEl) authBasicEl.value = (working.auth && (working.auth.basicEnv || working.auth.basic)) || '';
  
  // Update test-specific fields if a test is selected
  if (working.tests && Array.isArray(working.tests) && selIndex >= 0 && selIndex < working.tests.length) {
    const test = working.tests[selIndex];
    const testNameEl = modal.querySelector('#ed_test_name');
    const methodEl = modal.querySelector('#ed_method');
    const urlEl = modal.querySelector('#ed_url');
    const timeoutEl = modal.querySelector('#ed_timeout');
    const bodyEl = modal.querySelector('#ed_body');
    
    if (testNameEl) testNameEl.value = test.name || '';
    if (methodEl && test.request) methodEl.value = test.request.method || 'GET';
    if (urlEl && test.request) urlEl.value = test.request.url || '';
    if (timeoutEl && test.request) timeoutEl.value = test.request.timeout || '';
    if (bodyEl && test.request) {
      try {
        const body = test.request.body;
        if (body && typeof body === 'object') {
          bodyEl.value = JSON.stringify(body, null, 2);
        } else {
          bodyEl.value = body || '';
        }
      } catch (e) {
        bodyEl.value = test.request.body || '';
      }
    }
    
    // Update assertions
    if (test.assert) {
      const statusEl = modal.querySelector('#ed_assert_status');
      const maxDurationEl = modal.querySelector('#ed_assert_maxDuration');
      
      if (statusEl) statusEl.value = test.assert.status || '';
      if (maxDurationEl) maxDurationEl.value = test.assert.maxDurationMs || test.assert.maxDuration || '';
    }
    
    // Update flow settings: don't prefill 0; clear when unset
    const stageEl = modal.querySelector('#ed_stage');
    if (stageEl) stageEl.value = test.stage || 0;
    
    const skipEl = modal.querySelector('#ed_skip');
    const onlyEl = modal.querySelector('#ed_only');
    if (skipEl) skipEl.checked = test.skip || false;
    if (onlyEl) onlyEl.checked = test.only || false;
  }
  
  // Add validation event listeners after a short delay to ensure DOM is ready
  setTimeout(() => {
    addValidationListeners();
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
  
  if (suiteNameEl) working.name = suiteNameEl.value;
  if (baseUrlEl) working.baseUrl = baseUrlEl.value;
  
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
    if (test.assert && Object.keys(test.assert).length === 0) delete test.assert;
    // Flags and meta: only include when set
    if (skipEl) { if (skipEl.checked) test.skip = true; else delete test.skip; }
    if (onlyEl) { if (onlyEl.checked) test.only = true; else delete test.only; }
    if (stageEl) {
      const stg = stageEl.value ? parseInt(stageEl.value,10) : NaN;
      if (!isNaN(stg)) test.stage = stg; else delete test.stage;
    }
  }
}

function addValidationListeners() {
  if (!modal) return;
  
  // Set up fields for real-time YAML mirroring
  const formFields = [
    '#ed_suite_name', '#ed_suite_baseurl', '#ed_auth_bearer', '#ed_auth_basic',
    '#ed_test_name', '#ed_url', '#ed_method', '#ed_timeout', '#ed_body',
    '#ed_assert_status', '#ed_assert_maxDuration', '#ed_stage'
  ];
  
  formFields.forEach(selector => {
    const el = modal.querySelector(selector);
    if (el) {
      el.addEventListener('input', () => {
        try {
          collectFormData();
          mirrorYamlFromVisual();
        } catch (e) {
          console.warn('Error mirroring YAML on input:', e);
        }
      });
    }
  });
  
  // Add listeners for checkboxes and select elements
  const toggleFields = ['#ed_skip', '#ed_only'];
  toggleFields.forEach(selector => {
    const el = modal.querySelector(selector);
    if (el) {
      el.addEventListener('change', () => {
        try {
          collectFormData();
          mirrorYamlFromVisual();
        } catch (e) {
          console.warn('Error mirroring YAML on change:', e);
        }
      });
    }
  });
}

// Schema validation for real-time feedback
function validateField(fieldName, value, parentType = 'suite') {
  const errors = [];
  
  // Required fields validation based on schema
  if (parentType === 'suite') {
    if (fieldName === 'name' && (!value || value.trim() === '')) {
      errors.push('Suite name is required');
    }
    if (fieldName === 'baseUrl' && (!value || value.trim() === '')) {
      errors.push('Base URL is required');
    }
  }
  
  if (parentType === 'test') {
    if (fieldName === 'name' && (!value || value.trim() === '')) {
      errors.push('Test name is required');
    }
  }
  
  if (parentType === 'request') {
    if (fieldName === 'method' && (!value || value.trim() === '')) {
      errors.push('HTTP method is required');
    }
    if (fieldName === 'url' && (!value || value.trim() === '')) {
      errors.push('URL path is required');
    }
  }
  
  if (parentType === 'assert') {
    if (fieldName === 'status' && (!value || isNaN(parseInt(value)))) {
      errors.push('Status code must be a valid number');
    }
    if (fieldName === 'status' && value && (parseInt(value) < 100 || parseInt(value) > 599)) {
      errors.push('Status code must be between 100-599');
    }
  }
  
  // URL validation
  if (fieldName === 'baseUrl' && value && value.trim()) {
    try {
      new URL(value.trim());
    } catch {
      errors.push('Base URL must be a valid URL');
    }
  }
  
  // Numeric validation
  if (['timeout', 'maxDurationMs', 'stage', 'repeat'].includes(fieldName) && value && value.trim()) {
    if (isNaN(parseInt(value)) || parseInt(value) < 0) {
      errors.push(`${fieldName} must be a positive number`);
    }
  }
  
  return errors;
}

// Show validation feedback on a field
function showFieldValidation(element, errors) {
  // Remove existing validation styling
  element.classList.remove('border-red-500', 'border-green-500');
  
  // Remove existing error messages
  const existingError = element.parentNode.querySelector('.validation-error');
  if (existingError) existingError.remove();
  
  if (errors.length > 0) {
    // Add error styling
    element.style.borderColor = '#ef4444';
    element.style.borderWidth = '2px';
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'validation-error';
    errorDiv.style.color = '#ef4444';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.marginTop = '2px';
    errorDiv.textContent = errors[0]; // Show first error
    element.parentNode.insertBefore(errorDiv, element.nextSibling);
  } else {
    // Add success styling for required fields
    element.style.borderColor = '#10b981';
    element.style.borderWidth = '1px';
  }
}

  // Render the test list in the editor modal
function renderTests() {
  const testsEl = modal.querySelector('#ed_tests');
  if (!testsEl) return;

  testsEl.innerHTML = '';

  if (!working.tests || !Array.isArray(working.tests)) return;

  working.tests.forEach((test, index) => {
    // Create a container for the test item and its details
    const testContainer = document.createElement('div');
    testContainer.className = 'ed-test-container';
    
    // Create the main test item row
    const testDiv = document.createElement('div');
    testDiv.className = 'ed-test-item';
    testDiv.dataset.index = String(index);
    if (index === selIndex) {
      testDiv.classList.add('selected');
    }

    // Test name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'ed-test-name';
    nameSpan.textContent = test.name || `test ${index + 1}`;
    testDiv.appendChild(nameSpan);

    // Run status badge
    const key = index + ':' + (test.name || ('test ' + (index + 1)));
    const result = testRunCache.get(key);
    let statusBadge = null;
    if (result && result.status) {
      statusBadge = document.createElement('span');
      statusBadge.className = 'status-badge ed-test-status';
      if (result.status === 'passed') {
        statusBadge.classList.add('status-ok');
        statusBadge.textContent = '✓';
      } else if (result.status === 'failed') {
        statusBadge.classList.add('status-fail');
        statusBadge.textContent = '✗';
      } else if (result.status === 'skipped') {
        statusBadge.classList.add('status-skip');
        statusBadge.textContent = '○';
      } else {
        statusBadge.classList.add('status-unknown');
        statusBadge.textContent = '·';
      }
      statusBadge.title = result.status;
    }

    // Inline delete (trashcan)
    const del = document.createElement('button');
    del.className = 'btn btn-ghost btn-xs';
    del.title = 'Delete test';
    del.setAttribute('aria-label', 'Delete test');
    del.textContent = '🗑';
    del.onclick = async (e)=>{
      e.preventDefault(); e.stopPropagation();
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
    };

    // Click handler to select test
    testDiv.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try{ if (typeof window.selectTestByIndex==='function') window.selectTestByIndex(index); }catch{}
    };

    // Right side controls container
    const right = document.createElement('span'); right.className = 'ed-row-6 ed-ai-center';
    if (statusBadge) right.appendChild(statusBadge);
    right.appendChild(del);
    testDiv.appendChild(right);
    
    // Add the main row to the container
    testContainer.appendChild(testDiv);
    
    // Check if we need to add collapsible details row
    if (result && result.status && (result.status === 'failed' || result.status === 'skipped')) {
      const details = document.createElement('details');
      details.className = 'ed-test-details';
      const sum = document.createElement('summary'); sum.textContent = 'details'; details.appendChild(sum);
      const pre = document.createElement('pre'); pre.className = 'message-block ' + (result.status==='failed'?'fail':'skip'); pre.textContent = (Array.isArray(result.messages) && result.messages.length) ? result.messages.join('\n') : 'skipped';
      details.appendChild(pre);
      testContainer.appendChild(details);
    }

    testsEl.appendChild(testContainer);
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

// Create a key-value table for editing
function kvTable(container, obj, onChange){
  const c = (typeof container === 'string') ? modal.querySelector(container) : container;
  c.innerHTML = '';
  const table = document.createElement('div');
  const addRow = (k='', v='')=>{
    const row = document.createElement('div'); row.className = 'ed-grid-1-1-auto'; row.style.marginBottom='6px';
    const ki = document.createElement('input'); ki.type='text'; ki.value=k; const vi=document.createElement('input'); vi.type='text'; vi.value=v;
    if (onChange){ ['input','change','blur'].forEach(ev=>{ ki.addEventListener(ev, onChange); vi.addEventListener(ev, onChange); }); }
    const del = document.createElement('button'); del.textContent='×'; del.title='Remove'; del.onclick = ()=>{ row.remove(); if (onChange) onChange(); };
    row.appendChild(ki); row.appendChild(vi); row.appendChild(del);
    table.appendChild(row);
  };
  // populate
  if (obj){ Object.keys(obj).forEach(k=> addRow(k, obj[k])); }
  const add = document.createElement('button'); add.textContent='Add'; add.onclick = ()=> { addRow(); if (onChange) onChange(); };
  c.appendChild(table); c.appendChild(add);
  return ()=>{
    const rows = Array.from(table.children);
    const out = {};
    rows.forEach(row=>{
      const inputs = row.querySelectorAll('input');
      if (inputs.length>=2){ const k=inputs[0].value.trim(); const v=inputs[1].value; if (k) out[k]=v; }
    });
    return out;
  };
}

// Create a list table for editing arrays
function listTable(container, arr, onChange){
  const c = (typeof container === 'string') ? modal.querySelector(container) : container;
  c.innerHTML = '';
  const table = document.createElement('div');
  const addRow = (v='')=>{
    const row = document.createElement('div'); row.className = 'ed-grid-1-auto'; row.style.marginBottom='6px';
    const vi=document.createElement('input'); vi.type='text'; vi.value=v;
    if (onChange){ ['input','change','blur'].forEach(ev=> vi.addEventListener(ev, onChange)); }
    const del = document.createElement('button'); del.textContent='×'; del.title='Remove'; del.onclick = ()=>{ row.remove(); if (onChange) onChange(); };
    row.appendChild(vi); row.appendChild(del);
    table.appendChild(row);
  };
  if (Array.isArray(arr)) arr.forEach(v=> addRow(v));
  const add = document.createElement('button'); add.textContent='Add'; add.onclick = ()=> { addRow(); if (onChange) onChange(); };
  c.appendChild(table); c.appendChild(add);
  return ()=>{
    const rows = Array.from(table.children);
    const out = [];
    rows.forEach(row=>{ const inp = row.querySelector('input'); if (inp){ const v = inp.value; if (v!=='' && v!=null) out.push(v); }});
    return out;
  };
}

// Create a map table (similar to kvTable)
function mapTable(container, obj, valuePlaceholder='value', onChange){
  // Like kvTable, but for arbitrary value types (free text) and returns map[string]string-like
  return kvTable(container, obj||{}, onChange);
}

// Create a matrix editor for data-driven test expansion
function renderMatrix(container, matrix, onChange) {
  const c = (typeof container === 'string') ? modal.querySelector(container) : container;
  c.innerHTML = '';
  
  const table = document.createElement('div');
  table.className = 'ed-matrix-table';
  
  function addRow(key = '', values = []) {
    const row = document.createElement('div');
    row.className = 'ed-matrix-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '120px 1fr 40px';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';
    row.style.alignItems = 'start';
    
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
      valueDiv.style.display = 'flex';
      valueDiv.style.gap = '4px';
      valueDiv.style.marginBottom = '4px';
      
      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.placeholder = 'Value';
      valueInput.value = value;
      valueInput.style.flex = '1';
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
    addValueBtn.className = 'btn btn-xs btn-secondary';
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

// Create a hook list editor
function hookList(container, hooks, options, onChange){
  const c = (typeof container==='string') ? modal.querySelector(container) : container;
  c.innerHTML = '';
  const list = document.createElement('div'); c.appendChild(list);
  const empty = document.createElement('div'); empty.className='dim'; empty.style.margin='6px 0'; empty.textContent = 'No hooks yet. Pick a mode, then Add.'; c.appendChild(empty);
  const actions = document.createElement('div'); actions.className='ed-row-6'; actions.style.marginTop='6px';
  const sel = document.createElement('select'); sel.className='select select-xs'; sel.innerHTML = '<option value="http">HTTP</option><option value="sql">SQL</option><option value="js">JS</option><option value="empty">Empty</option>';
  const add = document.createElement('button'); add.textContent='Add'; add.className='btn btn-xs'; add.title='Add hook';
  add.onclick = ()=>{
    const v = sel.value;
    if (v==='http') addRow({ __mode:'http', request: { method:'GET', url:'', headers:{}, query:{}, body:'' } });
    else if (v==='sql') addRow({ __mode:'sql', sql: { driver:'', dsn:'', query:'', extract:{} } });
    else if (v==='js') addRow({ __mode:'js', js: { code:'' } });
    else addRow({ __mode:'empty' });
    try{ if (onChange) onChange(); }catch{}
  };
  actions.appendChild(sel); actions.appendChild(add); c.appendChild(actions);

  function addRow(h){
    const row = document.createElement('div'); row.style.border='1px solid var(--bd)'; row.style.borderRadius='6px'; row.style.marginBottom='8px';
    // mode
    const mode = h && h.__mode ? h.__mode : (h && h.sql ? 'sql' : (h && h.request ? 'http' : (h && h.js ? 'js' : 'empty')));
    row._mode = mode;
    // header
    const header = document.createElement('div'); header.className='ed-row-6 ed-ai-center'; header.style.padding='6px 8px'; header.style.background='var(--pill)'; header.style.borderBottom='1px solid var(--bd)';
    const toggle = document.createElement('button'); toggle.textContent='▾'; toggle.className='btn btn-ghost btn-xs'; toggle.style.width='24px';
    const nameI = document.createElement('input'); nameI.className='hk_name'; nameI.type='text'; nameI.placeholder='hook name'; nameI.value=h?.name||''; nameI.style.flex='1';
    const badge = document.createElement('span'); badge.className='badge hk_type'; badge.textContent = (mode==='http'?'HTTP':(mode==='sql'?'SQL':(mode==='js'?'JS':'·')));
    const runBtn = document.createElement('button'); runBtn.className='btn btn-xs hk_run'; runBtn.textContent='Run';
    const convertBtn = document.createElement('button'); convertBtn.className='btn btn-xs'; convertBtn.textContent='Convert…'; convertBtn.title='Switch mode';
    const delBtn = document.createElement('button'); delBtn.className='btn btn-xs hk_del'; delBtn.textContent='×'; delBtn.title='Remove';
    header.appendChild(toggle); header.appendChild(nameI); header.appendChild(badge); header.appendChild(runBtn); header.appendChild(convertBtn); header.appendChild(delBtn);
    row.appendChild(header);
    const body = document.createElement('div'); body.style.padding='8px'; row.appendChild(body);
    // grid
    const grid = document.createElement('div'); grid.className='ed-grid-2-140'; body.appendChild(grid);
    // Vars
    const varsLabel = document.createElement('label'); varsLabel.textContent='Vars'; const varsDiv=document.createElement('div'); varsDiv.className='hk_vars'; grid.appendChild(varsLabel); grid.appendChild(varsDiv);
    const varsGet = kvTable(varsDiv, h?.vars||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} });
    // HTTP section
    const httpLabel = document.createElement('label'); httpLabel.textContent='HTTP'; const httpC = document.createElement('div'); httpC.className='hk_http'; grid.appendChild(httpLabel); grid.appendChild(httpC);
    const http = h?.request||{}; const hg = document.createElement('div'); hg.style.display='grid'; hg.style.gridTemplateColumns='120px 1fr'; hg.style.gap='6px';
    hg.innerHTML = `
      <label>Method</label>
      <select class="hk_method select select-xs"></select>
      <label>URL</label><input class="hk_url" type="text" value="${http.url||''}">
      <label>Headers</label><div class="hk_headers"></div>
      <label>Query</label><div class="hk_query"></div>
      <label>Body</label><textarea class="hk_body" style="height:80px"></textarea>`;
    httpC.appendChild(hg);
    // populate method options safely
    (function(){
      const sel = hg.querySelector('.hk_method');
      const cur = String((http.method||'').toUpperCase());
      ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].forEach(m=>{
        const o=document.createElement('option'); o.value=m; o.textContent=m; if (cur===m) o.selected=true; sel.appendChild(o);
      });
    })();
    const hkHeadGet = kvTable(hg.querySelector('.hk_headers'), http.headers||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} });
    const hkQueryGet = kvTable(hg.querySelector('.hk_query'), http.query||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} });
    const bodyEl = hg.querySelector('.hk_body'); try { bodyEl.value = (http.body && typeof http.body==='object')? JSON.stringify(http.body,null,2):(http.body||''); } catch { bodyEl.value = http.body||''; }
    // JS section
    const jsLabel = document.createElement('label'); jsLabel.textContent='JS'; const jsC = document.createElement('div'); jsC.className='hk_js'; grid.appendChild(jsLabel); grid.appendChild(jsC);
    const js = h?.js||{}; const jsg = document.createElement('div'); jsg.style.display='grid'; jsg.style.gridTemplateColumns='120px 1fr'; jsg.style.gap='6px';
    jsg.innerHTML = `
      <label>Code</label><textarea class="hk_js_code" style="height:120px; font-family: 'Courier New', monospace; font-size: 12px;" placeholder="JavaScript code...">${js.code||''}</textarea>`;
    jsC.appendChild(jsg);
    // SQL section
    const sqlLabel = document.createElement('label'); sqlLabel.textContent='SQL'; const sqlC = document.createElement('div'); sqlC.className='hk_sql'; grid.appendChild(sqlLabel); grid.appendChild(sqlC);
    const sql = h?.sql||{}; const sg = document.createElement('div'); sg.style.display='grid'; sg.style.gridTemplateColumns='120px 1fr'; sg.style.gap='6px';
    sg.innerHTML = `
      <label>Driver</label>
      <select class="hk_driver select select-xs"><option value="">(select)</option><option value="sqlite" ${sql.driver==='sqlite'?'selected':''}>sqlite</option><option value="pgx" ${sql.driver==='pgx'?'selected':''}>pgx (Postgres)</option><option value="sqlserver" ${sql.driver==='sqlserver'?'selected':''}>sqlserver (SQL Server)</option></select>
      <label>DSN</label>
      <div style="display:flex;gap:6px;align-items:center"><input class="hk_dsn" type="password" value="${sql.dsn||''}" style="flex:1" placeholder="file:./qa.sqlite?cache=shared"><button class="hk_toggle_dsn" type="button" title="Show/Hide">👁</button><button class="hk_fill_dsn" type="button" title="Fill template">Use template</button></div>
      <label>Query</label><textarea class="hk_querytxt" style="height:80px">${sql.query||''}</textarea>
      <label>Extract</label><div class="hk_sqlextract"></div>`;
    sqlC.appendChild(sg);
    const toggleBtn = sg.querySelector('.hk_toggle_dsn'); const dsnInput = sg.querySelector('.hk_dsn'); toggleBtn.onclick = ()=>{ dsnInput.type = (dsnInput.type==='password'?'text':'password'); };
    const hkSQLExtractGet = kvTable(sg.querySelector('.hk_sqlextract'), sql.extract||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} });
    const driverEl = sg.querySelector('.hk_driver'); const dsnEl = sg.querySelector('.hk_dsn'); const dsnPH = { sqlite: 'file:./qa.sqlite?cache=shared', pgx: 'postgres://user:pass@localhost:5432/db?sslmode=disable', sqlserver: 'sqlserver://sa:Your_password123@localhost:1433?database=master' };
    function refreshDsnPH(){ const v=(driverEl.value||'').trim(); dsnEl.placeholder = dsnPH[v]||''; }
    driverEl.addEventListener('change', refreshDsnPH); refreshDsnPH();
    const fillBtn = sg.querySelector('.hk_fill_dsn'); if (fillBtn) fillBtn.onclick = ()=>{ const v=(driverEl.value||'').trim(); const tmpl=dsnPH[v]||''; if(!tmpl) return; if(!dsnEl.value || confirm('Overwrite DSN with template?')) dsnEl.value = tmpl; };
    // enforce mode visibility
    function applyMode(){
      const showHTTP = (row._mode==='http');
      const showSQL = (row._mode==='sql');
      const showJS = (row._mode==='js');
      httpLabel.style.display = showHTTP?'':'none'; httpC.style.display = showHTTP?'':'none';
      sqlLabel.style.display = showSQL?'':'none'; sqlC.style.display = showSQL?'':'none';
      jsLabel.style.display = showJS?'':'none'; jsC.style.display = showJS?'':'none';
      badge.textContent = (row._mode==='http'?'HTTP':(row._mode==='sql'?'SQL':(row._mode==='js'?'JS':'·')));
    }
    applyMode();
    // header collapse
    toggle.onclick = ()=>{ const open = body.style.display !== 'none'; body.style.display = open?'none':'block'; toggle.textContent = open?'▸':'▾'; };
    // badge color and updates
    function refreshBadge(){
      badge.classList.remove('badge-info','badge-secondary','badge-success');
      if (row._mode==='http') badge.classList.add('badge-info');
      else if (row._mode==='sql') badge.classList.add('badge-secondary');
      else if (row._mode==='js') badge.classList.add('badge-success');
    }
    refreshBadge();
    // convert mode
    convertBtn.onclick = ()=>{ const to = prompt('Convert to mode: http, sql, or js?', row._mode); const v=(to||'').trim().toLowerCase(); if (v!=='http' && v!=='sql' && v!=='js') return; if(!confirm('Switch mode to '+v+'?')) return; row._mode=v; applyMode(); refreshBadge(); };
    // delete
    delBtn.onclick = ()=> row.remove();
    // output area
    const out = document.createElement('div'); out.className='log'; out.style.marginTop='8px'; body.appendChild(out);
    // run
    runBtn.onclick = async ()=>{
      const req={ method: (hg.querySelector('.hk_method').value||'').toUpperCase(), url: hg.querySelector('.hk_url').value||'', headers: hkHeadGet(), query: hkQueryGet(), body: (function(txt){ try{ return txt?JSON.parse(txt):null }catch{return txt} })(bodyEl.value.trim()) };
      const sql={ driver: driverEl.value||'', dsn: dsnEl.value||'', query: (sg.querySelector('.hk_querytxt').value||''), extract: hkSQLExtractGet() };
      const js = { code: (jsg.querySelector('.hk_js_code').value || '') };
      const name = nameI.value||''; const vars = varsGet(); const payload = { name, vars };
      if (row._mode==='http') payload.request = req; else if (row._mode==='sql') payload.sql = sql; else if (row._mode==='js') payload.js = js;
  const env = (typeof parseEnv==='function') ? parseEnv() : {};
      const scope = (options && options.scope) || 'suitePre';
      out.innerHTML = 'Running...';
      let res; try { res = await fetch('/api/editor/hookrun', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parsed: working, scope, testIndex: selIndex, hook: payload, env })}); } catch(e){ out.textContent = 'Network error'; return; }
      if (!res.ok){ const t=await res.text().catch(()=> ''); out.textContent = 'Run failed: ' + t; return; }
      const r = await res.json(); const icon = r.status==='passed'?'✓':(r.status==='failed'?'✗':'-'); const hdr = document.createElement('div'); hdr.style.fontWeight='600'; hdr.textContent = `${icon} hook ${r.name||''} (${r.durationMs||0} ms)`; out.innerHTML=''; out.appendChild(hdr);
  if (Array.isArray(r.messages) && r.messages.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (r.status==='failed'?'fail':(r.status==='skipped'?'skip':'ok')); pre.textContent = r.messages.join('\n'); det.appendChild(pre); out.appendChild(det); }
      if (r.vars && Object.keys(r.vars).length){ const det=document.createElement('details'); const sum=document.createElement('summary'); sum.textContent='vars'; det.appendChild(sum); const pre=document.createElement('pre'); pre.textContent = JSON.stringify(r.vars,null,2); det.appendChild(pre); out.appendChild(det); }
    };
    // getter
    row._get = ()=>{ const name = nameI.value||''; const vars = varsGet(); const out = { name, vars }; if (row._mode==='http'){ const req={ method: (hg.querySelector('.hk_method').value||'').toUpperCase(), url: hg.querySelector('.hk_url').value||'', headers: hkHeadGet(), query: hkQueryGet(), body: (function(txt){ try{ return txt?JSON.parse(txt):null }catch{return txt} })(bodyEl.value.trim()) }; if (req.method||req.url||Object.keys(req.headers||{}).length||Object.keys(req.query||{}).length||bodyEl.value.trim()) out.request=req; } else if (row._mode==='sql'){ const sql={ driver: driverEl.value||'', dsn: dsnEl.value||'', query: (sg.querySelector('.hk_querytxt').value||''), extract: hkSQLExtractGet() }; if (sql.driver||sql.dsn||sql.query||Object.keys(sql.extract||{}).length) out.sql=sql; } else if (row._mode==='js'){ const js={ code: (jsg.querySelector('.hk_js_code').value || '') }; if (js.code.trim()) out.js=js; } return out; };
    list.appendChild(row);
  }
  // populate
  if (Array.isArray(hooks)) hooks.forEach(h=> addRow(h));
  return ()=> Array.from(list.children).map(r=> r._get ? r._get() : null).filter(Boolean);
}

// Open the editor modal for a given path and data
function openEditor(path, data){
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
  modal.querySelector('#ed_path').textContent = path;
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
  let inMemoryYaml = '';
  let baselineYaml = '';
  const densityToggle = modal.querySelector('#ed_density');
  const editorRoot = modal.querySelector('.editor-root');
  const splitter = modal.querySelector('#ed_splitter');
  const rightPane = splitter ? splitter.nextElementSibling : null;
  const __hadRaw = !!(data.raw && data.raw.trim() !== '');
  if (__hadRaw) {
    rawEl.value = data.raw;
    inMemoryYaml = data.raw;
  } else if (data.parsed) {
    try {
      const dumped = jsyaml.dump(data.parsed || {}, { noRefs: true, quotingType: '"' });
      inMemoryYaml = unquoteNumericKeys(dumped || '');
      rawEl.value = inMemoryYaml;
    } catch (e) {
      rawEl.value = '';
      inMemoryYaml = '';
    }
  } else {
    rawEl.value = '';
  }
  baselineYaml = inMemoryYaml || '';
  let yamlDirty = false;
  let yamlEditor = null;
  let __suppressDirty = false;
  function ensureYamlEditor(){
    if (yamlEditor) return yamlEditor;
    const rawEl = modal.querySelector('#ed_raw');
    if (!rawEl) { console.error('Raw editor textarea element not found'); return null; }
    if (window.hydreqEditorYAML && typeof window.hydreqEditorYAML.mount === 'function') {
      yamlEditor = window.hydreqEditorYAML.mount(rawEl);
      try { const el = yamlEditor && yamlEditor.getWrapperElement ? yamlEditor.getWrapperElement() : null; if (el) el.style.height = '100%'; } catch {}
      setTimeout(() => { try{ yamlEditor && yamlEditor.refresh && yamlEditor.refresh(); }catch{} }, 0);
      return yamlEditor;
    }
    // Fallback: no CodeMirror wrapper available
    yamlEditor = null;
    return null;
  }
  issuesEl.innerHTML = '';
  (function attachVisualDelegates(){
    const root = modal.querySelector('#pane_visual');
    if (!root) return;
    const handler = async ()=>{ try { sync(); await mirrorYamlFromVisual(); } catch {} };
    root.addEventListener('input', ()=>{ handler(); }, true);
    root.addEventListener('change', ()=>{ handler(); }, true);
    root.addEventListener('click', (e)=>{ const t = e.target; if (!t) return; if ((t.tagName && t.tagName.toLowerCase()==='button') || t.closest('button')) { handler(); } }, true);
  })();
  selIndex = 0;
  const persisted = (function(){ try{ return JSON.parse(localStorage.getItem(LS_KEY(path))||'{}') }catch{ return {} } })();
  testRunCache = new Map(Object.entries(persisted));
  let lastSuiteRun = null;
  let dirty = false;
  function markDirty(){
    try{
      // Compute dirty by comparing to baseline YAML
      const cur = yamlEditor
        ? ((window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
            ? window.hydreqEditorYAML.getText()
            : (yamlEditor.getValue ? yamlEditor.getValue() : inMemoryYaml))
        : inMemoryYaml;
      const isDirty = (baselineYaml || '') !== (cur || '');
      dirty = isDirty;
      const di = modal && modal.querySelector && modal.querySelector('#ed_dirty_indicator');
      if (di) di.style.display = isDirty ? '' : 'none';
    }catch{}
  }
  // Wrap markDirty to respect suppression flag
  const __origMarkDirty = markDirty;
  markDirty = function(){ if (__suppressDirty) return; __origMarkDirty(); };
  function attemptClose(){ if (dirty && !confirm('Discard unsaved changes?')) return; modal.remove(); document.body.classList.remove('modal-open'); }
  async function serializeWorkingToYamlImmediate(){ 
    if (!working || !working.tests) return '';
    try { 
      // Clean up the working object to remove null/undefined/empty values
      const cleaned = cleanForSerialization(working);
      const yamlText = jsyaml.dump(cleaned, { noRefs: true, quotingType: '"' });
      return unquoteNumericKeys(yamlText || '');
    } catch (e) { 
      return ''; 
    }
  }
  
  // Clean up object for serialization - remove null/undefined/empty values
  function cleanForSerialization(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
      const cleaned = obj.map(cleanForSerialization).filter(item => item !== undefined);
      return cleaned.length > 0 ? cleaned : undefined;
    }
    if (typeof obj === 'object') {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = cleanForSerialization(value);
        if (cleanedValue !== undefined && cleanedValue !== '' && cleanedValue !== null) {
          // Don't include empty objects or arrays
          if (typeof cleanedValue === 'object' && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) {
            continue;
          }
          if (Array.isArray(cleanedValue) && cleanedValue.length === 0) {
            continue;
          }
          cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    // For primitive values, return as-is unless empty string
    return (obj === '') ? undefined : obj;
  }
  
  async function mirrorYamlFromVisual(force=false){ 
    try {
      // Before serializing, collect any current form data that might not be saved yet
      collectFormData();
      
      const yamlText = await serializeWorkingToYamlImmediate();
      if ((yamlEditor || window.hydreqEditorYAML) && (yamlText || force)) {
        const cur = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
          ? window.hydreqEditorYAML.getText()
          : (yamlEditor && yamlEditor.getValue ? yamlEditor.getValue() : '');
        const nonEmpty = (t)=> !!(t && String(t).trim() !== '');
        const toSet = nonEmpty(yamlText) ? yamlText : cur;
        if ((force && nonEmpty(toSet) && toSet !== cur) || (!force && nonEmpty(yamlText) && cur !== yamlText)) {
          __suppressDirty = true;
          if (window.hydreqEditorYAML && window.hydreqEditorYAML.setText) {
            window.hydreqEditorYAML.setText(toSet);
          } else if (yamlEditor && yamlEditor.setValue) {
            yamlEditor.setValue(toSet);
          }
          yamlDirty = false;
          __suppressDirty = false;
        }
        
        // Ensure the YAML editor is visible if toggle is checked
        const yamlToggle = modal.querySelector('#toggle_yaml');
        if (yamlToggle && yamlToggle.checked) {
          const yamlPane = modal.querySelector('#pane_yaml');
          if (yamlPane) {
            yamlPane.style.display = 'block';
          }
        }
      }
    } catch (e) {
      console.error('Failed to mirror YAML from visual:', e);
    }
    
    // Only mark dirty on actual user changes (not during programmatic sync)
    if (!__suppressDirty) markDirty();
    return true;
  }

  // Expose key helpers so handlers outside this closure (e.g., renderTests) can use them
  try{ window.__ed_mirrorYamlFromVisual = mirrorYamlFromVisual; }catch(e){}
  try{ window.__ed_ensureYamlEditor = ensureYamlEditor; }catch(e){}
  try{ window.__ed_sync = sync; }catch(e){}

  // Write YAML directly from current working model and mark as dirty
  async function writeYamlFromWorking(force=false){
    try{
      const yamlText = await serializeWorkingToYamlImmediate();
      // Update both CodeMirror and in-memory fallback to keep all paths consistent
      const rawEl = modal.querySelector('#ed_raw');
      if (yamlEditor) {
        __suppressDirty = true;
        const cur = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
          ? window.hydreqEditorYAML.getText()
          : (yamlEditor.getValue ? yamlEditor.getValue() : '');
        if (force || cur !== yamlText) {
          if (window.hydreqEditorYAML && window.hydreqEditorYAML.setText) window.hydreqEditorYAML.setText(yamlText); else if (yamlEditor.setValue) yamlEditor.setValue(yamlText);
        }
        __suppressDirty = false;
      } else if (rawEl) {
        rawEl.value = yamlText;
      }
      inMemoryYaml = yamlText;
      yamlDirty = true;
      if (!__suppressDirty) markDirty();
      const di = document.getElementById('ed_dirty_indicator'); if (di) di.style.display='';
    }catch(e){ console.warn('writeYamlFromWorking failed', e); }
  }
  try{ window.__ed_writeYamlFromWorking = writeYamlFromWorking; }catch(e){}
    
    // Note: variable/header/query/matrix collection happens within collectFormData()
  
  // Alias for collectFormData - used by event handlers
  const sync = collectFormData;
  
  const syncYamlPreviewFromVisual = debounce(()=>{ 
    // Always keep YAML updated since it's now always visible
    try { 
      mirrorYamlFromVisual(); 
    } catch(e){ 
      console.error('Error syncing YAML:', e); 
    } 
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
  
  async function validateRawAndApply(){ 
    if (!yamlEditor && !(window.hydreqEditorYAML && window.hydreqEditorYAML.getText)) return false;
    try {
      const rawText = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
        ? window.hydreqEditorYAML.getText()
        : (yamlEditor && yamlEditor.getValue ? yamlEditor.getValue() : '');
      const parsed = jsyaml.load(rawText);
      working = normalizeParsed(parsed);
      return true;
    } catch (e) {
      console.error('YAML validation failed:', e);
      return false;
    }
  }
  
  async function switchTab(which){ 
    if (which === 'visual') {
      // Switching TO Visual: Parse YAML and update visual forms
      if (yamlEditor || (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)) {
        try {
          const rawText = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
            ? window.hydreqEditorYAML.getText()
            : (yamlEditor && yamlEditor.getValue ? yamlEditor.getValue() : '');
          if (rawText.trim()) {
            const parsed = jsyaml.load(rawText);
            working = normalizeParsed(parsed);
            renderForm(); // Re-render the visual form with updated data
          }
        } catch (e) {
          console.warn('Failed to parse YAML when switching to visual:', e);
        }
      }
      
      // Both panes are always visible in the new layout
      // Nothing special needed
    } else if (which === 'yaml') {
      // Switching TO YAML: Serialize visual data to YAML
      try {
        await mirrorYamlFromVisual(true); // Force update the YAML editor
      } catch (e) {
        console.warn('Failed to serialize visual to YAML:', e);
      }
      
      // Ensure YAML editor is initialized
      ensureYamlEditor();
      if (yamlEditor) { setTimeout(() => { try{ yamlEditor.refresh && yamlEditor.refresh(); }catch{} }, 0); }
    }
    try { localStorage.setItem('hydreq.editor.tab', which); } catch {}
  }
  
  // Function to update visual editor from YAML editor
  function updateVisualFromYaml() {
    try {
      if (!yamlEditor && !(window.hydreqEditorYAML && window.hydreqEditorYAML.getText)) return false;
      const rawText = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText)
        ? window.hydreqEditorYAML.getText()
        : (yamlEditor && yamlEditor.getValue ? yamlEditor.getValue() : '');
      if (rawText.trim()) {
        const parsed = jsyaml.load(rawText);
        working = normalizeParsed(parsed);
        renderForm(); // Re-render the visual form with updated data
        return true;
      }
    } catch (e) {
      console.error('Failed to update visual from YAML:', e);
    }
    return false;
  }

  // No need for YAML toggle - YAML editor is always visible
  const yamlPane = modal.querySelector('#pane_yaml');
  
  // Ensure YAML editor is setup and visible
  setTimeout(() => {
    ensureYamlEditor();
    try{ syncEditorTheme(); }catch{}
    __suppressDirty = true;
    if (__hadRaw) { try { updateVisualFromYaml(); } catch {} } else { mirrorYamlFromVisual(true); }
    try{ if (yamlEditor && yamlEditor.refresh) yamlEditor.refresh(); }catch{}
    __suppressDirty = false;
    // After async init, reset baseline and clear dirty indicator
    try{
      const curYaml = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText) ? window.hydreqEditorYAML.getText() : (yamlEditor && yamlEditor.getValue ? yamlEditor.getValue() : inMemoryYaml);
      baselineYaml = curYaml || '';
      dirty = false;
      const di = modal.querySelector('#ed_dirty_indicator'); if (di) di.style.display = 'none';
    }catch{}
  }, 100);

  // Keep theme synced when document theme changes
  try{
    const mo = new MutationObserver(()=>{ try{ syncEditorTheme(); }catch{} });
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme','class'] });
  }catch{}

  // Keep local working model in sync with YAML editor state updates
  try{
    document.addEventListener('hydreq:editor:state:changed', (e)=>{
      try{
        const wk = (e && e.detail && e.detail.working) || {};
        working = normalizeParsed(wk);
        renderForm();
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
        
        // Refresh YAML editor if it's the YAML column
        if (columnId === '#col-yaml' && !column.classList.contains('collapsed') && yamlEditor) {
          setTimeout(() => { try{ yamlEditor.refresh && yamlEditor.refresh(); }catch{} }, 10);
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
  ensureYamlEditor();
  __suppressDirty = true;
  try{
    const txt = (inMemoryYaml || '').replace(/\t/g, '  ');
    if (window.hydreqEditorYAML && window.hydreqEditorYAML.setText) window.hydreqEditorYAML.setText(txt);
    else if (yamlEditor && yamlEditor.setValue) yamlEditor.setValue(txt);
  }catch{}
  __suppressDirty = false;
  yamlDirty = false;
  // Reset baseline to current YAML to avoid false-dirty on open
  try{
    const curYaml = (window.hydreqEditorYAML && window.hydreqEditorYAML.getText) ? window.hydreqEditorYAML.getText() : (yamlEditor && yamlEditor.getValue ? yamlEditor.getValue() : inMemoryYaml);
    baselineYaml = curYaml || '';
  }catch{}
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
      try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (typeof window.setSuiteTestDetails==='function' && (status||'').toLowerCase()==='failed') window.setSuiteTestDetails(pth, t.name||'', messages||[]); }catch{}
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
  function renderIssues(issues, yamlPreview){
    const issuesEl = modal.querySelector('#ed_issues'); if (!issuesEl) return;
    issuesEl.innerHTML = '';
    const arr = Array.isArray(issues) ? issues : (Array.isArray(issues?.errors) ? issues.errors : []);
    if (!arr.length){ const ok=document.createElement('div'); ok.className='text-success'; ok.textContent='No issues'; issuesEl.appendChild(ok); return; }
    arr.forEach(it=>{
      const line=document.createElement('div'); line.style.marginBottom='4px';
      const sev=(it.severity||it.level||'error').toLowerCase(); line.className = (sev==='warning'?'text-warning':(sev==='info'?'':'text-error'));
      const loc = it.path || it.instancePath || it.field || '';
      const msg = it.message || it.error || String(it);
      line.textContent = (loc? (loc+': '):'') + msg;
      issuesEl.appendChild(line);
    });
  }
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
          try{ const pth = (modal.querySelector('#ed_path')||{}).textContent||''; if (window.setSuiteTestStatus) window.setSuiteTestStatus(pth, name, s); if (typeof window.setSuiteTestDetails==='function' && s==='failed') window.setSuiteTestDetails(pth, name, Array.isArray(payload.Messages)?payload.Messages:[]); }catch{}
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
        if (window.hydreqEditorYAML && window.hydreqEditorYAML.getText) yamlData = window.hydreqEditorYAML.getText();
        else if (yamlEditor && yamlEditor.getValue) yamlData = yamlEditor.getValue();
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
        baselineYaml = yamlData || '';
        markDirty();
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
      if (!dirty) {
        attemptClose();
      }
    } catch (e) {
      console.error('Save and close failed:', e);
    }
  };
  
  // Prefer modal close() if available; otherwise fallback
  modal.querySelector('#ed_close').onclick = ()=> {
    try{
      if (dirty && !confirm('Discard unsaved changes?')) return;
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