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
          const banner = document.createElement('div'); banner.id='hydreq-debug-banner'; banner.style.padding='12px'; banner.style.background='rgba(255,0,0,0.06)'; banner.style.border='1px solid rgba(255,0,0,0.12)'; banner.style.margin='8px'; banner.style.borderRadius='6px'; banner.textContent = 'HYDREQ-DBG: No suites returned from /api/editor/suites';
          const aside = document.querySelector('aside'); if (aside) aside.insertBefore(banner, aside.firstChild);
        }
      } else {
        const b = document.getElementById('hydreq-debug-banner'); if (b && b.parentNode) b.parentNode.removeChild(b);
      }
    }catch(e){}

    suitesEl.innerHTML = '';
    const selectedSet = opts.selectedSet || new Set();
    const openSet = opts.openSet || new Set();
    const lastStatusObj = opts.lastStatusObj || {}; // { path: { testName: status } }

    list.forEach(item => {
      const path = (typeof item === 'string') ? item : (item.path || item.Path || item.file || JSON.stringify(item));
      const pathKey = path;
      const base = (typeof path === 'string' ? path.split('/').pop() : String(path));
      const friendly = (item && (item.name || item.Name)) ? (item.name || item.Name) : null;

      const li = document.createElement('li'); li.style.display='flex'; li.style.flexDirection='column'; li.style.gap='8px';
      li.dataset.path = pathKey;

      const name = document.createElement('span'); name.style.display='flex'; name.style.flexDirection='column'; name.style.alignItems='stretch'; name.style.gap='2px';

      const titleRow = document.createElement('div'); titleRow.style.display='flex'; titleRow.style.flexDirection='row'; titleRow.style.alignItems='baseline'; titleRow.style.gap='8px';

      // Expand button
      const expandBtn = document.createElement('button'); expandBtn.className = 'btn btn-ghost btn-xs'; expandBtn.textContent = '▸'; expandBtn.title = 'Show tests'; expandBtn.style.width = '28px';
      expandBtn.setAttribute('aria-expanded','false'); expandBtn.setAttribute('aria-label','Toggle tests'); expandBtn.tabIndex = 0;
      expandBtn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandBtn.click(); } });
      expandBtn._expandPromise = null; expandBtn._resolveExpand = null;

      // Defer expand handling to caller via opts.onExpand
      expandBtn.addEventListener('click', function(e){
        e.stopPropagation();
        const isOpen = expandBtn.dataset.open === '1';
        if (isOpen){
          expandBtn.dataset.open = '0'; expandBtn.textContent='▸'; expandBtn.setAttribute('aria-expanded','false');
          const testsDiv = li.querySelector('.suite-tests'); if (testsDiv){ testsDiv.classList.remove('open'); testsDiv.style.display='none'; }
          if (typeof opts.onToggleOpen === 'function') opts.onToggleOpen(pathKey, false);
          return;
        }
        expandBtn.dataset.open = '1'; expandBtn.textContent='▾'; expandBtn.setAttribute('aria-expanded','true');
        if (typeof opts.onToggleOpen === 'function') opts.onToggleOpen(pathKey, true);

        if (!expandBtn._expandPromise) expandBtn._expandPromise = new Promise((res)=>{ expandBtn._resolveExpand = res; });
        // Provide a callback for the caller to populate testsDiv; the caller should resolve the promise when ready.
        if (typeof opts.onExpand === 'function'){
          try{ opts.onExpand(pathKey, li, expandBtn); }catch(e){}
        }
      });

      const titleSpan = document.createElement('span'); titleSpan.className = 'spec-title'; titleSpan.style.fontWeight='600'; titleSpan.style.fontSize='16px';
      titleSpan.textContent = friendly && (typeof friendly === 'string') && friendly.trim() !== '' ? friendly : base;

      const suiteBadge = document.createElement('span'); suiteBadge.className = 'pill suite-badge'; suiteBadge.textContent = '·'; suiteBadge.style.opacity = '.6'; suiteBadge.title = 'suite status'; suiteBadge.dataset.status = 'unknown';

      titleRow.appendChild(expandBtn); titleRow.appendChild(titleSpan); titleRow.appendChild(suiteBadge);
      name.appendChild(titleRow);

      // filename + tags
      const fileRow = document.createElement('div'); fileRow.style.marginLeft = '32px'; fileRow.style.display='flex'; fileRow.style.alignItems='center'; fileRow.style.gap='6px';
      const fileSpan = document.createElement('span'); fileSpan.textContent = base; fileSpan.style.opacity = 0.5; fileSpan.style.fontSize = '11px'; fileSpan.className = 'spec-file';
      fileRow.appendChild(fileSpan);
      try{
        const suiteTags = (item && (item.tags || item.Tags)) ? (item.tags || item.Tags) : [];
        if (Array.isArray(suiteTags) && suiteTags.length){
          const selectedArr = Array.from(selectedSet || []);
          suiteTags.slice(0,4).forEach(tg=>{ const b=document.createElement('span'); b.className='pill tag-chip'; b.dataset.tag=tg; b.textContent='#'+tg; b.style.fontSize='10px'; if (selectedArr.includes(tg)) b.classList.add('selected'); b.addEventListener('click', (ev)=>{ ev.stopPropagation(); if (typeof opts.onToggleTag === 'function') opts.onToggleTag(tg); }); fileRow.appendChild(b); });
        }
      }catch(e){}
      name.appendChild(fileRow);

      const testsDiv = document.createElement('div'); testsDiv.className = 'suite-tests'; testsDiv.style.display='none'; testsDiv.style.marginTop='6px'; testsDiv.style.paddingLeft='6px'; testsDiv.style.borderLeft='2px solid rgba(0,0,0,0.04)'; name.appendChild(testsDiv);

      // Edit button
      const editBtn = document.createElement('button'); editBtn.className = 'btn btn-ghost btn-xs'; editBtn.textContent = '✐'; editBtn.title = 'Open editor'; editBtn.setAttribute('aria-label','Open editor'); editBtn.dataset.path = pathKey;
      editBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (typeof opts.onEdit === 'function') opts.onEdit(pathKey, li); });

      // Download dropdown
      const dlWrap = document.createElement('span'); dlWrap.className='suite-download'; dlWrap.style.position='relative'; dlWrap.style.display='inline-block';
      const dlBtn = document.createElement('button'); dlBtn.className='btn btn-ghost btn-xs'; dlBtn.title='Download'; dlBtn.setAttribute('aria-label','Download suite'); dlBtn.dataset.path = pathKey; const dlIcon = document.createElement('span'); dlIcon.className='dl-icon'; dlIcon.textContent='⬇'; dlBtn.appendChild(dlIcon);
      const dlMenu = document.createElement('div'); dlMenu.style.position='absolute'; dlMenu.style.right='0'; dlMenu.style.top='28px'; dlMenu.style.minWidth='140px'; dlMenu.style.border='1px solid var(--bd)'; dlMenu.style.background='var(--bg)'; dlMenu.style.padding='6px'; dlMenu.style.borderRadius='6px'; dlMenu.style.boxShadow='0 6px 12px rgba(0,0,0,0.08)'; dlMenu.style.display='none'; dlMenu.style.zIndex='10';
      const addDl = (label, fmt)=>{ const b = document.createElement('div'); b.textContent = label; b.style.padding='6px'; b.style.cursor='pointer'; b.style.borderRadius='4px'; b.onclick = (e)=>{ e.stopPropagation(); if (typeof opts.onDownload==='function') opts.onDownload(pathKey, fmt); dlMenu.style.display='none'; }; b.onmouseenter = ()=> b.style.background='var(--li-hov)'; b.onmouseleave = ()=> b.style.background='transparent'; dlMenu.appendChild(b); };
      addDl('Download JSON','json'); addDl('Download JUnit','junit'); addDl('Download HTML','html');
      dlBtn.addEventListener('click', (e)=>{ e.stopPropagation(); dlMenu.style.display = (dlMenu.style.display === 'none') ? 'block' : 'none'; });
      document.addEventListener('click', ()=>{ try{ dlMenu.style.display='none'; }catch{} }); dlWrap.appendChild(dlBtn); dlWrap.appendChild(dlMenu);

      const actions = document.createElement('span'); actions.className='suite-actions'; actions.style.display='flex'; actions.style.gap='6px'; actions.style.marginLeft='auto';
      const delBtn = document.createElement('button'); delBtn.className = 'btn btn-ghost btn-xs'; delBtn.title='Delete suite'; delBtn.setAttribute('aria-label','Delete suite'); delBtn.textContent='🗑'; delBtn.dataset.path = pathKey;
      delBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (typeof opts.onDelete === 'function') opts.onDelete(pathKey, li); });
      actions.appendChild(dlWrap); actions.appendChild(editBtn); actions.appendChild(delBtn);
      titleRow.appendChild(actions);

      li.appendChild(name);
      li.style.marginBottom = '6px';
      if (selectedSet.has(pathKey)) li.classList.add('selected');
      li.onclick = () => { if (selectedSet.has(pathKey)) selectedSet.delete(pathKey); else selectedSet.add(pathKey); if (typeof opts.onToggleSelect==='function') opts.onToggleSelect(pathKey, Array.from(selectedSet)); const sc = document.getElementById('selCount'); if (sc) sc.textContent = selectedSet.size + ' selected'; li.classList.toggle('selected'); };

      // If caller supplied preloaded tests, populate testsDiv
      try{
        const preloaded = opts.preloadedTests && opts.preloadedTests[pathKey];
        if (preloaded && Array.isArray(preloaded)){
          testsDiv.innerHTML='';
          preloaded.forEach(t=>{
            const cont = document.createElement('div'); cont.className='suite-test-container';
            const row = document.createElement('div'); row.className='suite-test-item';
            const nm = document.createElement('span'); nm.className='suite-test-name'; nm.textContent = t.name || t.Name || '(unnamed)'; nm.title = nm.textContent; nm.dataset.name = nm.textContent;
            const stmap = lastStatusObj[pathKey] || {};
            const status = stmap[nm.dataset.name] || '';
            const badge = document.createElement('span'); badge.className='pill suite-test-status';
            if (status==='passed'){ badge.textContent='✓'; badge.style.background='rgba(16,185,129,0.12)'; }
            else if (status==='failed'){ badge.textContent='✗'; badge.style.background='rgba(239,68,68,0.08)'; }
            else if (status==='skipped'){ badge.textContent='-'; badge.style.background='rgba(245,158,11,0.06)'; }
            else { badge.textContent='·'; badge.style.opacity='.6'; }
            row.appendChild(nm); row.appendChild(badge); cont.appendChild(row); testsDiv.appendChild(cont);
          });
          if (openSet.has(pathKey)) { testsDiv.classList.add('open'); testsDiv.style.display='block'; expandBtn.dataset.open='1'; expandBtn.textContent='▾'; }
          // mark as loaded so callers can flush buffered events
          try{ expandBtn.dataset.loaded = '1'; }catch(e){}
        }
      }catch(e){}

      suitesEl.appendChild(li);

    });
    const selCount = document.getElementById('selCount'); if (selCount) selCount.textContent = (opts.selectedSet? opts.selectedSet.size : 0) + ' selected';
  }

  function expandAll(){ try{ document.querySelectorAll('#suites li').forEach(li=>{ const btn = li.querySelector('button[aria-controls]') || li.querySelector('button'); if (btn && btn.dataset.open !== '1'){ btn.click(); } }); }catch(e){} }
  function collapseAll(){ try{ document.querySelectorAll('#suites li').forEach(li=>{ const btn = li.querySelector('button[aria-controls]') || li.querySelector('button'); if (btn && btn.dataset.open === '1'){ btn.click(); } }); }catch(e){} }
  function refresh(){ try{ if (typeof opts !== 'undefined' && opts && typeof opts.onRefresh==='function'){ opts.onRefresh(); return; } if (typeof window.refresh==='function') window.refresh(); }catch(e){} }

  window.hydreqSuitesView = window.hydreqSuitesView || { render, expandAll, collapseAll, refresh };
})();
