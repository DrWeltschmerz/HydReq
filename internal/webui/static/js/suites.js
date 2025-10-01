// suites.js - Suite management functions for HydReq GUI

// Global variables for suite management
let selected = new Set();
let batch = { done: 0, total: 0 };
let suite = { done: 0, total: 0 };
const testRows = new Map(); // Name -> {container, line}
const agg = { passed:0, failed:0, skipped:0, total:0, suites:0, durationMs:0 };
let currentSuitePath = null; // canonical path/key for suite currently running
const pendingTestEvents = new Map(); // path -> [events]

// Render the list of test suites
function renderSuites(list){
  const suitesEl = document.getElementById('suites');
  if (!suitesEl) return;

  console.log('renderSuites: rendering', list.length, 'items');
  try{
    if ((!list || list.length===0) && typeof window !== 'undefined'){
      if (!document.getElementById('hydreq-debug-banner')){
        const banner = document.createElement('div'); banner.id='hydreq-debug-banner'; banner.style.padding='12px'; banner.style.background='rgba(255,0,0,0.06)'; banner.style.border='1px solid rgba(255,0,0,0.12)'; banner.style.margin='8px'; banner.style.borderRadius='6px'; banner.textContent = 'HYDREQ-DBG: No suites returned from /api/editor/suites';
        const aside = document.querySelector('aside'); if (aside) aside.insertBefore(banner, aside.firstChild);
      }
    } else {
      const b = document.getElementById('hydreq-debug-banner'); if (b && b.parentNode) b.parentNode.removeChild(b);
    }
  }catch(e){}
  suitesEl.innerHTML = '';
  list.forEach(item => {
        const path = (typeof item === 'string') ? item : (item.path || item.Path || item.file || JSON.stringify(item));
        const pathKey = path;
        const base = (typeof path === 'string' ? path.split('/').pop() : String(path));
        const friendly = (item && (item.name || item.Name)) ? (item.name || item.Name) : null;
  const li = document.createElement('li'); li.style.display='flex'; li.style.alignItems='center'; li.style.justifyContent='space-between'; li.style.gap='8px';
  li.dataset.path = pathKey;
        const name = document.createElement('span'); name.style.flex='1'; name.style.display='flex'; name.style.flexDirection='column'; name.style.alignItems='flex-start'; name.style.gap='2px';
    const titleRow = document.createElement('div'); titleRow.style.display='flex'; titleRow.style.flexDirection='row'; titleRow.style.alignItems='baseline'; titleRow.style.gap='8px';
    const expandBtn = document.createElement('button'); expandBtn.className = 'btn btn-ghost btn-xs'; expandBtn.textContent = '▸'; expandBtn.title = 'Show tests'; expandBtn.style.width = '28px';
    expandBtn.setAttribute('aria-expanded','false'); expandBtn.setAttribute('aria-label','Toggle tests'); expandBtn.tabIndex = 0;
    expandBtn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandBtn.click(); } });
    expandBtn._expandPromise = null;
    expandBtn._resolveExpand = null;
    expandBtn.addEventListener('click', async function (e){
      e.stopPropagation();
      const open = expandBtn.dataset.open === '1';
      if (open){
        expandBtn.dataset.open = '0';
        expandBtn.textContent = '▸';
        expandBtn.setAttribute('aria-expanded','false');
        testsDiv.classList.remove('open');
        testsDiv.style.display = 'none';
        return;
      }
      expandBtn.dataset.open = '1';
      expandBtn.textContent = '▾';
      expandBtn.setAttribute('aria-expanded','true');
      let spinner = null;
      if (!expandBtn.dataset.loaded){ spinner = document.createElement('span'); spinner.className = 'spinner'; expandBtn.insertBefore(spinner, expandBtn.firstChild); }
      if (!expandBtn._expandPromise){ expandBtn._expandPromise = new Promise((res)=>{ expandBtn._resolveExpand = res; }); }
      if (!expandBtn.dataset.loaded){
        try{
          const p = encodeURIComponent(pathKey);
          const res = await fetch('/api/editor/suite?path='+p);
          if (res.ok){
            const dd = await res.json();
            const parsed = dd.parsed || dd;
            const tests = (parsed && parsed.tests) ? parsed.tests : [];
            testsDiv.innerHTML='';
            tests.forEach(t=>{
              const row = document.createElement('div');
              row.style.display='flex';
              row.style.justifyContent='space-between';
              row.style.padding='4px 6px';
              const nm = document.createElement('span'); nm.textContent = t.name || t.Name || '(unnamed)'; nm.title = nm.textContent;
              const badge = document.createElement('span'); badge.className='pill';
              const tr = testRows.get(nm.textContent);
              if (tr && tr.line){
                const cls = tr.line.className || '';
                if (cls.indexOf('ok')>=0) { badge.textContent = '✓'; badge.style.background='rgba(16,185,129,0.12)'; }
                else if (cls.indexOf('fail')>=0) { badge.textContent = '✗'; badge.style.background='rgba(239,68,68,0.08)'; }
                else if (cls.indexOf('skip')>=0) { badge.textContent = '-'; badge.style.background='rgba(245,158,11,0.06)'; }
                else { badge.textContent = '·'; badge.style.opacity = '.6'; }
              } else { badge.textContent = '·'; badge.style.opacity = '.6'; }
              row.appendChild(nm); row.appendChild(badge); testsDiv.appendChild(row);
            });
            expandBtn.dataset.loaded = '1';
            try{ flushPendingForPath(pathKey); }catch(e){}
          }
        } catch(err){ testsDiv.innerHTML = '<div class="dim">Failed to load tests</div>'; }
      }
      try{ if (spinner && spinner.parentNode) spinner.remove(); }catch{}
      try{ const id = 'tests-' + slugify(pathKey); testsDiv.id = id; expandBtn.setAttribute('aria-controls', id); }catch{}
      testsDiv.classList.add('open'); testsDiv.style.display='block';
      try{ if (expandBtn._resolveExpand) { expandBtn._resolveExpand(); expandBtn._expandPromise = null; expandBtn._resolveExpand = null; } }catch(e){}
    });
  const titleSpan = document.createElement('span'); titleSpan.className = 'spec-title'; titleSpan.style.fontWeight='600'; titleSpan.style.fontSize='16px';
        titleSpan.textContent = friendly && (typeof friendly === 'string') && friendly.trim() !== '' ? friendly : base;
  const suiteBadge = document.createElement('span'); suiteBadge.className = 'pill suite-badge'; suiteBadge.textContent = '·'; suiteBadge.style.opacity = '.6'; suiteBadge.title = 'suite status'; suiteBadge.dataset.status = 'unknown';
  titleRow.appendChild(expandBtn); titleRow.appendChild(titleSpan); titleRow.appendChild(suiteBadge);
        name.appendChild(titleRow);
        
        // Add filename below the title if it differs from the suite name
        if (friendly && (typeof friendly === 'string') && friendly.trim() !== '' && friendly !== base) {
          const fileRow = document.createElement('div'); fileRow.style.marginLeft = '32px'; // Align with title after expand button
          const fileSpan = document.createElement('span'); fileSpan.textContent = base; fileSpan.style.opacity = 0.5; fileSpan.style.fontSize = '11px'; fileSpan.className = 'spec-file';
          fileRow.appendChild(fileSpan);
          name.appendChild(fileRow);
        }
 
        const testsDiv = document.createElement('div'); testsDiv.className = 'suite-tests'; testsDiv.style.display='none'; testsDiv.style.marginTop='6px'; testsDiv.style.paddingLeft='6px'; testsDiv.style.borderLeft='2px solid rgba(0,0,0,0.04)'; name.appendChild(testsDiv);
        const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.title='Open editor';
        editBtn.dataset.path = pathKey;
        editBtn.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const btn = e.currentTarget;
          const pth = btn && btn.getAttribute && btn.getAttribute('data-path');
          console.log('editBtn clicked, data-path=', pth);
          if (!pth) { console.error('Edit handler: missing data-path on clicked element'); return; }
          const res = await fetch('/api/editor/suite?path='+encodeURIComponent(pth));
          if (!res.ok){ alert('Failed to load suite'); return; }
          const data = await res.json();
          try { openEditor(pth, data); } catch (err) { console.error('openEditor failed', err); alert('Failed to open editor: '+ (err && err.message ? err.message : err)); }
        });
        const dlWrap = document.createElement('span'); dlWrap.style.position='relative'; dlWrap.style.display='inline-block';
        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn btn-ghost btn-xs';
        dlBtn.title = 'Download';
        dlBtn.setAttribute('aria-label', 'Download suite'); // improve accessibility
        // create an icon span and a text span so we can style/separate them easily
        const dlIcon = document.createElement('span');
        dlIcon.className = 'dl-icon';
        dlIcon.textContent = '▾';
        dlIcon.style.marginRight = '6px';
        const dlText = document.createElement('span');
        dlText.className = 'dl-text';
        dlText.textContent = 'Download';
        dlBtn.appendChild(dlIcon);
        dlBtn.appendChild(dlText);
        dlBtn.dataset.path = pathKey;
        const dlMenu = document.createElement('div'); dlMenu.style.position='absolute'; dlMenu.style.right='0'; dlMenu.style.top='28px'; dlMenu.style.minWidth='140px'; dlMenu.style.border='1px solid var(--bd)'; dlMenu.style.background='var(--bg)'; dlMenu.style.padding='6px'; dlMenu.style.borderRadius='6px'; dlMenu.style.boxShadow='0 6px 12px rgba(0,0,0,0.08)'; dlMenu.style.display='none'; dlMenu.style.zIndex='10';
        const addDl = (label, fmt)=>{ const b = document.createElement('div'); b.textContent = label; b.style.padding='6px'; b.style.cursor='pointer'; b.style.borderRadius='4px'; b.onclick = (e)=>{ e.stopPropagation(); const p = dlBtn.getAttribute && dlBtn.getAttribute('data-path'); if (!p) { console.error('download: missing data-path'); return; } downloadSuite(p, fmt); dlMenu.style.display='none'; }; b.onmouseenter = ()=> b.style.background='var(--li-hov)'; b.onmouseleave = ()=> b.style.background='transparent'; dlMenu.appendChild(b); };
        addDl('Download JSON','json'); addDl('Download JUnit','junit'); addDl('Download HTML','html');
        dlBtn.addEventListener('click', (e)=>{ e.stopPropagation(); dlMenu.style.display = (dlMenu.style.display === 'none') ? 'block' : 'none'; });
        document.addEventListener('click', ()=>{ try{ dlMenu.style.display='none'; }catch{} });
        dlWrap.appendChild(dlBtn); dlWrap.appendChild(dlMenu);
  li.appendChild(name); li.appendChild(dlWrap); li.appendChild(editBtn);
  li.style.marginBottom = '6px';
        if (selected.has(pathKey)) li.classList.add('selected');
        li.onclick = () => { if (selected.has(pathKey)) selected.delete(pathKey); else selected.add(pathKey); localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected))); const selCount = document.getElementById('selCount'); if (selCount) selCount.textContent = selected.size + ' selected'; renderSuites(list); };
        suitesEl.appendChild(li);
      });
      const selCount = document.getElementById('selCount');
      if (selCount) selCount.textContent = selected.size + ' selected';
}

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

// Refresh the suite list from the server
async function refresh(){
  console.log('refresh: fetching /api/editor/suites');
  try {
    const res = await fetch('/api/editor/suites');
    console.log('refresh: fetch complete, status=', res && res.status);
    try{ window.__HYDREQ_REFRESH = window.__HYDREQ_REFRESH || {}; window.__HYDREQ_REFRESH.status = res && res.status; console.log('refresh: set status to', window.__HYDREQ_REFRESH.status); }catch{}
    let list = [];
    try { list = await res.json(); console.log('refresh: parsed JSON, list length:', Array.isArray(list) ? list.length : 'not array'); } catch (e) { console.error('refresh: failed parsing JSON', e); }
    console.log('refresh: got list (len=', (Array.isArray(list)?list.length:0), ')');
    try{ window.__HYDREQ_REFRESH.list = list; window.__HYDREQ_REFRESH.len = Array.isArray(list)?list.length:0; console.log('refresh: set list and len', window.__HYDREQ_REFRESH.len); }catch{}
    try { renderSuites(list || []); console.log('refresh: renderSuites completed'); } catch (e) { console.error('refresh: renderSuites threw', e); try{ window.__HYDREQ_REFRESH.err = String(e); }catch{} }
    try { const results = document.getElementById('results'); if (results) { const d=document.createElement('div'); d.textContent = 'DEBUG: refresh list len=' + (Array.isArray(list)?list.length:0); results.appendChild(d); } }catch(e){}
  } catch (err) {
    console.error('refresh: fetch failed', err);
    try{ window.__HYDREQ_REFRESH = window.__HYDREQ_REFRESH || {}; window.__HYDREQ_REFRESH.err = String(err); }catch{}
  }
}

// Run selected test suites
async function run(){
  console.log('run called');
  let suites = Array.from(selected);
  if (suites.length === 0) {
    const resAll = await fetch('/api/editor/suites');
    if (!resAll.ok) { alert('No suites selected and failed to load suites'); return; }
    const alllist = await resAll.json();
    suites = alllist.map(i => (typeof i === 'string') ? i : (i.path || i.Path || i.file || JSON.stringify(i)));
  }
  const env = parseEnv();
  renderActiveEnv(env);
  const tagsEl = document.getElementById('tags');
  const defToEl = document.getElementById('defaultTimeout');
  const tags = (tagsEl && tagsEl.value)? tagsEl.value.split(',').map(s=>s.trim()).filter(Boolean) : [];
  console.log('tags:', tags);
  const defaultTimeoutMs = (defToEl && defToEl.value)? (parseInt(defToEl.value,10)||0) : 0;
  const workersEl = document.getElementById('workers');
  const res = await fetch('/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({suites, workers: parseInt(workersEl.value)||4, tags: Array.isArray(tags) ? tags : [], defaultTimeoutMs: (defaultTimeoutMs>0? defaultTimeoutMs: undefined), env})});
  if (!res.ok){
    let txt = '';
    try { txt = await res.text(); } catch {}
    alert('Run failed: ' + res.status + (txt?(' - '+txt):''));
    return;
  }
  const { runId } = await res.json();
  window.currentRunId = runId;
  listen(runId);
}

// Listen for test run events
function listen(id){
  batch = { done:0, total:0 }; suite = { done:0, total:0 };
  try{ window.__E2E_LISTENED = id; }catch(e){}
  const results = document.getElementById('results');
  const stages = document.getElementById('stages');
  const batchBar = document.getElementById('batchBar');
  const batchText = document.getElementById('batchText');
  const suiteBar = document.getElementById('suiteBar');
  const suiteText = document.getElementById('suiteText');
  const currentSuiteEl = document.getElementById('currentSuite');
  if (results) results.textContent=''; 
  if (stages) stages.innerHTML=''; 
  if (batchBar) setBar(batchBar,0,1); 
  if (batchText) batchText.textContent = '0/0'; 
  if (suiteBar) setBar(suiteBar,0,1); 
  if (suiteText) suiteText.textContent = '0/0';
  const es = new EventSource('/api/stream?runId=' + encodeURIComponent(id));
  try{ es.onopen = function(){ try{ window.__E2E_ES_OPEN = true; }catch(e){} }; }catch(e){}
  es.onmessage = async (e)=>{
    const ev = JSON.parse(e.data);
    const type = ev.type;
    const payload = ev.payload || {};
    async function expandSuiteByPath(target){
      try{
        const list = document.querySelectorAll('#suites li');
        for (const li of list){
          try{
            const btnEl = li.querySelector('button[aria-controls]');
            const pathKey = li.getAttribute('data-path') || (btnEl && btnEl.getAttribute && btnEl.getAttribute('data-path')) || null;
            if (!pathKey) continue;
            if (pathKey === target || li.querySelector('.spec-title')?.textContent === target){
              const btn = btnEl || li.querySelector('button');
              const testsDiv = li.querySelector('.suite-tests');
              if (!testsDiv) return;
              if (btn && btn.dataset.open !== '1') {
                try{
                  btn.click();
                  if (btn._expandPromise && typeof btn._expandPromise.then === 'function'){
                    await btn._expandPromise;
                  }
                  try{ flushPendingForPath(pathKey); }catch(e){}
                }catch(e){}
              }
              return;
            }
          }catch(e){}
        }
      }catch(e){}
    }

    function flushPendingForPath(path){
      try{
        const evs = pendingTestEvents.get(path);
        if (!evs || !evs.length) return;
        const li = document.querySelector('#suites li[data-path="'+path+'"]');
        if (!li) { pendingTestEvents.delete(path); return; }
        const testsDiv = li.querySelector('.suite-tests');
        if (!testsDiv) { pendingTestEvents.delete(path); return; }
        evs.forEach(ev=>{
          try{
            const { Name, Status, DurationMs, Messages } = ev;
            Array.from(testsDiv.children).forEach(r => {
              try{ const nm = r.children[0]; const badge = r.children[1]; if (!nm||!badge) return; if (nm.textContent === Name){ if (Status==='passed'){ badge.textContent='✓'; badge.style.background='rgba(16,185,129,0.12)'; badge.style.opacity='1'; } else if (Status==='failed'){ badge.textContent='✗'; badge.style.background='rgba(239,68,68,0.08)'; badge.style.opacity='1'; } else if (Status==='skipped'){ badge.textContent='-'; badge.style.background='rgba(245,158,11,0.06)'; badge.style.opacity='1'; } }
              }catch(e){}
            });
          }catch(e){}
        });
        pendingTestEvents.delete(path);
      }catch(e){}
    }
    if (type === 'testStart'){
      const {Name} = payload;
      const wrap = document.createElement('div');
      const line = document.createElement('div'); line.className='run'; line.textContent = '… ' + Name;
      wrap.appendChild(line);
      if (results) results.appendChild(wrap);
      try{ window.__E2E_TESTSTART = true; }catch(e){}
      testRows.set(Name, {container: wrap, line});
      scrollBottom();
    }
    if (type === 'batchStart'){
      batch.total = payload.total; batch.done = 0; if (batchBar) setBar(batchBar,0,batch.total); if (batchText) batchText.textContent = '0/' + batch.total;
    }
    if (type === 'suiteStart'){
      suite.total = payload.total; suite.done = 0; if (suiteBar) setBar(suiteBar,0,suite.total); if (suiteText) suiteText.textContent = '0/' + suite.total; if (stages) stages.innerHTML='';
      if (currentSuiteEl) currentSuiteEl.textContent = (payload.name || payload.path || '');
      currentSuitePath = payload.path || payload.name || null;
      const nm = (payload.name || payload.path || '');
      const ln = document.createElement('div'); ln.textContent = `=== running: ${nm} ===`; if (results) results.appendChild(ln);
      scrollBottom();
      const stageMap = payload.stages || {};
      for(const k in stageMap){
        const d=document.createElement('div'); d.className='row';
        d.innerHTML='<div class="w-120px">stage '+k+'</div><div class="progress flex-1"><div id="stage_'+k+'" style="width:0%"></div></div><div class="pill" id="stage_txt_'+k+'">0/'+stageMap[k]+'</div>';
        if (stages) stages.appendChild(d);
      }
      try{ const target = payload.path || payload.name || ''; if (target) { try{ await expandSuiteByPath(target); }catch(e){} } }catch(e){}
    }
    if (type === 'test'){
      const {Name, Status, DurationMs, Stage, Messages, Tags} = payload;
      agg.total++;
      if (Status==='passed') agg.passed++; else if (Status==='failed') agg.failed++; else if (Status==='skipped') agg.skipped++;
      let row = testRows.get(Name);
      if (!row){
        const wrap = document.createElement('div');
        const line = document.createElement('div'); wrap.appendChild(line); if (results) results.appendChild(wrap);
        row = {container: wrap, line}; testRows.set(Name, row);
      }
      row.line.className = (Status==='passed'?'ok':(Status==='failed'?'fail':'skip'));
      if (Status==='skipped') {
        row.line.textContent = `- ${Name} (tags)`;
      } else {
        row.line.textContent = (Status==='passed'?'✓':(Status==='failed'?'✗':'-')) + ' ' + Name + ' (' + DurationMs + ' ms)';
        if (Status==='failed' && Array.isArray(Messages) && Messages.length){
          let det = row.container.querySelector('details');
          if (!det){ det = document.createElement('details'); const sum=document.createElement('summary'); sum.textContent='details'; det.appendChild(sum); row.container.appendChild(det); }
          let pre = det.querySelector('pre'); if (!pre){ pre = document.createElement('pre'); pre.className='fail'; det.appendChild(pre); }
          pre.textContent = Messages.join('\n');
        }
      }
      suite.done++; if (suiteBar) setBar(suiteBar, suite.done, suite.total); if (suiteText) suiteText.textContent = suite.done + '/' + suite.total;
      const st = document.getElementById('stage_'+Stage); const stt = document.getElementById('stage_txt_'+Stage);
      if(st && stt){ const txt = stt.textContent.split('/'); const done = (parseInt(txt[0],10)||0)+1; const total = parseInt(txt[1],10)||0; st.style.width = pct(done,total)+'%'; stt.textContent = done+'/'+total; }
      try {
        if (!document.getElementById('editorModal')) {
          try {
            const updateBadgeForLi = (li)=>{
              if (!li) return;
              try{
                const sBadge = li.querySelector('.suite-badge');
                // Use priority: failed > skipped > passed, but don't override failed status
                if (Status === 'failed') { 
                  if (sBadge) { 
                    sBadge.textContent = '✗'; 
                    sBadge.style.background='rgba(239,68,68,0.08)'; 
                    sBadge.style.opacity='1'; 
                    sBadge.dataset.status = 'failed'; 
                  } 
                }
                else if (Status === 'passed') { 
                  if (sBadge && sBadge.textContent !== '✗' && sBadge.dataset.status !== 'failed') { 
                    sBadge.textContent = '✓'; 
                    sBadge.style.background='rgba(16,185,129,0.12)'; 
                    sBadge.style.opacity='1'; 
                    sBadge.dataset.status = 'passed'; 
                  } 
                }
                else if (Status === 'skipped') { 
                  if (sBadge && sBadge.textContent !== '✗' && sBadge.dataset.status !== 'failed' && sBadge.dataset.status !== 'passed') { 
                    sBadge.textContent = '-'; 
                    sBadge.style.background='rgba(245,158,11,0.06)'; 
                    sBadge.style.opacity='1'; 
                    sBadge.dataset.status = 'skipped'; 
                  } 
                }
                const testsDiv = li.querySelector('.suite-tests');
                if (testsDiv){
                  const expandBtnLocal = li.querySelector('button[aria-controls]');
                  const loaded = expandBtnLocal && expandBtnLocal.dataset && expandBtnLocal.dataset.loaded === '1';
                  if (!loaded){
                    try{ const p = li.getAttribute('data-path') || (li.querySelector('.spec-title') && li.querySelector('.spec-title').textContent) || ''; if (p){ const arr = pendingTestEvents.get(p) || []; arr.push({ Name, Status, DurationMs, Messages }); pendingTestEvents.set(p, arr); } }catch(e){}
                  } else {
                    // Update individual test badges for expanded suites
                    Array.from(testsDiv.children).forEach(r => { 
                      try{ 
                        const nmEl=r.children[0], badgeEl=r.children[1]; 
                        if (!nmEl||!badgeEl) return; 
                        if (nmEl.textContent===Name){ 
                          if (Status==='passed'){ 
                            badgeEl.textContent='✓'; 
                            badgeEl.style.background='rgba(16,185,129,0.12)'; 
                            badgeEl.style.opacity='1'; 
                          } else if (Status==='failed'){ 
                            badgeEl.textContent='✗'; 
                            badgeEl.style.background='rgba(239,68,68,0.08)'; 
                            badgeEl.style.opacity='1'; 
                          } else if (Status==='skipped'){ 
                            badgeEl.textContent='-'; 
                            badgeEl.style.background='rgba(245,158,11,0.06)'; 
                            badgeEl.style.opacity='1'; 
                          } 
                        } 
                      }catch(e){} 
                    });
                    const found = Array.from(testsDiv.children).some(r=> r.children && r.children[0] && r.children[0].textContent === Name);
                    if (!found && sBadge) {
                      sBadge.textContent = '·';
                      sBadge.style.opacity = '.6';
                      sBadge.style.background = '';
                      sBadge.dataset.status = 'unknown';
                    }
                  }
                }
              }catch(e){}
            };
            
            // Update suite badges for the current suite and any other suites that contain this test
            if (currentSuitePath){ 
              const li = document.querySelector('#suites li[data-path="'+currentSuitePath+'"]'); 
              if (li) updateBadgeForLi(li); 
            }
            document.querySelectorAll('#suites li').forEach(li=>{ 
              try{ 
                if (li.getAttribute('data-path') === currentSuitePath) return; 
                const testsDiv = li.querySelector('.suite-tests'); 
                if (!testsDiv) return; 
                const found = Array.from(testsDiv.children).some(r=> r.children && r.children[0] && r.children[0].textContent === Name); 
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
              } catch(e) {} 
            });
          } catch(e) {}
        } // end of if (!document.getElementById('editorModal')) branch
      } catch(e) {} // end of outer try that wraps UI update logic
    } // end of `if (type === 'test')` handler

    // Suite-level and batch-level events should be handled at the same level as 'test' (not nested inside it)
    if (type === 'suiteEnd'){
      batch.done++; if (batchBar) setBar(batchBar, batch.done, batch.total); if (batchText) batchText.textContent = batch.done + '/' + batch.total;
      const name = payload.name || payload.path || '';
      const s = payload.summary || {};
      const line = `=== ${name} — ${s.passed||0} passed, ${s.failed||0} failed, ${s.skipped||0} skipped, total ${s.total||0} in ${s.durationMs||0} ms`;
      const div = document.createElement('div'); div.textContent = line; if (results) results.appendChild(div);
      agg.suites++; agg.durationMs += (s.durationMs||0);
      try{
        const li = document.querySelector('#suites li[data-path="'+(payload.path||payload.name||'')+'"]'); 
        if (li){ 
          const sb = li.querySelector('.suite-badge'); 
          if (sb){ 
            // Prioritize failed > skipped > passed
            if ((s.failed||0) > 0){ 
              sb.textContent = '✗'; 
              sb.style.background='rgba(239,68,68,0.08)'; 
              sb.style.opacity='1'; 
              sb.dataset.status = 'failed'; 
            } else if ((s.skipped||0) > 0 && (s.passed||0) === 0) { 
              // All tests skipped, no passes
              sb.textContent = '-'; 
              sb.style.background='rgba(245,158,11,0.06)'; 
              sb.style.opacity='1'; 
              sb.dataset.status = 'skipped'; 
            } else if ((s.passed||0) > 0) { 
              // Some tests passed (with possible skips)
              sb.textContent = '✓'; 
              sb.style.background='rgba(16,185,129,0.12)'; 
              sb.style.opacity='1'; 
              sb.dataset.status = 'passed'; 
            } else {
              // No tests or unknown state
              sb.textContent = '·'; 
              sb.style.background=''; 
              sb.style.opacity = '.6'; 
              sb.dataset.status = 'unknown'; 
            }
            sb.classList.add('animate'); 
            setTimeout(()=> sb.classList.remove('animate'), 220); 
          } 
        }
      }catch(e){}
      scrollBottom();
    }

    if (type === 'batchEnd'){
      const div = document.createElement('div'); div.textContent = `=== Batch summary — ${agg.passed} passed, ${agg.failed} failed, ${agg.skipped} skipped, total ${agg.total} in ${agg.durationMs} ms (suites ${agg.suites}/${batch.total}) ===`; if (results) results.appendChild(div);
      scrollBottom();
    }

    if (type === 'error'){ const d = document.createElement('div'); d.className='fail'; d.textContent = 'Error: ' + (payload.error||''); if (results) results.appendChild(d); }

    if (type === 'done'){ es.close(); window.lastRunId = id; window.currentRunId = null; }
      }; // end es.onmessage
}

// Prompt user to create a new suite
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

// Import collection from external format
async function importCollection(){
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

// Initialize suite management
function initSuites(){
  // Restore selected suites from localStorage
  try {
    const rawSel = localStorage.getItem('hydreq.sel');
    selected = new Set(JSON.parse(rawSel || '[]'));
  } catch (e) {
    console.error('HYDREQ: failed to parse hydreq.sel from localStorage, falling back to empty set', e);
    selected = new Set();
  }

  // Initialize UI elements
  const selCount = document.getElementById('selCount');
  if (selCount) selCount.textContent = selected.size + ' selected';

  // Set up event handlers
  const refreshBtn = document.getElementById('refresh');
  if (refreshBtn) refreshBtn.onclick = refresh;

  const runBtn = document.getElementById('run');
  if (runBtn) runBtn.onclick = run;

  const importBtn = document.getElementById('importBtn');
  if (importBtn) importBtn.onclick = importCollection;

  const newSuiteBtn = document.getElementById('newSuiteBtn');
  if (newSuiteBtn) newSuiteBtn.onclick = promptNewSuite;

  const expandAllBtn = document.getElementById('expandAll');
  if (expandAllBtn) expandAllBtn.onclick = () => { expandAll().catch(()=>{}); };

  const collapseAllBtn = document.getElementById('collapseAll');
  if (collapseAllBtn) collapseAllBtn.onclick = collapseAll;

  // Initial refresh
  refresh();
}

// Expose functions to window for backward compatibility
window.renderSuites = renderSuites;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.refresh = refresh;
window.run = run;
window.listen = listen;
window.promptNewSuite = promptNewSuite;
window.importCollection = importCollection;
window.initSuites = initSuites;