// editor.js - Editor modal functionality

// Global variables that need to be accessible
let selIndex = 0;
let testRunCache = new Map();
let modal = null;
let working = { tests: [] };
const LS_VER = 'v1';
const LS_ENC = (s) => { try { return btoa(unescape(encodeURIComponent(s||''))); } catch { return (s||''); } };
const LS_KEY = (p) => `hydreq.${LS_VER}.runCache:` + LS_ENC(p||'');

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
    
    // Update flow settings  
    if (test.stage !== undefined) {
      const stageEl = modal.querySelector('#ed_stage');
      if (stageEl) stageEl.value = test.stage;
    }
    
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

function addValidationListeners() {
  if (!modal) return;
  
  // Suite-level validation
  const suiteNameEl = modal.querySelector('#ed_suite_name');
  if (suiteNameEl) {
    suiteNameEl.addEventListener('blur', () => {
      const errors = validateField('name', suiteNameEl.value, 'suite');
      showFieldValidation(suiteNameEl, errors);
    });
  }
  
  const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
  if (baseUrlEl) {
    baseUrlEl.addEventListener('blur', () => {
      const errors = validateField('baseUrl', baseUrlEl.value, 'suite');
      showFieldValidation(baseUrlEl, errors);
    });
  }
  
  // Test-level validation
  const testNameEl = modal.querySelector('#ed_test_name');
  if (testNameEl) {
    testNameEl.addEventListener('blur', () => {
      const errors = validateField('name', testNameEl.value, 'test');
      showFieldValidation(testNameEl, errors);
    });
  }
  
  const urlEl = modal.querySelector('#ed_url');
  if (urlEl) {
    urlEl.addEventListener('blur', () => {
      const errors = validateField('url', urlEl.value, 'request');
      showFieldValidation(urlEl, errors);
    });
  }
  
  const statusEl = modal.querySelector('#ed_assert_status');
  if (statusEl) {
    statusEl.addEventListener('blur', () => {
      const errors = validateField('status', statusEl.value, 'assert');
      showFieldValidation(statusEl, errors);
    });
  }
  
  // Numeric field validation
  ['#ed_timeout', '#ed_stage', '#ed_assert_maxDuration'].forEach(selector => {
    const el = modal.querySelector(selector);
    if (el) {
      const fieldName = selector.replace('#ed_', '').replace('assert_', '');
      el.addEventListener('blur', () => {
        const errors = validateField(fieldName, el.value);
        showFieldValidation(el, errors);
      });
    }
  });
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
      // assert
      const as = tc.Assert || tc.assert || {};
      t.assert = {
        status: as.Status || as.status || 0,
        headerEquals: as.HeaderEquals || as.headerEquals || {},
        jsonEquals: as.JSONEquals || as.jsonEquals || {},
        jsonContains: as.JSONContains || as.jsonContains || {},
        bodyContains: as.BodyContains || as.bodyContains || [],
        maxDurationMs: as.MaxDurationMs || as.maxDurationMs || 0,
      };
      // extract
      const ex = tc.Extract || tc.extract || {};
      const exOut = {};
      Object.keys(ex||{}).forEach(k=>{
        const v = ex[k]||{}; exOut[k] = { jsonPath: v.JSONPath || v.jsonPath || '' };
      });
      t.extract = exOut;
      // flow/meta
      t.skip = !!(tc.Skip ?? tc.skip);
      t.only = !!(tc.Only ?? tc.only);
      t.timeoutMs = tc.TimeoutMs ?? tc.timeoutMs ?? 0;
      t.repeat = tc.Repeat ?? tc.repeat ?? 0;
      t.tags = tc.Tags || tc.tags || [];
      t.stage = tc.Stage ?? tc.stage ?? 0;
      t.vars = tc.Vars || tc.vars || {};
      t.dependsOn = tc.DependsOn || tc.dependsOn || [];
      t.pre = tc.Pre || tc.pre || [];
      t.post = tc.Post || tc.post || [];
      // retry
      const rt = tc.Retry || tc.retry || null;
      t.retry = rt ? { max: rt.Max ?? rt.max ?? 0, backoffMs: rt.BackoffMs ?? rt.backoffMs ?? 0, jitterPct: rt.JitterPct ?? rt.jitterPct ?? 0 } : null;
      // matrix
      t.matrix = tc.Matrix || tc.matrix || {};
      // openapi
      const oa = tc.OpenAPI || tc.openApi || null;
      t.openApi = oa ? { enabled: (oa.Enabled ?? oa.enabled) } : null;
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
      const env = (function(){ const env = {}; const lines=(document.getElementById('env_kv').value||'').split(/\n/); for(const line of lines){ const s=line.trim(); if(!s) return; const eq=s.indexOf('='); if(eq>0){ env[s.slice(0,eq).trim()] = s.slice(eq+1).trim(); } } return env; })();
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
            <label class="label cursor-pointer ed-row-6 ed-ai-center">
              <span class="label-text">YAML View</span>
              <input id="toggle_yaml" type="checkbox" class="toggle toggle-sm" title="Toggle YAML editor view">
            </label>
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
          <div id="pane_visual" class="ed-pane">
            <div class="ed-tests-panel" id="ed_tests_panel">
              <div class="ed-tests-header">
                <span class="ed-row-6">
                  <button id="ed_collapse_tests" class="btn btn-xs" title="Collapse/Expand tests">◀</button>
                  <span>Tests</span>
                </span>
                <span class="ed-row-6">
                  <button id="ed_add_test" class="btn btn-xs" title="Add test">+</button>
                  <button id="ed_del_test" class="btn btn-xs" title="Delete selected">−</button>
                </span>
              </div>
              <div id="ed_tests" class="ed-tests-list"></div>
            </div>
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
            <div id="pane_yaml" class="ed-yaml-panel" style="display:none; flex: 1; min-width: 400px; border-left: 1px solid var(--bd);">
              <div class="ed-yaml-header">
                <span class="fw-600">YAML Source</span>
              </div>
              <textarea id="ed_raw" class="hidden"></textarea>
              <div id="ed_yaml_editor" style="flex: 1;"></div>
            </div>
          </div>
          <div id="ed_splitter" class="ed-splitter"></div>
          <div class="ed-right">
            <div class="ed-right-title">Validation & Preview</div>
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
  const paneYaml = modal.querySelector('#pane_yaml');
  let inMemoryYaml = '';
  const densityToggle = modal.querySelector('#ed_density');
  const editorRoot = modal.querySelector('.editor-root');
  const splitter = modal.querySelector('#ed_splitter');
  const rightPane = splitter ? splitter.nextElementSibling : null;
  if (data.raw && data.raw.trim() !== '') {
    rawEl.value = data.raw;
    inMemoryYaml = data.raw;
  } else if (data.parsed) {
    try {
      const dumped = jsyaml.dump(data.parsed || {}, { noRefs: true });
      inMemoryYaml = unquoteNumericKeys(dumped || '');
      rawEl.value = inMemoryYaml;
    } catch (e) {
      rawEl.value = '';
      inMemoryYaml = '';
    }
  } else {
    rawEl.value = '';
  }
  let yamlDirty = false;
  let yamlEditor = null;
  function ensureYamlEditor(){
    if (yamlEditor) return yamlEditor;
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
    yamlEditor.on('change', function(){ yamlDirty = true; });
    setTimeout(()=> yamlEditor.refresh(), 0);
    return yamlEditor;
  }
  issuesEl.innerHTML = '';
  (function attachVisualDelegates(){
    const root = modal.querySelector('#pane_visual');
    if (!root) return;
    const handler = async ()=>{ try { sync(); await serializeWorkingToYamlImmediate(); } catch {} };
    root.addEventListener('input', ()=>{ handler(); }, true);
    root.addEventListener('change', ()=>{ handler(); }, true);
    root.addEventListener('click', (e)=>{ const t = e.target; if (!t) return; if ((t.tagName && t.tagName.toLowerCase()==='button') || t.closest('button')) { handler(); } }, true);
  })();
  selIndex = 0;
  const persisted = (function(){ try{ return JSON.parse(localStorage.getItem(LS_KEY(path))||'{}') }catch{ return {} } })();
  testRunCache = new Map(Object.entries(persisted));
  let lastSuiteRun = null;
  let dirty = false;
  function markDirty(){ dirty = true; try{ const di = modal && modal.querySelector && modal.querySelector('#ed_dirty_indicator'); if (di) di.style.display = ''; }catch{} }
  function attemptClose(){ if (dirty && !confirm('Discard unsaved changes?')) return; modal.remove(); document.body.classList.remove('modal-open'); }
  async function serializeWorkingToYamlImmediate(){ 
    if (!working || !working.tests) return '';
    try { 
      // Clean up the working object to remove null/undefined/empty values
      const cleaned = cleanForSerialization(working);
      const yamlText = jsyaml.dump(cleaned, { noRefs: true });
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
  
  async function mirrorYamlFromVisual(force=false){ 
    try {
      // Before serializing, collect any current form data that might not be saved yet
      collectFormData();
      
      const yamlText = await serializeWorkingToYamlImmediate();
      if (yamlEditor && yamlText) {
        yamlEditor.setValue(yamlText);
        yamlDirty = false;
      }
    } catch (e) {
      console.error('Failed to mirror YAML from visual:', e);
    }
  }
  
  function collectFormData() {
    // Collect suite-level data
    const suiteNameEl = modal.querySelector('#ed_suite_name');
    const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
    const authBearerEl = modal.querySelector('#ed_auth_bearer');
    const authBasicEl = modal.querySelector('#ed_auth_basic');
    
    if (suiteNameEl && suiteNameEl.value !== (working.name || '')) working.name = suiteNameEl.value;
    if (baseUrlEl && baseUrlEl.value !== (working.baseUrl || '')) working.baseUrl = baseUrlEl.value;
    
    if (authBearerEl && authBearerEl.value) {
      if (!working.auth) working.auth = {};
      working.auth.bearer = authBearerEl.value;
    }
    if (authBasicEl && authBasicEl.value) {
      if (!working.auth) working.auth = {};
      working.auth.basic = authBasicEl.value;
    }
    
    // Collect variables from kvTable
    const varsEl = modal.querySelector('#ed_suite_vars');
    if (varsEl) {
      try {
        const varsTable = varsEl.querySelector('table');
        if (varsTable) {
          const vars = {};
          const rows = varsTable.querySelectorAll('tr');
          rows.forEach(row => {
            const keyInput = row.querySelector('input:first-child');
            const valueInput = row.querySelector('input:last-child');
            if (keyInput && valueInput && keyInput.value.trim()) {
              vars[keyInput.value.trim()] = valueInput.value;
            }
          });
          working.vars = vars;
        }
      } catch (e) {
        console.warn('Failed to collect variables:', e);
      }
    }
    
    // Collect test-level data
    if (working.tests && working.tests[selIndex]) {
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
      
      if (testNameEl) test.name = testNameEl.value;
      
      if (!test.request) test.request = {};
      if (methodEl) test.request.method = methodEl.value;
      if (urlEl) test.request.url = urlEl.value;
      if (timeoutEl && timeoutEl.value) test.request.timeout = parseInt(timeoutEl.value);
      if (bodyEl) test.request.body = bodyEl.value;
      
      // Collect headers and query from kvTables
      const headersEl = modal.querySelector('#ed_headers');
      if (headersEl) {
        try {
          const headersTable = headersEl.querySelector('table');
          if (headersTable) {
            const headers = {};
            const rows = headersTable.querySelectorAll('tr');
            rows.forEach(row => {
              const keyInput = row.querySelector('input:first-child');
              const valueInput = row.querySelector('input:last-child');
              if (keyInput && valueInput && keyInput.value.trim()) {
                headers[keyInput.value.trim()] = valueInput.value;
              }
            });
            test.request.headers = headers;
          }
        } catch (e) {
          console.warn('Failed to collect headers:', e);
        }
      }
      
      const queryEl = modal.querySelector('#ed_query');
      if (queryEl) {
        try {
          const queryTable = queryEl.querySelector('table');
          if (queryTable) {
            const query = {};
            const rows = queryTable.querySelectorAll('tr');
            rows.forEach(row => {
              const keyInput = row.querySelector('input:first-child');
              const valueInput = row.querySelector('input:last-child');
              if (keyInput && valueInput && keyInput.value.trim()) {
                query[keyInput.value.trim()] = valueInput.value;
              }
            });
            test.request.query = query;
          }
        } catch (e) {
          console.warn('Failed to collect query params:', e);
        }
      }
      
      // Collect assertions
      if (!test.assert) test.assert = {};
      if (statusEl && statusEl.value) test.assert.status = parseInt(statusEl.value);
      if (maxDurationEl && maxDurationEl.value) test.assert.maxDurationMs = parseInt(maxDurationEl.value);
      
      // Collect flow settings
      if (skipEl) test.skip = skipEl.checked;
      if (onlyEl) test.only = onlyEl.checked;
      if (stageEl && stageEl.value) test.stage = parseInt(stageEl.value);
      
      // Collect matrix data
      const matrixEl = modal.querySelector('#ed_matrix');
      if (matrixEl) {
        try {
          const matrixTable = matrixEl.querySelector('.ed-matrix-table');
          if (matrixTable) {
            const matrix = {};
            const rows = matrixTable.querySelectorAll('.ed-matrix-row');
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
                  matrix[key] = values;
                }
              }
            });
            
            if (Object.keys(matrix).length > 0) {
              test.matrix = matrix;
            } else {
              delete test.matrix;
            }
          }
        } catch (e) {
          console.warn('Failed to collect matrix data:', e);
        }
      }
    }
  }
  
  const syncYamlPreviewFromVisual = debounce(()=>{ 
    if (paneYaml.style.display === 'none') { 
      try { 
        serializeWorkingToYamlImmediate().catch(()=>{}); 
      } catch{} 
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
      
      // Visual pane is always visible in the new layout
      const yamlToggle = modal.querySelector('#toggle_yaml');
      if (yamlToggle) yamlToggle.checked = false;
      paneYaml.style.display = 'none';
    } else if (which === 'yaml') {
      // Switching TO YAML: Serialize visual data to YAML
      try {
        await mirrorYamlFromVisual(true); // Force update the YAML editor
      } catch (e) {
        console.warn('Failed to serialize visual to YAML:', e);
      }
      
      // Show YAML pane alongside visual
      const yamlToggle = modal.querySelector('#toggle_yaml');
      if (yamlToggle) yamlToggle.checked = true;
      paneYaml.style.display = 'block';
      ensureYamlEditor();
      if (yamlEditor) {
        setTimeout(() => yamlEditor.refresh(), 0);
      }
    }
    try { localStorage.setItem('hydreq.editor.tab', which); } catch {}
  }
  
  // YAML toggle functionality
  const yamlToggle = modal.querySelector('#toggle_yaml');
  const yamlPane = modal.querySelector('#pane_yaml');
  if (yamlToggle && yamlPane) {
    yamlToggle.addEventListener('change', () => {
      if (yamlToggle.checked) {
        // Show YAML pane side by side
        yamlPane.style.display = 'block';
        ensureYamlEditor();
        mirrorYamlFromVisual(true); // Update YAML content
        if (yamlEditor) {
          setTimeout(() => yamlEditor.refresh(), 100);
        }
      } else {
        // Hide YAML pane
        yamlPane.style.display = 'none';
      }
    });
  }
  
  // Test panel collapse functionality
  const collapseBtn = modal.querySelector('#ed_collapse_tests');
  const testsPanel = modal.querySelector('#ed_tests_panel');
  const testsList = modal.querySelector('#ed_tests');
  if (collapseBtn && testsPanel && testsList) {
    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      if (collapsed) {
        testsPanel.style.flexBasis = '40px';
        testsPanel.style.minWidth = '40px';
        testsList.style.display = 'none';
        collapseBtn.textContent = '▶';
        collapseBtn.title = 'Expand tests';
      } else {
        testsPanel.style.flexBasis = '280px';
        testsPanel.style.minWidth = '280px';
        testsList.style.display = 'block';
        collapseBtn.textContent = '◀';
        collapseBtn.title = 'Collapse tests';
      }
    });
  }
  
  const closeBtn = modal.querySelector('#ed_close'); if (closeBtn){ closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); attemptClose(); }); }
  document.addEventListener('keydown', function escClose(ev){ if (!document.getElementById('editorModal')) { document.removeEventListener('keydown', escClose); return; } if (ev.key === 'Escape'){ attemptClose(); } });
  (function(){ /* splitter implementation omitted for brevity */ })();
  try { const pref = localStorage.getItem('hydreq.editor.density') || 'compact'; if (pref === 'comfortable') { densityToggle.checked = true; editorRoot.classList.add('comfortable'); } } catch {}
  if (densityToggle) { densityToggle.addEventListener('change', ()=>{ const comfy = densityToggle.checked; if (comfy) editorRoot.classList.add('comfortable'); else editorRoot.classList.remove('comfortable'); try { localStorage.setItem('hydreq.editor.density', comfy ? 'comfortable' : 'compact'); } catch {} }); }
  function kvTable(container, obj, onChange){ /* as original */ }
  function listTable(container, arr, onChange){ /* as original */ }
  function mapTable(container, obj, valuePlaceholder='value', onChange){ return kvTable(container, obj||{}, onChange); }
  function hookList(container, hooks, options, onChange){ /* large implementation omitted for brevity */ }
  const runSuiteBtn = modal.querySelector('#ed_run_suite'); if (runSuiteBtn){ runSuiteBtn.addEventListener('click', async (e)=>{ /* omitted body */ }); }
  let suiteVarsGet, getPreSuite, getPostSuite, headersGet, queryGet, bodyEl, aHeadGet, aEqGet, aContGet, aBodyGet, extractGet, matrixGet, getPreHooks, getPostHooks, oapiSel;

  
  function setupFormEventListeners() {
    // Suite-level field listeners
    const suiteNameEl = modal.querySelector('#ed_suite_name');
    const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
    const authBearerEl = modal.querySelector('#ed_auth_bearer');
    const authBasicEl = modal.querySelector('#ed_auth_basic');
    
    if (suiteNameEl) {
      suiteNameEl.removeEventListener('input', handleSuiteNameChange);
      suiteNameEl.addEventListener('input', handleSuiteNameChange);
    }
    if (baseUrlEl) {
      baseUrlEl.removeEventListener('input', handleBaseUrlChange);
      baseUrlEl.addEventListener('input', handleBaseUrlChange);
    }
    if (authBearerEl) {
      authBearerEl.removeEventListener('input', handleAuthBearerChange);
      authBearerEl.addEventListener('input', handleAuthBearerChange);
    }
    if (authBasicEl) {
      authBasicEl.removeEventListener('input', handleAuthBasicChange);
      authBasicEl.addEventListener('input', handleAuthBasicChange);
    }
    
    // Test-level field listeners
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
    
    const testFields = [
      {el: testNameEl, handler: handleTestNameChange},
      {el: methodEl, handler: handleMethodChange},
      {el: urlEl, handler: handleUrlChange},
      {el: timeoutEl, handler: handleTimeoutChange},
      {el: bodyEl, handler: handleBodyChange},
      {el: skipEl, handler: handleSkipChange},
      {el: onlyEl, handler: handleOnlyChange},
      {el: stageEl, handler: handleStageChange},
      {el: statusEl, handler: handleStatusChange},
      {el: maxDurationEl, handler: handleMaxDurationChange}
    ];
    
    testFields.forEach(({el, handler}) => {
      if (el) {
        ['input', 'change'].forEach(event => {
          el.removeEventListener(event, handler);
          el.addEventListener(event, handler);
        });
      }
    });
  }
  
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
  yamlEditor.setValue((inMemoryYaml || '').replace(/\t/g, '  '));
  yamlDirty = false;
  const cacheKey = ()=>{ const t = (working.tests && working.tests[selIndex]) || {}; return selIndex + ':' + (t.name||('test '+(selIndex+1))); };
  function setQuickRunBox(result){ /* omitted */ }
  function renderQuickRunForSelection(){ const key = cacheKey(); const r = testRunCache.get(key); setQuickRunBox(r || null); const qrBox = modal.querySelector('#ed_quickrun_box'); if (qrBox) qrBox.open = true; }
  const renderIssues = (arr, yamlPreview)=>{ /* omitted */ };
  let lastValidated = null;
  modal.querySelector('#ed_run_test').onclick = async ()=>{ 
    try {
      // Collect current form data and validate
      collectFormData();
      if (!working.tests || !working.tests[selIndex]) {
        alert('No test selected to run');
        return;
      }
      
      // Serialize to YAML and send to quick run endpoint
      const yamlData = await serializeWorkingToYamlImmediate();
      const testName = working.tests[selIndex].name || `test ${selIndex + 1}`;
      
      // Create a temporary suite with only the selected test
      const singleTestSuite = {
        ...working,
        tests: [working.tests[selIndex]]
      };
      
      // Create in-memory suite for quick run
      const payload = {
        suites: [{ path: 'editor-test', parsed: singleTestSuite }],
        workers: 1,
        tags: [],
        env: {}
      };
      
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Quick run started:', result);
      
      // Show quick run feedback
      alert(`✓ Started quick run for: ${testName}\nRun ID: ${result.runId}`);
      
      // Optionally start listening to the stream for results
      if (result.runId) {
        listenToQuickRun(result.runId, testName);
      }
    } catch (e) {
      console.error('Failed to run test:', e);
      alert('Failed to run test: ' + e.message);
    }
  };
  
  // Listen to quick run results
  function listenToQuickRun(runId, testName) {
    const quickRunBox = modal.querySelector('#ed_quickrun');
    if (!quickRunBox) return;
    
    quickRunBox.innerHTML = `<div>Running ${testName}...</div>`;
    
    const es = new EventSource('/api/stream?runId=' + encodeURIComponent(runId));
    
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'test') {
          const status = data.status === 'passed' ? '✓' : 
                        data.status === 'failed' ? '✗' : 
                        data.status === 'skipped' ? '○' : '⚠';
          const color = data.status === 'passed' ? '#10b981' : 
                       data.status === 'failed' ? '#ef4444' : 
                       data.status === 'skipped' ? '#f59e0b' : '#6b7280';
          
          quickRunBox.innerHTML = `
            <div style="color: ${color}">
              ${status} ${data.name || testName}
              ${data.durationMs ? ` (${data.durationMs}ms)` : ''}
            </div>
            ${data.error ? `<div style="color: #ef4444; font-size: 12px; margin-top: 4px;">${data.error}</div>` : ''}
          `;
        }
        
        if (data.type === 'done') {
          es.close();
        }
      } catch (e) {
        console.error('Failed to parse stream data:', e);
      }
    };
    
    es.onerror = () => {
      es.close();
      quickRunBox.innerHTML = '<div style="color: #ef4444;">Run failed or connection lost</div>';
    };
  }
  
  modal.querySelector('#ed_validate').onclick = async ()=>{ 
    try {
      collectFormData();
      const yamlData = await serializeWorkingToYamlImmediate();
      
      // Send to validation endpoint
      const response = await fetch('/api/editor/validate', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-yaml'},
        body: yamlData
      });
      
      const result = await response.json();
      
      if (result.valid) {
        alert('✓ YAML is valid');
      } else {
        alert('✗ Validation failed:\n' + (result.errors || []).join('\n'));
      }
    } catch (e) {
      console.error('Validation failed:', e);
      alert('Validation error: ' + e.message);
    }
  };
  
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
        dirty = false;
        const di = modal.querySelector('#ed_dirty_indicator');
        if (di) di.style.display = 'none';
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

  document.getElementById('clearLog').onclick = ()=>{ results.textContent=''; };
  document.getElementById('downloadRunJSON').onclick = ()=> downloadRun('json');
  document.getElementById('downloadRunJUnit').onclick = ()=> downloadRun('junit');
  document.getElementById('downloadRunHTML').onclick = ()=> downloadRun('html');
  // Download helpers
  async function downloadURL(url) { /* omitted */ }
  function downloadRun(fmt){ /* omitted */ }
  // Initial population of suites list
  refresh();
}

// Expose to window for backward compatibility
window.openEditor = openEditor;