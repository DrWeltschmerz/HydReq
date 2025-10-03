(function(){
  function render(modal, tests, selIndex, { onSelect, onDelete, getResult }){
    const testsEl = modal.querySelector('#ed_tests'); if (!testsEl) return;
    testsEl.innerHTML = '';
    if (!Array.isArray(tests)) return;
    tests.forEach((test, index)=>{
      const testContainer = document.createElement('div'); testContainer.className='ed-test-container';
      const testDiv = document.createElement('div'); testDiv.className='ed-test-item'; testDiv.dataset.index = String(index);
      if (index === selIndex) testDiv.classList.add('selected');
      const nameSpan = document.createElement('span'); nameSpan.className='ed-test-name'; nameSpan.textContent = test.name || `test ${index + 1}`; testDiv.appendChild(nameSpan);
      const right = document.createElement('span'); right.className = 'ed-row-6 ed-ai-center';
      // Status badge from run cache if available
      try {
        const res = typeof getResult==='function' ? getResult(index, test) : null;
        if (res && res.status) {
          const badge = document.createElement('span');
          badge.className = 'status-badge ed-test-status';
          if (res.status === 'passed') { badge.classList.add('status-ok'); badge.textContent = '✓'; }
          else if (res.status === 'failed') { badge.classList.add('status-fail'); badge.textContent = '✗'; }
          else if (res.status === 'skipped') { badge.classList.add('status-skip'); badge.textContent = '○'; }
          else { badge.classList.add('status-unknown'); badge.textContent = '·'; }
          badge.title = res.status; right.appendChild(badge);
        }
      } catch {}
      const del = document.createElement('button'); del.className='btn btn-ghost btn-xs'; del.title='Delete test'; del.setAttribute('aria-label','Delete test'); del.textContent='🗑';
      del.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); onDelete && onDelete(index); };
      right.appendChild(del); testDiv.appendChild(right);
      testDiv.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); onSelect && onSelect(index); };
      testContainer.appendChild(testDiv);
      // Append details section if failed or skipped
      try {
        const res = typeof getResult==='function' ? getResult(index, test) : null;
        if (res && res.status && (res.status === 'failed' || res.status === 'skipped')){
          const details = document.createElement('details'); details.className = 'ed-test-details';
          const sum = document.createElement('summary'); sum.textContent = 'details'; details.appendChild(sum);
          const pre = document.createElement('pre'); pre.className = 'message-block ' + (res.status==='failed'?'fail':'skip');
          pre.textContent = (Array.isArray(res.messages) && res.messages.length) ? res.messages.join('\n') : (res.status==='skipped'?'skipped':'');
          details.appendChild(pre);
          testContainer.appendChild(details);
        }
      } catch {}
      testsEl.appendChild(testContainer);
    });
  }
  window.hydreqEditorTestsList = window.hydreqEditorTestsList || { render };
})();
