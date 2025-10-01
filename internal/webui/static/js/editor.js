// editor.js - Editor modal functionality

// Add dynamic styles for 4-column layout
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .ed-main {
      display: flex;
      flex-direction: row;
      height: calc(100vh - 60px);
      overflow: hidden;
    }
    .ed-col {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--bd);
      box-sizing: border-box;
      min-width: 240px;
      max-width: none;
      transition: width 0.2s ease, flex-basis 0.2s ease;
      overflow: hidden;
    }
    .ed-col.collapsed {
      flex: 0 0 40px !important;
      min-width: 40px;
      max-width: 40px;
    }
    .ed-col-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: auto;
      box-sizing: border-box;
    }
    .ed-col-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      border-bottom: 1px solid var(--bd);
      background-color: var(--surface);
      box-sizing: border-box;
    }
    /* Collapsed header presentation: stack vertical title and keep collapse button visible */
    .ed-col.collapsed .ed-col-header {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-bottom: none;
      height: 100%;
      padding: 6px 4px;
      cursor: default;
    }
    .ed-col.collapsed .ed-col-header .btn { padding: 2px 4px; }
    .ed-col.collapsed .ed-col-header .fw-600 {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      text-align: center;
    }
    /* Hide extra action controls in collapsed mode, keep the collapse button visible */
    .ed-col.collapsed .ed-col-header .ed-row-6 > :not(.ed-collapse-btn) { display: none; }
    .ed-col.collapsed .ed-col-header .ed-row-6 .ed-collapse-btn { display: inline-flex; }
    .ed-col.collapsed .ed-col-content { display: none; }
    .ed-col.collapsed .ed-col-content {
      display: none;
    }
  /* Column sizing: tests fixed; others flex to fill remaining space */
  #col-tests { flex: 0 0 280px; min-width: 240px; }
  #col-visual { flex: 2 1 500px; min-width: 0; }
  #col-yaml { flex: 1 1 400px; min-width: 0; }
  #col-results { flex: 1 1 400px; min-width: 0; }
  /* When tests column is collapsed, override its fixed/min width */
  #col-tests.collapsed { flex: 0 0 40px !important; min-width: 40px !important; max-width: 40px !important; }
  /* When some columns are collapsed, remaining flexible columns stretch automatically due to flex settings above */
    .ed-yaml-header {
      padding: 8px;
      background-color: var(--surface);
      border-bottom: 1px solid var(--bd);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ed-yaml-body {
      flex: 1;
      overflow: auto;
    }
    .CodeMirror { height: 100%; min-height: 180px; }
    #col-yaml .ed-col-content { overflow: hidden; }
    #ed_yaml_editor, #pane_yaml { height: 100%; }
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
  if (authBearerEl) authBearerEl.value = (working.auth && working.auth.bearer) || '';
  if (authBasicEl) authBasicEl.value = (working.auth && working.auth.basic) || '';
  
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
    if (stageEl) stageEl.value = (test.stage !== undefined && test.stage !== 0) ? test.stage : '';
    
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
    working.auth = {};
    if (bearerVal) working.auth.bearer = bearerVal;
    if (basicVal) working.auth.basic = basicVal;
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
    const testDiv = document.createElement('div');
    testDiv.className = 'ed-test-item';
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
    if (result && result.status) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-xs ed-test-status';
      if (result.status === 'passed') {
        badge.classList.add('badge-success');
        badge.textContent = '✓';
      } else if (result.status === 'failed') {
        badge.classList.add('badge-error');
        badge.textContent = '✗';
      } else if (result.status === 'skipped') {
        badge.classList.add('badge-warning');
        badge.textContent = '○';
      }
      badge.title = result.status;
      testDiv.appendChild(badge);
    }

    // Click handler to select test
    testDiv.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selIndex = index;
      renderTests(); // Re-render to update selection
      renderForm(); // Update the form for the selected test
      try{ renderQuickRunForSelection(); }catch{}
    };

    testsEl.appendChild(testDiv);
  });
}

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
      if (Array.isArray(r.messages) && r.messages.length){ const pre=document.createElement('pre'); pre.className = (r.status==='failed'?'fail':(r.status==='skipped'?'skip':'ok')); pre.textContent = r.messages.join('\n'); out.appendChild(pre); }
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
    modal = document.createElement('div'); modal.id='editorModal'; modal.innerHTML = `
      <div class="editor-root">
        <div class="ed-header">
          <div class="ed-header-left">
            <div class="fw-600">Edit: <span id="ed_path"></span></div>
          </div>
          <div class="ed-actions">
            <label class="label cursor-pointer ed-row-6 ed-ai-center">
              <span class="label-text">Comfortable</span>
              <input id="ed_density" type="checkbox" class="toggle toggle-sm" title="Toggle comfortable density">
            </label>
            <label class="label cursor-pointer ed-row-6 ed-ai-center" title="Include dependsOn when running the selected test">
              <span class="label-text">with deps</span>
              <input id="ed_run_with_deps" type="checkbox" class="toggle toggle-sm">
            </label>
            <button id="ed_run_test" class="btn btn-sm" title="Validate and run the selected test without saving">Run test</button>
            <button id="ed_run_suite" class="btn btn-sm" title="Validate and run the whole suite without saving">Run suite</button>
            <button id="ed_validate" class="btn btn-sm">Validate</button>
            <button id="ed_save" class="btn btn-sm">Save</button>
            <button id="ed_save_close" class="btn btn-sm">Save & Close</button>
            <button id="ed_close" type="button" class="btn btn-sm" title="Close">Close</button>
            <span id="ed_dirty_indicator" class="pill" title="You have unsaved changes" style="margin-left:8px; display:none; background:#fde2e1; color:#b91c1c">Unsaved</span>
          </div>
        </div>
        <div class="ed-main">
          <!-- Column 1: Tests List -->
          <div id="col-tests" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">Tests</span>
              <div class="ed-row-6">
                <button id="ed_collapse_tests" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand tests">◀</button>
                <button id="ed_add_test" class="btn btn-xs" title="Add test">+</button>
                <button id="ed_del_test" class="btn btn-xs" title="Delete selected">−</button>
              </div>
            </div>
            <div class="ed-col-content">
              <div id="ed_tests" class="ed-tests-list"></div>
            </div>
          </div>
          
          <!-- Column 2: Visual Editor -->
          <div id="col-visual" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">Visual Editor</span>
              <div class="ed-row-6">
                <button id="ed_collapse_visual" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand visual editor">◀</button>
              </div>
            </div>
            <div class="ed-col-content" id="pane_visual">
            <div class="ed-center">
              <details open class="ed-panel">
                <summary class="ed-summary">🏠 Suite Configuration</summary>
                <div class="ed-body ed-grid-2-140" id="ed_suite_form">
                  <label>Name *</label>
                  <input id="ed_suite_name" type="text" required/>
                  <label>Base URL *</label>
                  <input id="ed_suite_baseurl" type="text" placeholder="https://api.example.com" required/>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Variables</label>
                  <div class="ed-col-span-full" id="ed_suite_vars"></div>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Auth</label>
                  <div class="ed-col-span-full ed-grid-2-160">
                    <label>Bearer env</label>
                    <div class="ed-row-8 ed-ai-center">
                      <input id="ed_auth_bearer" type="text" placeholder="DEMO_BEARER"/>
                      <span id="ed_auth_bearer_status" class="pill" title="env presence">?</span>
                    </div>
                    <label>Basic env</label>
                    <div class="ed-row-8 ed-ai-center">
                      <input id="ed_auth_basic" type="text" placeholder="BASIC_B64"/>
                      <span id="ed_auth_basic_status" class="pill" title="env presence">?</span>
                    </div>
                  </div>
                  <div class="ed-col-span-full ed-grid-2-160 ed-ai-center">
                    <label>Auth header (preview)</label>
                    <div id="ed_auth_preview" class="ed-mono-dim">(none)</div>
                  </div>
                  <div class="ed-col-span-full ed-grid-2-160 ed-ai-start">
                    <label>Suite hooks</label>
                    <div>
                      <div class="ed-subhead">preSuite</div>
                      <div id="ed_suite_presuite"></div>
                      <div class="ed-spacer-8"></div>
                      <div class="ed-subhead">postSuite</div>
                      <div id="ed_suite_postsuite"></div>
                    </div>
                  </div>
                </div>
              </details>

              <details open class="ed-panel">
                <summary class="ed-summary">🧪 Test Configuration</summary>
                <div class="ed-body ed-grid-2-130" id="ed_test_form">
                  <label>Test name *</label>
                  <input id="ed_test_name" type="text" placeholder="My test name" required/>
                  <label>Stage</label>
                  <input id="ed_stage" type="number" min="0"/>
                  <label>Skip</label>
                  <input id="ed_skip" type="checkbox"/>
                  <label>Only</label>
                  <input id="ed_only" type="checkbox"/>
                </div>
              </details>

              <details open class="ed-panel">
                <summary class="ed-summary">🌐 HTTP Request</summary>
                <div class="ed-body ed-grid-2-130" id="ed_req_form">
                  <label>Method *</label>
                  <select id="ed_method" required>
                    <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>
                  </select>
                  <label>URL path *</label>
                  <input id="ed_url" type="text" required/>
                  <label>Timeout (ms)</label>
                  <input id="ed_timeout" type="number" min="0"/>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Headers</label>
                  <div class="ed-col-span-full" id="ed_headers"></div>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Query</label>
                  <div class="ed-col-span-full" id="ed_query"></div>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Body (JSON/YAML)</label>
                  <textarea id="ed_body" class="ed-col-span-full ed-textarea-md"></textarea>
                </div>
              </details>

              <details open class="ed-panel">
                <summary class="ed-summary">✅ Response Assertions</summary>
                <div class="ed-body ed-grid-2-160" id="ed_assert_form">
                  <label>Status *</label>
                  <input id="ed_assert_status" type="number" min="0" required/>
                  <label>Header equals</label>
                  <div id="ed_assert_headerEquals" class="ed-grid-col-2"></div>
                  <label>JSON equals (path → value)</label>
                  <div id="ed_assert_jsonEquals" class="ed-grid-col-2"></div>
                  <label>JSON contains (path → value)</label>
                  <div id="ed_assert_jsonContains" class="ed-grid-col-2"></div>
                  <label>Body contains</label>
                  <div id="ed_assert_bodyContains" class="ed-grid-col-2"></div>
                  <label>Max duration (ms)</label>
                  <input id="ed_assert_maxDuration" type="number" min="0"/>
                </div>
              </details>

              <details open class="ed-panel">
                <summary class="ed-summary">📤 Extract Variables</summary>
                <div class="ed-body" id="ed_extract"></div>
              </details>



              <details open class="ed-panel">
                <summary class="ed-summary">🔗 Test Hooks</summary>
                <div class="ed-body">
                  <div class="ed-subhead">pre</div>
                  <div id="ed_test_prehooks"></div>
                  <div class="ed-spacer-8"></div>
                  <div class="ed-subhead">post</div>
                  <div id="ed_test_posthooks"></div>
                </div>
              </details>

              <details open class="ed-panel">
                <summary class="ed-summary">🔄 Retry Policy</summary>
                <div class="ed-body ed-grid-2-160" id="ed_retry_form">
                  <label>Enable retry</label>
                  <input id="ed_retry_enable" type="checkbox"/>
                  <label>Max attempts</label>
                  <input id="ed_retry_max" type="number" min="0"/>
                  <label>Backoff (ms)</label>
                  <input id="ed_retry_backoff" type="number" min="0"/>
                  <label>Jitter (%)</label>
                  <input id="ed_retry_jitter" type="number" min="0" max="100"/>
                </div>
              </details>

              <details open class="ed-panel tight">
                <summary class="ed-summary">🔢 Data Matrix</summary>
                <div class="ed-body" id="ed_matrix"></div>
              </details>

              <details open class="ed-panel tight">
                <summary class="ed-summary">OpenAPI</summary>
                <div class="ed-body ed-grid-2-160" id="ed_oapi_form">
                  <label>Per-test override</label>
                  <select id="ed_oapi_enabled">
                    <option value="inherit">Inherit (suite default)</option>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </details>
            </div>
            </div>
          </div>
          
          <!-- Column 3: YAML Editor -->
          <div id="col-yaml" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">YAML Source</span>
              <div class="ed-row-6">
                <button id="ed_collapse_yaml" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand YAML editor">◀</button>
              </div>
            </div>
            <div class="ed-col-content" id="pane_yaml">
              <textarea id="ed_raw" class="hidden"></textarea>
              <div id="ed_yaml_editor" style="flex: 1;"></div>
            </div>
          </div>
          
          <!-- Column 4: Results -->
          <div id="col-results" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">Results</span>
              <div class="ed-row-6">
                <button id="ed_collapse_results" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand results">◀</button>
              </div>
            </div>
            <div class="ed-col-content">
              <div id="ed_preview" class="ed-preview">
                <details id="ed_quickrun_box" class="ed-section" open>
                  <summary>Quick run</summary>
                  <div id="ed_quickrun" class="log ed-scroll"></div>
                </details>
                <details id="ed_validation_box" class="ed-section" open>
                  <summary class="ed-row-8 ed-ai-center ed-justify-between">
                    <span>Validation</span>
                    <button id="ed_copy_issues" class="btn btn-xs" title="Copy issues">Copy</button>
                  </summary>
                  <div id="ed_issues" class="ed-scroll"></div>
                </details>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    try {
      const addBtn = modal.querySelector('#ed_add_test');
      const delBtn = modal.querySelector('#ed_del_test');
      if (addBtn) {
        addBtn.onclick = ()=>{
          const defaultName = `test ${working.tests.length+1}`;
          const name = prompt('Enter test name:', defaultName);
          const finalName = (name && name.trim()) ? name.trim() : defaultName;
          working.tests.push({ name: finalName, request:{ method:'GET', url:'' }, assert:{ status:200 } });
          selIndex = working.tests.length-1; renderTests(); renderForm(); try{ sync(); serializeWorkingToYamlImmediate().catch(()=>{}); }catch{} };
      }
      if (delBtn) {
        delBtn.onclick = ()=>{ if (working.tests.length===0) return; if (!confirm('Delete selected test?')) return; working.tests.splice(selIndex,1); selIndex = Math.max(0, selIndex-1); renderTests(); if (working.tests.length) renderForm(); try{ sync(); serializeWorkingToYamlImmediate().catch(()=>{}); }catch{} };
      }
    } catch(e){}
    document.body.classList.add('modal-open');
    modal.addEventListener('wheel', (e)=>{ e.stopPropagation(); }, { passive: true });
    modal.addEventListener('touchmove', (e)=>{ e.stopPropagation(); }, { passive: true });
    modal.addEventListener('click', (e)=>{ if (e.target === modal) attemptClose(); });
  }
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
    if (!rawEl) {
      console.error('Raw editor textarea element not found');
      return null;
    }
    
    yamlEditor = CodeMirror.fromTextArea(rawEl, {
      mode: 'yaml',
      lineNumbers: true,
      theme: (isDocDark()? 'material-darker':'default'),
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      extraKeys: {
        Tab: function(cm){ if (cm.somethingSelected()) cm.indentSelection('add'); else cm.replaceSelection('  ', 'end'); },
        'Shift-Tab': function(cm){ cm.indentSelection('subtract'); }
      }
    });
    
    yamlEditor.on('beforeChange', function(cm, change){
      if (!change || !Array.isArray(change.text)) return;
      let changed = false;
      const out = change.text.map(function(line){ if (line.indexOf('\t') !== -1){ changed = true; return line.replace(/\t/g, '  '); } return line; });
      if (changed) change.update(change.from, change.to, out, change.origin);
    });
    
    yamlEditor.on('change', function(){ 
      yamlDirty = true; 
      // Update visual editor when YAML changes
      try {
        updateVisualFromYaml();
      } catch (e) {
        console.error('Error updating visual from YAML:', e);
      }
      if (!__suppressDirty) markDirty();
    });
    
    // Make sure the CodeMirror instance takes up full height
    const editorElement = yamlEditor.getWrapperElement();
    editorElement.style.height = '100%';
    
    setTimeout(()=> yamlEditor.refresh(), 0);
    return yamlEditor;
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
      const cur = yamlEditor ? yamlEditor.getValue() : inMemoryYaml;
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
      if (yamlEditor && yamlText) {
        const cur = yamlEditor.getValue();
        if (force || cur !== yamlText) {
          __suppressDirty = true;
          yamlEditor.setValue(yamlText);
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
    if (!yamlEditor) return false;
    try {
      const rawText = yamlEditor.getValue();
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
      if (yamlEditor) {
        try {
          const rawText = yamlEditor.getValue();
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
      if (yamlEditor) {
        setTimeout(() => yamlEditor.refresh(), 0);
      }
    }
    try { localStorage.setItem('hydreq.editor.tab', which); } catch {}
  }
  
  // Function to update visual editor from YAML editor
  function updateVisualFromYaml() {
    try {
      if (!yamlEditor) return false;
      const rawText = yamlEditor.getValue();
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
    __suppressDirty = true;
    // If we already have raw content, keep it as-is and just sync visual from YAML
    if (__hadRaw) {
      try { updateVisualFromYaml(); } catch {}
    } else {
      // No raw provided, mirror from visual to create initial YAML
      mirrorYamlFromVisual(true);
    }
    if (yamlEditor) {
      yamlEditor.refresh();
      __suppressDirty = false;
      
      // Add change listener to the YAML editor to update visual form in real-time
      yamlEditor.off('change', updateVisualFromYaml); // Remove previous listener if any
      yamlEditor.on('change', () => {
        updateVisualFromYaml();
        yamlDirty = true;
        if (!__suppressDirty) markDirty();
      });
    }
  }, 100);
  
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
          setTimeout(() => yamlEditor.refresh(), 10);
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
    working.auth.bearer = e.target.value; 
    markDirty(); 
  }
  function handleAuthBasicChange(e) { 
    if (!working.auth) working.auth = {};
    working.auth.basic = e.target.value; 
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
  yamlEditor.setValue((inMemoryYaml || '').replace(/\t/g, '  '));
  __suppressDirty = false;
  yamlDirty = false;
  const cacheKey = ()=>{ const t = (working.tests && working.tests[selIndex]) || {}; return selIndex + ':' + (t.name||('test '+(selIndex+1))); };
  function clearQuickRun(){ const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.innerHTML = ''; }
  function appendQuickRunLine(text, cls){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; const d=document.createElement('div'); if (cls) d.className=cls; d.textContent=text; qr.appendChild(d); qr.scrollTop = qr.scrollHeight; }
  function setQuickRunBox(result){ const qr = modal.querySelector('#ed_quickrun'); if (!qr) return; qr.innerHTML=''; if (!result) return; const icon = result.status==='passed'?'✓':(result.status==='failed'?'✗':(result.status==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${result.name||''}`,(result.status==='passed'?'text-success':(result.status==='failed'?'text-error':'text-warning'))); }
  // Run record persistence and rendering
  function getRunRecord(){ try{ const k = RUNREC_KEY((modal.querySelector('#ed_path')||{}).textContent||''); return JSON.parse(localStorage.getItem(k)||'{}'); }catch{return {}} }
  function saveRunRecord(rec){ try{ const k = RUNREC_KEY((modal.querySelector('#ed_path')||{}).textContent||''); localStorage.setItem(k, JSON.stringify(rec)); }catch{} }
  function setSuiteRecord(status, durationMs, messages){ const rec = getRunRecord(); rec.suite = { status, durationMs: durationMs||0, messages: messages||[], ts: Date.now() }; saveRunRecord(rec); try{ updateSuiteBadgeUI((modal.querySelector('#ed_path')||{}).textContent||'', status); }catch{} }
  function setTestRecord(name, status, durationMs, messages){ const rec = getRunRecord(); rec.tests = rec.tests||{}; rec.tests[name||''] = { name, status, durationMs: durationMs||0, messages: messages||[], ts: Date.now() }; saveRunRecord(rec); try{ if (status==='failed' || status==='passed' || status==='skipped'){ updateSuiteBadgeUI((modal.querySelector('#ed_path')||{}).textContent||'', status); } }catch{} }
  function renderLatestForSelection(){ try{ const rec = getRunRecord(); const t = (working.tests && working.tests[selIndex]) || {}; const nm = t.name||''; const tr = (rec.tests||{})[nm]; const sr = rec.suite; let pick = null; if (tr && sr){ pick = (tr.ts>=sr.ts)? tr : sr; } else { pick = tr || sr; } clearQuickRun(); if (!pick){ appendQuickRunLine('No previous run'); return; } const s=(pick.status||'').toLowerCase(); const icon=s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${(pick.name||nm||'')}${pick.durationMs?` (${pick.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning')); if (Array.isArray(pick.messages) && pick.messages.length){ const pre=document.createElement('pre'); pre.className=(s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent=pick.messages.join('\n'); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(pre); } }catch(e){} }
  function renderQuickRunForSelection(){ renderLatestForSelection(); const qrBox = modal.querySelector('#ed_quickrun_box'); if (qrBox) qrBox.open = true; }
  function updateSuiteBadgeUI(path, status){ try{ if (!path) return; const li = document.querySelector('#suites li[data-path="'+path+'"]'); if (!li) return; const sb = li.querySelector('.suite-badge'); if (!sb) return; if (status==='failed'){ sb.textContent='✗'; sb.style.background='rgba(239,68,68,0.08)'; sb.style.opacity='1'; sb.dataset.status='failed'; } else if (status==='passed'){ if (sb.dataset.status!=='failed'){ sb.textContent='✓'; sb.style.background='rgba(16,185,129,0.12)'; sb.style.opacity='1'; sb.dataset.status='passed'; } } else if (status==='skipped'){ if (sb.dataset.status!=='failed' && sb.dataset.status!=='passed'){ sb.textContent='-'; sb.style.background='rgba(245,158,11,0.06)'; sb.style.opacity='1'; sb.dataset.status='skipped'; } } }catch(e){} }
  function getTestIndexByName(name){ if (!name) return -1; if (!Array.isArray(working.tests)) return -1; for (let i=0;i<working.tests.length;i++){ if ((working.tests[i].name||'') === name) return i; } return -1; }
  function updateTestBadgeByIndex(idx, status){ try{ if (idx<0) return; const t = (working.tests && working.tests[idx]) || {}; const key = idx + ':' + (t.name||('test '+(idx+1))); testRunCache.set(key, { status: status, name: t.name }); try{ localStorage.setItem(LS_KEY((modal.querySelector('#ed_path')||{}).textContent||''), JSON.stringify(Object.fromEntries(testRunCache))); }catch{} renderTests(); }catch(e){} }
  function updateBadgesFromSuiteResult(res){ try{ if (!res) return; if (Array.isArray(res.cases)){ res.cases.forEach(c=>{ const nm = c.Name || c.name; const st = (c.Status || c.status || '').toLowerCase(); const idx = getTestIndexByName(nm); if (idx>=0) updateTestBadgeByIndex(idx, st); }); } else if (res.name && res.status){ const idx = getTestIndexByName(res.name); if (idx>=0) updateTestBadgeByIndex(idx, (res.status||'').toLowerCase()); } }catch(e){} }
  function renderImmediateRunResult(res, label){ const details = modal.querySelector('#ed_quickrun_box'); if (details) details.open = true; const s = (res.status||'').toLowerCase(); if (res.name){ const icon = s==='passed'?'✓':(s==='failed'?'✗':(s==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${res.name}${res.durationMs?` (${res.durationMs}ms)`:''}`, s==='passed'?'text-success':(s==='failed'?'text-error':'text-warning')); }
    if (Array.isArray(res.messages) && res.messages.length){ const pre=document.createElement('pre'); pre.className = (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = res.messages.join('\n'); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(pre); }
    if (Array.isArray(res.cases) && res.cases.length){ res.cases.forEach(c=>{ const cs=(c.Status||'').toLowerCase(); const icon = cs==='passed'?'✓':(cs==='failed'?'✗':(cs==='skipped'?'○':'·')); appendQuickRunLine(`${icon} ${c.Name}${c.DurationMs?` (${c.DurationMs}ms)`:''}`, cs==='passed'?'text-success':(cs==='failed'?'text-error':'text-warning')); if (Array.isArray(c.Messages) && c.Messages?.length){ const pre=document.createElement('pre'); pre.className = (cs==='failed'?'fail':(cs==='skipped'?'skip':'ok')); pre.textContent = c.Messages.join('\n'); const qr = modal.querySelector('#ed_quickrun'); if (qr) qr.appendChild(pre); } }); }
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
      const env = parseEnvFromPage();
      const payload = { parsed: working, testIndex: selIndex, env, runAll: false, includeDeps };
      clearQuickRun(); appendQuickRunLine('Starting test...', 'dim');
      const res = await fetch('/api/editor/testrun', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok){ let txt=''; try{ txt=await res.text(); }catch{} throw new Error('HTTP '+res.status+(txt?(': '+txt):'')); }
      const data = await res.json();
      if (data && data.runId){ listenToQuickRun(data.runId, working.tests[selIndex].name || `test ${selIndex+1}`); }
      else {
        // Immediate result mode
        renderImmediateRunResult(data, working.tests[selIndex].name || `test ${selIndex+1}`);
        const status = (data.status||'').toLowerCase(); const name = data.name || (working.tests[selIndex].name || `test ${selIndex+1}`); setTestRecord(name, status, data.durationMs||0, data.messages||[]); updateTestBadgeByIndex(selIndex, status);
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
          try{ const idx = getTestIndexByName(name); setTestRecord(name, s, dur||0, payload.Messages||[]); if (idx>=0) updateTestBadgeByIndex(idx, s); else { const key = cacheKey(); testRunCache.set(key, { status: s, name }); localStorage.setItem(LS_KEY((modal.querySelector('#ed_path')||{}).textContent||''), JSON.stringify(Object.fromEntries(testRunCache))); } }catch{}
          if (Array.isArray(payload.Messages) && payload.Messages.length){ const pre=document.createElement('pre'); pre.className = (s==='failed'?'fail':(s==='skipped'?'skip':'ok')); pre.textContent = payload.Messages.join('\n'); quickRunBox.appendChild(pre); }
        } else if (type === 'suiteEnd'){
          const s = payload.summary || {};
          appendQuickRunLine(`=== ${payload.name || payload.path || 'suite'} — ${(s.passed||0)} passed, ${(s.failed||0)} failed, ${(s.skipped||0)} skipped, total ${(s.total||0)} in ${(s.durationMs||0)} ms`);
          const st = ((s.failed||0)>0)? 'failed' : (((s.passed||0)>0)? 'passed' : (((s.skipped||0)>0)? 'skipped' : 'unknown'));
          setSuiteRecord(st, s.durationMs||0, []);
          // We may not get individual test events; try to update badges from payload if available
          try{ if (Array.isArray(payload.tests)){ payload.tests.forEach(t=>{ const idx=getTestIndexByName(t.name||t.Name); const st=(t.status||t.Status||'').toLowerCase(); if (idx>=0) updateTestBadgeByIndex(idx, st); }); } }catch{}
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
      collectFormData(); const raw = yamlEditor? yamlEditor.getValue() : await serializeWorkingToYamlImmediate();
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
      const response = await fetch('/api/editor/testrun', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parsed: working, env, runAll: true, includeDeps: true }) });
      if (!response.ok){ let txt=''; try{ txt=await response.text(); }catch{} throw new Error('HTTP '+response.status+(txt?(': '+txt):'')); }
      const data = await response.json();
      if (data && data.runId){ listenToQuickRun(data.runId, working.name || 'suite'); }
      else { renderImmediateRunResult(data, working.name || 'suite'); updateBadgesFromSuiteResult(data); setSuiteRecord((data.status||'').toLowerCase(), data.durationMs||0, data.messages||[]); }
    }catch(e){ console.error(e); appendQuickRunLine('Suite run failed: '+e.message, 'text-error'); }
  }; }

  // Copy Issues button
  const copyIssuesBtn = modal.querySelector('#ed_copy_issues');
  if (copyIssuesBtn){ copyIssuesBtn.onclick = async ()=>{ try{ const el = modal.querySelector('#ed_issues'); const txt = el? el.innerText : ''; await navigator.clipboard.writeText(txt); copyIssuesBtn.textContent='Copied'; setTimeout(()=> copyIssuesBtn.textContent='Copy', 1200); }catch(e){ console.error('Copy failed', e); } }; }
  
  modal.querySelector('#ed_save').onclick = async ()=>{ 
    try {
      collectFormData();
      const yamlData = await serializeWorkingToYamlImmediate();
      
      // Send to save endpoint
      const response = await fetch('/api/editor/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          path: path,
          content: yamlData
        })
      });
      
      if (response.ok) {
        alert('✓ Suite saved successfully');
        // Update baseline to latest YAML and recompute dirty
        baselineYaml = yamlData || '';
        markDirty();
      } else {
        const error = await response.text();
        alert('✗ Save failed: ' + error);
      }
    } catch (e) {
      console.error('Save failed:', e);
      alert('Save error: ' + e.message);
    }
  };
  
  modal.querySelector('#ed_save_close').onclick = async ()=>{ 
    try {
      // Save first
      await modal.querySelector('#ed_save').onclick();
      // Then close if save succeeded
      if (!dirty) {
        attemptClose();
      }
    } catch (e) {
      console.error('Save and close failed:', e);
    }
  };
  
  modal.querySelector('#ed_close').onclick = ()=> attemptClose();
  function syncEditorTheme(){ if (yamlEditor){ yamlEditor.setOption('theme', isDocDark() ? 'material-darker' : 'default'); yamlEditor.refresh(); } }
  const lastTab = (function(){ try{ return localStorage.getItem('hydreq.editor.tab') }catch{ return null } })() || 'yaml';
  switchTab(lastTab === 'visual' ? 'visual' : 'yaml');
  if (working.tests && working.tests.length) { try{ renderQuickRunForSelection(); }catch{} }

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
        setTestRecord(nm, st, 0, []);
        const idx = getTestIndexByName(nm);
        if (idx>=0) updateTestBadgeByIndex(idx, st);
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
  refresh();
}

// Expose to window for backward compatibility
window.openEditor = openEditor;