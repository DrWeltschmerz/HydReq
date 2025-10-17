(function(){
  function makeEmptyMessage(){
    const msg = document.createElement('div');
    msg.className = 'dim mt-6 mb-6';
    msg.textContent = 'No hooks yet. Pick a mode, then Add.';
    return msg;
  }
  function makeActions(onAdd){
    const actions = document.createElement('div');
    actions.className = 'ed-row-6 mt-6';
    const sel = document.createElement('select');
    sel.className = 'select select-xs';
    ['http','sql','js','empty'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v.toUpperCase(); sel.appendChild(o); });
    const add = document.createElement('button');
    add.textContent = 'Add';
    add.className = 'btn btn-xs';
    add.title = 'Add hook';
    add.onclick = ()=>{
      try{ if (typeof onAdd==='function') onAdd(sel.value); }catch{}
    };
    actions.appendChild(sel);
    actions.appendChild(add);
    return actions;
  }
  function hookList(container, hooks, options, onChange){
  const c = (typeof container==='string') ? document.querySelector(container) : container;
  while (c.firstChild) c.removeChild(c.firstChild);
    const list = document.createElement('div');
    c.appendChild(list);
    const emptyMsg = makeEmptyMessage();
    c.appendChild(emptyMsg);
    const actions = makeActions((mode)=>{
      if (mode==='http') addRow({ __mode:'http', request: { method:'GET', url:'', headers:{}, query:{}, body:'' } });
      else if (mode==='sql') addRow({ __mode:'sql', sql: { driver:'', dsn:'', query:'', extract:{} } });
      else if (mode==='js') addRow({ __mode:'js', js: { code:'' } });
      else addRow({ __mode:'empty' });
      try{
        if (window.hydreqEditorUtils && window.hydreqEditorUtils.hide) window.hydreqEditorUtils.hide(emptyMsg);
        else { emptyMsg.classList.add('hidden'); try{ emptyMsg.style.display = 'none'; }catch{} }
      }catch{}
      try{ if (onChange) onChange(); }catch{}
    });
    c.appendChild(actions);

    function addRow(h){
      const row = document.createElement('div'); row.className = 'hk-card';
      // mode
  const mode = h && h.__mode ? h.__mode : (h && h.sql ? 'sql' : (h && h.request ? 'http' : (h && h.js ? 'js' : 'empty')));
      row._mode = mode;
      // header
  const header = document.createElement('div');
    header.className='hk-header ed-row-6 ed-ai-center';
    const toggle = document.createElement('button');
    toggle.textContent='▾';
    toggle.className='btn btn-ghost btn-xs w-24px';
    const nameI = document.createElement('input');
    nameI.className='hk_name flex-1';
    nameI.type='text';
    nameI.placeholder='hook name';
    nameI.value=h?.name||'';
      const badge = document.createElement('span'); badge.className='badge hk_type'; badge.textContent = (mode==='http'?'HTTP':(mode==='sql'?'SQL':(mode==='js'?'JS':'·')));
      const runBtn = document.createElement('button'); runBtn.className='btn btn-xs hk_run'; runBtn.textContent='Run';
      const convertBtn = document.createElement('button'); convertBtn.className='btn btn-xs'; convertBtn.textContent='Convert…'; convertBtn.title='Switch mode';
      const delBtn = document.createElement('button'); delBtn.className='btn btn-xs hk_del'; delBtn.textContent='×'; delBtn.title='Remove';
      header.appendChild(toggle); header.appendChild(nameI); header.appendChild(badge); header.appendChild(runBtn); header.appendChild(convertBtn); header.appendChild(delBtn);
      row.appendChild(header);
  const body = document.createElement('div');
      body.className='p-8';
      row.appendChild(body);
      // container grid: single column to maximize content width
  const grid = document.createElement('div'); grid.className='ed-grid-1';
      body.appendChild(grid);
      // Vars
      const varsHeader = document.createElement('div'); varsHeader.className='ed-subhead'; varsHeader.textContent='Variables'; grid.appendChild(varsHeader);
      const varsDiv=document.createElement('div'); varsDiv.className='hk_vars'; grid.appendChild(varsDiv);
      const varsGet = (window.hydreqEditorTables && window.hydreqEditorTables.kvTable)
        ? window.hydreqEditorTables.kvTable(varsDiv, h?.vars||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} })
        : (()=>({}));
      // HTTP section (no outer label to save horizontal space)
      const httpC = document.createElement('div'); httpC.className='hk_http'; grid.appendChild(httpC);
  const http = h?.request||{};
      const hg = document.createElement('div');
      hg.className='ed-grid-2-110';
      // Build HTTP controls with safe setters
      const httpMethodLabel = document.createElement('label'); httpMethodLabel.textContent='Method';
      const httpMethodSel = document.createElement('select'); httpMethodSel.className='hk_method select select-xs';
      const httpUrlLabel = document.createElement('label'); httpUrlLabel.textContent='URL';
      const httpUrlInput = document.createElement('input'); httpUrlInput.className='hk_url'; httpUrlInput.type='text'; httpUrlInput.value = http.url||'';
      const httpHeadersLabel = document.createElement('label'); httpHeadersLabel.textContent='Headers';
      const httpHeadersDiv = document.createElement('div'); httpHeadersDiv.className='hk_headers';
      const httpQueryLabel = document.createElement('label'); httpQueryLabel.textContent='Query';
      const httpQueryDiv = document.createElement('div'); httpQueryDiv.className='hk_query';
      const httpBodyLabel = document.createElement('label'); httpBodyLabel.textContent='Body';
      const httpBodyTA = document.createElement('textarea'); httpBodyTA.className='hk_body h-80px';
      hg.appendChild(httpMethodLabel);
      hg.appendChild(httpMethodSel);
      hg.appendChild(httpUrlLabel);
      hg.appendChild(httpUrlInput);
      hg.appendChild(httpHeadersLabel);
      hg.appendChild(httpHeadersDiv);
      hg.appendChild(httpQueryLabel);
      hg.appendChild(httpQueryDiv);
      hg.appendChild(httpBodyLabel);
      hg.appendChild(httpBodyTA);
      httpC.appendChild(hg);
      // populate method options safely
      (function(){
        const sel = hg.querySelector('.hk_method');
        const cur = String((http.method||'').toUpperCase());
        ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].forEach(m=>{
          const o=document.createElement('option'); o.value=m; o.textContent=m; if (cur===m) o.selected=true; sel.appendChild(o);
        });
      })();
  const hkHeadGet = (window.hydreqEditorTables && window.hydreqEditorTables.kvTable)
    ? window.hydreqEditorTables.kvTable(httpHeadersDiv, http.headers||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} })
    : (()=>({}));
  const hkQueryGet = (window.hydreqEditorTables && window.hydreqEditorTables.kvTable)
    ? window.hydreqEditorTables.kvTable(httpQueryDiv, http.query||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} })
    : (()=>({}));
  try { httpBodyTA.value = (http.body && typeof http.body==='object')? JSON.stringify(http.body,null,2):(http.body||''); } catch { httpBodyTA.value = http.body||''; }
      // JS section (no outer label to save horizontal space)
      const jsC = document.createElement('div'); jsC.className='hk_js'; grid.appendChild(jsC);
  const js = h?.js||{}; const jsg = document.createElement('div'); jsg.className='ed-grid-2-110';
      const jsLbl = document.createElement('label'); jsLbl.textContent='Code';
      const jsTA = document.createElement('textarea'); jsTA.className='hk_js_code mono-12 h-120px'; jsTA.placeholder='JavaScript code...'; jsTA.value = js.code||'';
      jsg.appendChild(jsLbl); jsg.appendChild(jsTA); jsC.appendChild(jsg);
      // SQL section (no outer label to save horizontal space)
      const sqlC = document.createElement('div'); sqlC.className='hk_sql'; grid.appendChild(sqlC);
  const sql = h?.sql||{}; const sg = document.createElement('div'); sg.className='ed-grid-2-110';
      // Driver
      const driverLbl = document.createElement('label'); driverLbl.textContent='Driver';
      const driverSel = document.createElement('select'); driverSel.className='hk_driver select select-xs';
      const optEmpty = document.createElement('option'); optEmpty.value=''; optEmpty.textContent='(select)'; driverSel.appendChild(optEmpty);
      [['sqlite','sqlite'], ['pgx','pgx (Postgres)'], ['sqlserver','sqlserver (SQL Server)']].forEach(([val,txt])=>{ const o=document.createElement('option'); o.value=val; o.textContent=txt; if (sql.driver===val) o.selected=true; driverSel.appendChild(o); });
      // DSN + actions row
      const dsnLbl = document.createElement('label'); dsnLbl.textContent='DSN';
      const dsnRow = document.createElement('div'); dsnRow.className='row gap-8 ai-center';
      const dsnInput = document.createElement('input'); dsnInput.className='hk_dsn flex-1'; dsnInput.type='password'; dsnInput.placeholder='file:./qa.sqlite?cache=shared'; dsnInput.value = sql.dsn||'';
      const dsnToggleBtn = document.createElement('button'); dsnToggleBtn.className='hk_toggle_dsn btn btn-xs'; dsnToggleBtn.type='button'; dsnToggleBtn.title='Show/Hide'; dsnToggleBtn.textContent='👁';
      const dsnFillBtn = document.createElement('button'); dsnFillBtn.className='hk_fill_dsn btn btn-xs'; dsnFillBtn.type='button'; dsnFillBtn.title='Fill template'; dsnFillBtn.textContent='Use template';
      dsnRow.appendChild(dsnInput); dsnRow.appendChild(dsnToggleBtn); dsnRow.appendChild(dsnFillBtn);
      // Query
      const queryLbl = document.createElement('label'); queryLbl.textContent='Query';
      const queryTA = document.createElement('textarea'); queryTA.className='hk_querytxt h-80px'; queryTA.value = sql.query||'';
      // Extract
      const extractLbl = document.createElement('label'); extractLbl.textContent='Extract';
      const extractDiv = document.createElement('div'); extractDiv.className='hk_sqlextract';
      // Append
      sg.appendChild(driverLbl); sg.appendChild(driverSel);
      sg.appendChild(dsnLbl); sg.appendChild(dsnRow);
      sg.appendChild(queryLbl); sg.appendChild(queryTA);
      sg.appendChild(extractLbl); sg.appendChild(extractDiv);
      sqlC.appendChild(sg);
      dsnToggleBtn.onclick = ()=>{
        const show = (dsnInput.type==='password');
        dsnInput.type = show ? 'text' : 'password';
        try{ dsnToggleBtn.textContent = show ? '🙈' : '👁'; dsnToggleBtn.title = show ? 'Hide' : 'Show'; }catch{}
      };
      const hkSQLExtractGet = (window.hydreqEditorTables && window.hydreqEditorTables.kvTable)
        ? window.hydreqEditorTables.kvTable(extractDiv, sql.extract||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} })
        : (()=>({}));
      const driverEl = driverSel;
      const dsnEl = dsnInput;
      const dsnPH = { sqlite: 'file:./qa.sqlite?cache=shared', pgx: 'postgres://user:pass@localhost:5432/db?sslmode=disable', sqlserver: 'sqlserver://sa:Your_password123@localhost:1433?database=master' };
      function refreshDsnPH(){ const v=(driverEl.value||'').trim(); dsnEl.placeholder = dsnPH[v]||''; }
      driverEl.addEventListener('change', refreshDsnPH); refreshDsnPH();
      const fillBtn = dsnFillBtn; if (fillBtn) fillBtn.onclick = ()=>{ let v=(driverEl.value||'').trim(); let tmpl=dsnPH[v]||''; if(!tmpl){
          // If driver not selected, default to sqlite template for convenience
          v='sqlite'; tmpl=dsnPH[v]||'';
          try{ if (!tmpl) throw new Error(''); }catch{ /* no-op */ }
          if (!tmpl) { try{ alert('Select a SQL driver first to use a DSN template.'); }catch{} return; }
          // reflect default selection in UI if empty
          try{ if (!driverEl.value){ driverEl.value = v; refreshDsnPH(); } }catch{}
        }
        if(!dsnEl.value || confirm('Overwrite DSN with template?')) dsnEl.value = tmpl; };
      // enforce mode visibility
      function applyMode(){
        const showHTTP = (row._mode==='http');
        const showSQL = (row._mode==='sql');
        const showJS = (row._mode==='js');
        const utils = window.hydreqEditorUtils || {};
        const showFn = utils.show || function(el){ if (!el) return; el.classList.remove('hidden'); el.classList.add('open'); try{ el.style.display=''; }catch{} };
        const hideFn = utils.hide || function(el){ if (!el) return; el.classList.add('hidden'); el.classList.remove('open'); try{ el.style.display='none'; }catch{} };
        (showHTTP ? showFn : hideFn)(httpC);
        (showSQL ? showFn : hideFn)(sqlC);
        (showJS ? showFn : hideFn)(jsC);
        badge.textContent = (row._mode==='http'?'HTTP':(row._mode==='sql'?'SQL':(row._mode==='js'?'JS':'·')));
      }
      applyMode();
      // header collapse
      toggle.onclick = ()=>{
        const utils = window.hydreqEditorUtils || {};
        const open = !body.classList.contains('hidden');
        if (open) utils.hide(body); else utils.show(body);
        toggle.textContent = open ? '▸' : '▾';
      };
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
  delBtn.onclick = ()=> { row.remove(); try{ if (!list.children.length) emptyMsg.classList.remove('hidden'); }catch{} };
      // output area
  const out = document.createElement('div');
      out.className='log mt-8';
      body.appendChild(out);
      // run
  runBtn.onclick = async ()=>{
  const req={ method: (httpMethodSel.value||'').toUpperCase(), url: httpUrlInput.value||'', headers: hkHeadGet(), query: hkQueryGet(), body: (function(txt){ try{ return txt?JSON.parse(txt):null }catch{return txt} })(httpBodyTA.value.trim()) };
  const sql={ driver: driverEl.value||'', dsn: dsnEl.value||'', query: (queryTA.value||''), extract: hkSQLExtractGet() };
  const js = { code: (jsTA.value || '') };
    const name = nameI.value||''; const vars = varsGet(); const payload = { name, vars };
    if (row._mode==='http') payload.request = req; else if (row._mode==='sql') payload.sql = sql; else if (row._mode==='js') payload.js = js;
    const env = (typeof parseEnv==='function') ? parseEnv() : {};
    const scope = (options && options.scope) || 'suitePre';
  while (out.firstChild) out.removeChild(out.firstChild);
  { const d = document.createElement('div'); d.textContent='Running...'; out.appendChild(d); }
    const wk = (window.hydreqEditorState && window.hydreqEditorState.getWorking) ? window.hydreqEditorState.getWorking() : (typeof working!=='undefined'? working: {});
    const idx = (window.hydreqEditorState && window.hydreqEditorState.getSelIndex) ? window.hydreqEditorState.getSelIndex() : (typeof selIndex!=='undefined' ? selIndex : 0);
    let res; try { res = await fetch('/api/editor/hookrun', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parsed: wk, scope, testIndex: idx, hook: payload, env })}); } catch(e){ out.textContent = 'Network error'; return; }
        if (!res.ok){ const t=await res.text().catch(()=> ''); out.textContent = 'Run failed: ' + t; return; }
  const r = await res.json(); const icon = r.status==='passed'?'✓':(r.status==='failed'?'✗':'-'); const hdr = document.createElement('div'); hdr.className='fw-600'; hdr.textContent = `${icon} hook ${r.name||''} (${r.durationMs||0} ms)`; while (out.firstChild) out.removeChild(out.firstChild); out.appendChild(hdr);
        if (Array.isArray(r.messages) && r.messages.length){ const det=document.createElement('details'); det.className='ed-msg-details'; const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); const pre=document.createElement('pre'); pre.className = 'message-block ' + (r.status==='failed'?'fail':(r.status==='skipped'?'skip':'ok')); pre.textContent = r.messages.join('\n'); det.appendChild(pre); out.appendChild(det); }
        if (r.vars && Object.keys(r.vars).length){ const det=document.createElement('details'); const sum=document.createElement('summary'); sum.textContent='vars'; det.appendChild(sum); const pre=document.createElement('pre'); pre.textContent = JSON.stringify(r.vars,null,2); det.appendChild(pre); out.appendChild(det); }
      };
      // getter
      row._get = ()=>{
        const name = nameI.value||'';
        const vars = varsGet();
        const outObj = { name, vars };
        if (row._mode==='http'){
          const req={ method: (httpMethodSel.value||'').toUpperCase(), url: httpUrlInput.value||'', headers: hkHeadGet(), query: hkQueryGet(), body: (function(txt){ try{ return txt?JSON.parse(txt):null }catch{return txt} })(httpBodyTA.value.trim()) };
          if (req.method||req.url||Object.keys(req.headers||{}).length||Object.keys(req.query||{}).length||httpBodyTA.value.trim()) outObj.request=req;
        } else if (row._mode==='sql'){
          const sqlObj={ driver: driverEl.value||'', dsn: dsnEl.value||'', query: (queryTA.value||''), extract: hkSQLExtractGet() };
          if (sqlObj.driver||sqlObj.dsn||sqlObj.query||Object.keys(sqlObj.extract||{}).length) outObj.sql=sqlObj;
        } else if (row._mode==='js'){
          const jsObj={ code: (jsTA.value || '') };
          if (jsObj.code.trim()) outObj.js=jsObj;
        }
        return outObj;
      };
      list.appendChild(row);
      // If we added at least one row, hide empty message
      try{ if (list.children.length) {
        if (window.hydreqEditorUtils && window.hydreqEditorUtils.hide) window.hydreqEditorUtils.hide(emptyMsg);
        else { emptyMsg.classList.add('hidden'); try{ emptyMsg.style.display = 'none'; }catch{} }
      } }catch{}
    }
    // populate
    if (Array.isArray(hooks) && hooks.length){ hooks.forEach(h=> addRow(h)); try{ emptyMsg.classList.add('hidden'); }catch{} }
    return ()=> Array.from(list.children).map(r=> r._get ? r._get() : null).filter(Boolean);
  }

  window.hydreqEditorHooks = window.hydreqEditorHooks || {};
  window.hydreqEditorHooks.hookList = hookList;
})();
