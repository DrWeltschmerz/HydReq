(function(){
  function renderIssues(modal, issues, yamlPreview){
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
  window.hydreqEditorIssues = window.hydreqEditorIssues || { renderIssues };
})();
