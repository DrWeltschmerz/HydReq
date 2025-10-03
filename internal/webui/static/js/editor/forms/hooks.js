(function(){
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
      const row = document.createElement('div'); row.className = 'hk-card';
      // mode
      const mode = h && h.__mode ? h.__mode : (h && h.sql ? 'sql' : (h && h.request ? 'http' : (h && h.js ? 'js' : 'empty')));
      row._mode = mode;
      // header
  const header = document.createElement('div'); header.className='hk-header ed-row-6 ed-ai-center';
  const toggle = document.createElement('button'); toggle.textContent='▾'; toggle.className='btn btn-ghost btn-xs w-24px';
      const nameI = document.createElement('input'); nameI.className='hk_name'; nameI.type='text'; nameI.placeholder='hook name'; nameI.value=h?.name||''; nameI.style.flex='1';
      const badge = document.createElement('span'); badge.className='badge hk_type'; badge.textContent = (mode==='http'?'HTTP':(mode==='sql'?'SQL':(mode==='js'?'JS':'·')));
      const runBtn = document.createElement('button'); runBtn.className='btn btn-xs hk_run'; runBtn.textContent='Run';
      const convertBtn = document.createElement('button'); convertBtn.className='btn btn-xs'; convertBtn.textContent='Convert…'; convertBtn.title='Switch mode';
      const delBtn = document.createElement('button'); delBtn.className='btn btn-xs hk_del'; delBtn.textContent='×'; delBtn.title='Remove';
      header.appendChild(toggle); header.appendChild(nameI); header.appendChild(badge); header.appendChild(runBtn); header.appendChild(convertBtn); header.appendChild(delBtn);
      row.appendChild(header);
  const body = document.createElement('div'); body.className='p-8'; row.appendChild(body);
      // container grid: single column to maximize content width
  const grid = document.createElement('div'); grid.className='ed-grid-1';
      body.appendChild(grid);
      // Vars
      const varsHeader = document.createElement('div'); varsHeader.className='ed-subhead'; varsHeader.textContent='Variables'; grid.appendChild(varsHeader);
      const varsDiv=document.createElement('div'); varsDiv.className='hk_vars'; grid.appendChild(varsDiv);
      const varsGet = kvTable(varsDiv, h?.vars||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} });
      // HTTP section (no outer label to save horizontal space)
      const httpC = document.createElement('div'); httpC.className='hk_http'; grid.appendChild(httpC);
  const http = h?.request||{}; const hg = document.createElement('div'); hg.className='ed-grid-2-110';
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
      // JS section (no outer label to save horizontal space)
      const jsC = document.createElement('div'); jsC.className='hk_js'; grid.appendChild(jsC);
  const js = h?.js||{}; const jsg = document.createElement('div'); jsg.className='ed-grid-2-110';
      jsg.innerHTML = `
        <label>Code</label><textarea class="hk_js_code" style="height:120px; font-family: 'Courier New', monospace; font-size: 12px;" placeholder="JavaScript code...">${js.code||''}</textarea>`;
      jsC.appendChild(jsg);
      // SQL section (no outer label to save horizontal space)
      const sqlC = document.createElement('div'); sqlC.className='hk_sql'; grid.appendChild(sqlC);
  const sql = h?.sql||{}; const sg = document.createElement('div'); sg.className='ed-grid-2-110';
      sg.innerHTML = `
        <label>Driver</label>
        <select class="hk_driver select select-xs"><option value="">(select)</option><option value="sqlite" ${sql.driver==='sqlite'?'selected':''}>sqlite</option><option value="pgx" ${sql.driver==='pgx'?'selected':''}>pgx (Postgres)</option><option value="sqlserver" ${sql.driver==='sqlserver'?'selected':''}>sqlserver (SQL Server)</option></select>
        <label>DSN</label>
        <div style="display:flex;gap:6px;align-items:center"><input class="hk_dsn" type="password" value="${sql.dsn||''}" style="flex:1" placeholder="file:./qa.sqlite?cache=shared"><button class="hk_toggle_dsn" type="button" title="Show/Hide">👁</button><button class="hk_fill_dsn" type="button" title="Fill template">Use template</button></div>
        <label>Query</label><textarea class="hk_querytxt" style="height:80px">${sql.query||''}</textarea>
        <label>Extract</label><div class="hk_sqlextract"></div>`;
      sqlC.appendChild(sg);
      const toggleBtn = sg.querySelector('.hk_toggle_dsn'); const dsnInput = sg.querySelector('.hk_dsn'); toggleBtn.onclick = ()=>{ const show = (dsnInput.type==='password'); dsnInput.type = show?'text':'password'; try{ toggleBtn.textContent = show?'🙈':'👁'; toggleBtn.title = show?'Hide':'Show'; }catch{} };
      const hkSQLExtractGet = kvTable(sg.querySelector('.hk_sqlextract'), sql.extract||{}, ()=>{ try{ sync(); syncYamlPreviewFromVisual(); markDirty(); }catch{} });
      const driverEl = sg.querySelector('.hk_driver'); const dsnEl = sg.querySelector('.hk_dsn'); const dsnPH = { sqlite: 'file:./qa.sqlite?cache=shared', pgx: 'postgres://user:pass@localhost:5432/db?sslmode=disable', sqlserver: 'sqlserver://sa:Your_password123@localhost:1433?database=master' };
      function refreshDsnPH(){ const v=(driverEl.value||'').trim(); dsnEl.placeholder = dsnPH[v]||''; }
      driverEl.addEventListener('change', refreshDsnPH); refreshDsnPH();
      const fillBtn = sg.querySelector('.hk_fill_dsn'); if (fillBtn) fillBtn.onclick = ()=>{ let v=(driverEl.value||'').trim(); let tmpl=dsnPH[v]||''; if(!tmpl){
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
        httpC.style.display = showHTTP?'':'none';
        sqlC.style.display = showSQL?'':'none';
        jsC.style.display = showJS?'':'none';
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
  const out = document.createElement('div'); out.className='log mt-8'; body.appendChild(out);
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

  window.hydreqEditorHooks = window.hydreqEditorHooks || {};
  window.hydreqEditorHooks.hookList = hookList;
})();
