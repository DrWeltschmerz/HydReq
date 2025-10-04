// suites-view.js — view wrappers for suites list
(function(){
  // Render the suites list into the #suites element. The function accepts
  // an options parameter to avoid duplicating stateful logic housed in
  // `js/suites.js` (expand/load handlers, selection persistence, etc.).
  function render(list, opts){
    opts = opts || {};
    const suitesEl = document.getElementById('suites');
    if (!suitesEl) return;
    try{
      // Keep legacy debug banner behavior
      if ((!list || list.length===0) && typeof window !== 'undefined'){
        if (!document.getElementById('hydreq-debug-banner')){
          const banner = document.createElement('div');
          banner.id = 'hydreq-debug-banner';
          banner.className = 'dbg-banner';
          banner.textContent = 'HYDREQ-DBG: No suites returned from /api/editor/suites';
          const aside = document.querySelector('aside'); if (aside) aside.insertBefore(banner, aside.firstChild);
        }
      } else {
        const b = document.getElementById('hydreq-debug-banner'); if (b && b.parentNode) b.parentNode.removeChild(b);
      }
    }catch(e){}

    suitesEl.replaceChildren();
    const selectedSet = opts.selectedSet || new Set();
    const openSet = opts.openSet || new Set();
    const lastStatusObj = opts.lastStatusObj || {}; // { path: { testName: status } }

    list.forEach(item => {
      const path = (typeof item === 'string') ? item : (item.path || item.Path || item.file || JSON.stringify(item));
      const pathKey = path;
      const base = (typeof path === 'string' ? path.split('/').pop() : String(path));
      const friendly = (item && (item.name || item.Name)) ? (item.name || item.Name) : null;

  const li = document.createElement('li');
      if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.setFlexCol) window.hydreqSuitesDOM.setFlexCol(li);
      li.classList.add('gap-8');
      li.dataset.path = pathKey;

  const name = document.createElement('span');
    if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.setFlexCol) window.hydreqSuitesDOM.setFlexCol(name);
    name.classList.add('ai-stretch','gap-2');

  const titleRow = document.createElement('div');
      if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.setFlexRow) window.hydreqSuitesDOM.setFlexRow(titleRow);
      titleRow.classList.add('ai-baseline','gap-8');

      // Expand button
  const expandBtn = document.createElement('button');
      expandBtn.className = 'btn btn-ghost btn-xs w-28px';
      expandBtn.textContent = '▸';
      expandBtn.title = 'Show tests';
  expandBtn.setAttribute('aria-expanded','false');
  expandBtn.setAttribute('aria-label','Toggle tests');
  expandBtn.tabIndex = 0;
      expandBtn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandBtn.click(); } });
      expandBtn._expandPromise = null; expandBtn._resolveExpand = null;

      // Defer expand handling to caller via opts.onExpand
      expandBtn.addEventListener('click', function(e){
        e.stopPropagation();
        const isOpen = expandBtn.dataset.open === '1';
        if (isOpen){
          expandBtn.dataset.open = '0'; expandBtn.textContent='▸'; expandBtn.setAttribute('aria-expanded','false');
          const testsDiv = li.querySelector('.suite-tests');
          if (testsDiv){ if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.hide) window.hydreqSuitesDOM.hide(testsDiv); }
          if (typeof opts.onToggleOpen === 'function') opts.onToggleOpen(pathKey, false);
          return;
        }
        expandBtn.dataset.open = '1'; expandBtn.textContent='▾'; expandBtn.setAttribute('aria-expanded','true');
        if (typeof opts.onToggleOpen === 'function') opts.onToggleOpen(pathKey, true);

        if (!expandBtn._expandPromise)
          expandBtn._expandPromise = new Promise((res)=>{ expandBtn._resolveExpand = res; });
        // Provide a callback for the caller to populate testsDiv; the caller should resolve the promise when ready.
        if (typeof opts.onExpand === 'function'){
          try{ opts.onExpand(pathKey, li, expandBtn); }catch(e){}
        }
      });

  const titleSpan = document.createElement('span');
      titleSpan.className = 'spec-title fs-16 fw-600';
      titleSpan.textContent = friendly && (typeof friendly === 'string') && friendly.trim() !== '' ? friendly : base;

  const suiteBadge = document.createElement('span');
      suiteBadge.className = 'status-badge suite-badge status-unknown';
      suiteBadge.textContent = '·';
      suiteBadge.title = 'suite status';
      suiteBadge.dataset.status = 'unknown';

      titleRow.appendChild(expandBtn); titleRow.appendChild(titleSpan); titleRow.appendChild(suiteBadge);
      name.appendChild(titleRow);

      // filename + tags
  const fileRow = document.createElement('div');
      fileRow.className='ml-32px row gap-6';
  const fileSpan = document.createElement('span');
      fileSpan.textContent = base;
      fileSpan.className = 'spec-file fs-11 opacity-50';
      fileRow.appendChild(fileSpan);
      try{
        const suiteTags = (item && (item.tags || item.Tags)) ? (item.tags || item.Tags) : [];
        if (Array.isArray(suiteTags) && suiteTags.length){
          const selectedArr = Array.from(selectedSet || []);
          suiteTags.slice(0,4).forEach(tg=>{
            const b = document.createElement('span');
            b.className = 'pill tag-chip text-10';
            b.dataset.tag = tg;
            b.textContent = '#'+tg;
            if (selectedArr.includes(tg)) b.classList.add('selected');
            b.addEventListener('click', (ev)=>{
              ev.stopPropagation();
              if (typeof opts.onToggleTag === 'function') opts.onToggleTag(tg);
            });
            fileRow.appendChild(b);
          });
        }
      }catch(e){}
      name.appendChild(fileRow);

  const testsDiv = document.createElement('div');
      testsDiv.className = 'suite-tests mt-6 p-6 border-l-soft hidden';
      name.appendChild(testsDiv);

      // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost btn-xs';
  editBtn.textContent = '✐';
  editBtn.title = 'Open editor';
  editBtn.setAttribute('aria-label','Open editor');
  editBtn.dataset.path = pathKey;
      editBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (typeof opts.onEdit === 'function') opts.onEdit(pathKey, li); });

      // Download dropdown
  const dlWrap = (window.hydreqSuitesDOM && window.hydreqSuitesDOM.buildDownloadMenu)
    ? window.hydreqSuitesDOM.buildDownloadMenu(pathKey, opts.onDownload)
    : (function(){
      const span = document.createElement('span');
      span.className = 'suite-download pos-relative d-inline-block';
      return span;
    })();

  const actions = document.createElement('span');
    actions.className = 'suite-actions ml-auto row gap-6';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-xs';
    delBtn.title = 'Delete suite';
    delBtn.setAttribute('aria-label','Delete suite');
    delBtn.textContent = '🗑';
    delBtn.dataset.path = pathKey;
      delBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (typeof opts.onDelete === 'function') opts.onDelete(pathKey, li); });
      actions.appendChild(dlWrap); actions.appendChild(editBtn); actions.appendChild(delBtn);
      titleRow.appendChild(actions);

      li.appendChild(name);
  li.classList.add('mb-6');
      if (selectedSet.has(pathKey)) li.classList.add('selected');
      li.onclick = () => {
        if (selectedSet.has(pathKey)) selectedSet.delete(pathKey);
        else selectedSet.add(pathKey);
        if (typeof opts.onToggleSelect==='function') opts.onToggleSelect(pathKey, Array.from(selectedSet));
        const sc = document.getElementById('selCount');
        if (sc) sc.textContent = selectedSet.size + ' selected';
        li.classList.toggle('selected');
      };

      // If caller supplied preloaded tests, populate testsDiv
      try{
        const preloaded = opts.preloadedTests && opts.preloadedTests[pathKey];
        if (preloaded && Array.isArray(preloaded)){
          testsDiv.replaceChildren();
          preloaded.forEach(t=>{
            const cont = document.createElement('div');
            cont.className = 'suite-test-container';
            const row = document.createElement('div');
            row.className = 'suite-test-item';
            const nm = document.createElement('span');
            nm.className = 'suite-test-name';
            nm.textContent = t.name || t.Name || '(unnamed)';
            nm.title = nm.textContent;
            nm.dataset.name = nm.textContent;
            const stmap = lastStatusObj[pathKey] || {};
            const status = stmap[nm.dataset.name] || '';
            const badge = document.createElement('span');
            badge.className = 'status-badge suite-test-status';
            if (status==='passed'){ badge.classList.add('status-ok'); badge.textContent='✓'; }
            else if (status==='failed'){ badge.classList.add('status-fail'); badge.textContent='✗'; }
            else if (status==='skipped'){ badge.classList.add('status-skip'); badge.textContent='○'; }
            else { badge.classList.add('status-unknown'); badge.textContent='·'; }
            row.appendChild(nm); row.appendChild(badge); cont.appendChild(row); testsDiv.appendChild(cont);
          });
          if (openSet.has(pathKey)) {
            testsDiv.classList.add('open');
            if (window.hydreqSuitesDOM && window.hydreqSuitesDOM.show) {
              window.hydreqSuitesDOM.show(testsDiv);
            }
            expandBtn.dataset.open = '1';
            expandBtn.textContent = '▾';
          }
          // mark as loaded so callers can flush buffered events
          try{ expandBtn.dataset.loaded = '1'; }catch(e){}
        }
      }catch(e){}

      suitesEl.appendChild(li);

    });
    const selCount = document.getElementById('selCount');
    if (selCount) {
      selCount.textContent = (opts.selectedSet ? opts.selectedSet.size : 0) + ' selected';
    }
  }

  function expandAll(){
    try{
      document.querySelectorAll('#suites li').forEach(li => {
        const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
        if (btn && btn.dataset.open !== '1') { btn.click(); }
      });
    }catch(e){}
  }
  function collapseAll(){
    try{
      document.querySelectorAll('#suites li').forEach(li => {
        const btn = li.querySelector('button[aria-controls]') || li.querySelector('button');
        if (btn && btn.dataset.open === '1') { btn.click(); }
      });
    }catch(e){}
  }
  function refresh(){
    try{
      if (typeof opts !== 'undefined' && opts && typeof opts.onRefresh === 'function'){
        opts.onRefresh();
        return;
      }
      if (typeof window.refresh === 'function') window.refresh();
    }catch(e){}
  }

  window.hydreqSuitesView = window.hydreqSuitesView || { render, expandAll, collapseAll, refresh };
})();
