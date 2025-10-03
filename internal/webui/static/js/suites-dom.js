// suites-dom.js — DOM builder helpers for suites/tests list
(function(){
  /**
   * buildTestContainer creates a DOM container for a single test row with name, tags, and a status badge.
   * Inputs:
   * - test: { name: string, tags?: string[] }
   * - status: 'passed'|'failed'|'skipped'|''
   * - opts: { selectedTags?: string[], onToggleTag?: (tag)=>void }
   * Output: HTMLDivElement with structure:
   * <div.suite-test-container>
   *   <div.suite-test-item>
   *     <span.suite-test-name data-name>name [+ tag chips]
   *     <span.status-badge.suite-test-status ...>
   *   </div>
   * </div>
   */
  function buildTestContainer(test, status, opts){
    opts = opts || {};
    const name = (test && (test.name || test.Name)) ? (test.name || test.Name) : '(unnamed)';
    const tags = (test && (test.tags || test.Tags)) ? (test.tags || test.Tags) : [];

    const cont = document.createElement('div');
    cont.className = 'suite-test-container';
    const row = document.createElement('div');
    row.className = 'suite-test-item';
    const nm = document.createElement('span');
    nm.className = 'suite-test-name';
    nm.textContent = name;
    nm.title = name;
    nm.dataset.name = name;

    try{
      if (Array.isArray(tags) && tags.length){
        const tw = document.createElement('span');
        tw.className = 'row wrap gap-4px ml-8';
        const selectedArr = Array.isArray(opts.selectedTags) ? opts.selectedTags : [];
        tags.slice(0,4).forEach(x=>{
          const b = document.createElement('span');
          b.className = 'pill tag-chip text-10';
          b.dataset.tag = x;
          b.textContent = '#' + x;
          if (selectedArr.includes(x)) b.classList.add('selected');
          b.addEventListener('click', (ev)=>{ ev.stopPropagation(); if (typeof opts.onToggleTag==='function') opts.onToggleTag(x); });
          tw.appendChild(b);
        });
        nm.appendChild(tw);
      }
    }catch(e){}

    const badge = document.createElement('span');
    badge.className = 'status-badge suite-test-status';
    const st = (status||'').toLowerCase();
    if (st==='passed'){ badge.classList.add('status-ok'); badge.textContent='✓'; }
    else if (st==='failed'){ badge.classList.add('status-fail'); badge.textContent='✗'; }
    else if (st==='skipped'){ badge.classList.add('status-skip'); badge.textContent='○'; }
    else { badge.classList.add('status-unknown'); badge.textContent='·'; }

    row.appendChild(nm);
    row.appendChild(badge);
    cont.appendChild(row);
    return cont;
  }

  // Update a suite-level badge element based on status string
  function updateSuiteBadge(sb, status){
    if (!sb) return;
    const st = (status||'').toLowerCase();
    // reset classes
    sb.classList.remove('status-unknown','status-ok','status-fail','status-skip');
    if (st === 'failed'){
      sb.textContent = '✗';
      sb.classList.add('status-fail');
      sb.dataset.status = 'failed';
    } else if (st === 'passed'){
      sb.textContent = '✓';
      sb.classList.add('status-ok');
      sb.dataset.status = 'passed';
    } else if (st === 'skipped'){
      sb.textContent = '○';
      sb.classList.add('status-skip');
      sb.dataset.status = 'skipped';
    } else {
      sb.textContent = '·';
      sb.classList.add('status-unknown');
      sb.dataset.status = 'unknown';
    }
  }

  // Update a per-test badge element
  function updateTestBadge(badgeEl, status){
    if (!badgeEl) return;
    const st = (status||'').toLowerCase();
    badgeEl.classList.remove('status-unknown','status-ok','status-fail','status-skip');
    if (st==='passed'){ badgeEl.textContent='✓'; badgeEl.classList.add('status-ok'); }
    else if (st==='failed'){ badgeEl.textContent='✗'; badgeEl.classList.add('status-fail'); }
    else if (st==='skipped'){ badgeEl.textContent='○'; badgeEl.classList.add('status-skip'); }
    else { badgeEl.textContent='·'; badgeEl.classList.add('status-unknown'); }
  }

  // Ensure details block exists and update it according to status/messages
  function updateTestDetails(container, status, messages){
    if (!container) return;
    const st = (status||'').toLowerCase();
    const msgs = Array.isArray(messages) ? messages : [];
  const hasMsgs = msgs.length > 0;
    let det = container.querySelector('details.suite-test-details');
    if (!det){
      det = document.createElement('details');
      det.className='suite-test-details';
      const sum=document.createElement('summary');
      sum.textContent='details';
      det.appendChild(sum);
      container.appendChild(det);
    }
    let pre = det.querySelector('pre');
    if (!pre){ pre = document.createElement('pre'); pre.className='message-block'; det.appendChild(pre); }
    pre.className = 'message-block ' + (st==='failed'?'fail':(st==='skipped'?'skip':'ok'));
    if (hasMsgs) pre.textContent = msgs.join('\n');
    else pre.textContent = (st==='skipped') ? 'skipped' : 'No details reported';
  }

  // Find an existing test container by name within a testsDiv
  function findTestContainer(testsDiv, name){
    if (!testsDiv || !name) return null;
    const children = Array.from(testsDiv.children);
    for (const cont of children){
      try{
        if (!cont.classList || !cont.classList.contains('suite-test-container')) continue;
        const nmEl = cont.querySelector('.suite-test-name');
        if (nmEl && (nmEl.dataset && nmEl.dataset.name) === name) return cont;
      }catch(e){}
    }
    return null;
  }

  // Render active tags in the batch header based on window.getSelectedTags()
  function renderHeaderTags(){
    try{
      const selTags = (window.getSelectedTags && window.getSelectedTags()) || [];
      const wrap = document.getElementById('activeTagsTopWrap');
      const cont = document.getElementById('activeTagsTop');
      if (!wrap || !cont) return;
      cont.innerHTML = '';
      if (Array.isArray(selTags) && selTags.length){
        wrap.classList.remove('invisible');
        selTags.forEach(t=>{ const b=document.createElement('span'); b.className='pill tag-chip text-10'; b.textContent='#'+t; cont.appendChild(b); });
      } else {
        wrap.classList.add('invisible');
      }
    }catch(e){}
  }

  // Render active env in the batch header based on parseEnv()
  function renderHeaderEnv(){
    try{
      const env = (typeof window.parseEnv==='function') ? window.parseEnv() : {};
      const wrap = document.getElementById('activeEnvTopWrap');
      const cont = document.getElementById('activeEnvTop');
      if (!wrap || !cont) return;
      cont.innerHTML = '';
      const keys = Object.keys(env);
      if (keys.length){
        wrap.classList.remove('invisible');
        keys.slice(0, 12).forEach(k=>{ const b=document.createElement('span'); b.className='pill text-10'; b.textContent=k; cont.appendChild(b); });
      } else {
        wrap.classList.add('invisible');
      }
    }catch(e){}
  }

  // Small style utilities to keep view code readable
  function setFlexCol(el){ if (!el) return; el.style.display='flex'; el.style.flexDirection='column'; }
  function setFlexRow(el){ if (!el) return; el.style.display='flex'; el.style.flexDirection='row'; }
  function hide(el){ if (!el) return; el.style.display='none'; el.classList.remove('open'); }
  function show(el){ if (!el) return; el.style.display='block'; el.classList.add('open'); }

  // Build a simple dropdown menu and toggle handler
  function buildDownloadMenu(pathKey, onDownload){
    const wrap = document.createElement('span'); wrap.className='suite-download pos-relative d-inline-block';
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-xs'; btn.title='Download'; btn.setAttribute('aria-label','Download suite'); btn.dataset.path = pathKey;
    const icon = document.createElement('span'); icon.className='dl-icon'; icon.textContent='⬇'; btn.appendChild(icon);
    const menu = document.createElement('div'); menu.className='menu-panel';
    const addItem = (label, fmt)=>{
      const b = document.createElement('div'); b.textContent = label; b.className='menu-item';
      b.onclick = (e)=>{ e.stopPropagation(); if (typeof onDownload==='function') onDownload(pathKey, fmt); menu.style.display='none'; };
      menu.appendChild(b);
    };
    addItem('Download JSON','json'); addItem('Download JUnit','junit'); addItem('Download HTML','html');
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); menu.style.display = (menu.style.display === 'none') ? 'block' : 'none'; });
    document.addEventListener('click', ()=>{ try{ menu.style.display='none'; }catch(e){} });
    wrap.appendChild(btn); wrap.appendChild(menu);
    return wrap;
  }

  // Ensure a stage row exists in the stages container; return { barEl, textEl, created }
  function ensureStageRow(stage){
    const stages = document.getElementById('stages');
    const stId = 'stage_' + stage;
    const txtId = 'stage_txt_' + stage;
    let barEl = document.getElementById(stId);
    let textEl = document.getElementById(txtId);
    let created = false;
    if (!barEl || !textEl){
      const d = document.createElement('div');
      d.className = 'row';
      d.innerHTML = '<div class="w-120px">stage ' + stage + '</div>' +
                    '<div class="progress flex-1"><div id="' + stId + '" style="width:0%"></div></div>' +
                    '<div class="pill" id="' + txtId + '">0/0</div>';
      if (stages) stages.appendChild(d);
      barEl = document.getElementById(stId);
      textEl = document.getElementById(txtId);
      created = true;
    }
    return { barEl, textEl, created };
  }

  window.hydreqSuitesDOM = window.hydreqSuitesDOM || {
    buildTestContainer,
    renderHeaderTags,
    renderHeaderEnv,
    ensureStageRow,
    updateSuiteBadge,
    updateTestBadge,
    updateTestDetails,
    findTestContainer,
    setFlexCol,
    setFlexRow,
    hide,
    show,
    buildDownloadMenu
  };
})();
