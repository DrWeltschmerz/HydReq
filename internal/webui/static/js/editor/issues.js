(function(){
  function clearNode(node){ try{ while(node.firstChild) node.removeChild(node.firstChild); }catch{} }
  function renderIssues(modal, issues, yamlPreview){
    const issuesEl = modal.querySelector('#ed_issues'); if (!issuesEl) return;
    clearNode(issuesEl);
    const arr = Array.isArray(issues) ? issues : (Array.isArray(issues?.errors) ? issues.errors : []);
    if (!arr.length){
      const ok=document.createElement('div'); ok.className='text-success'; ok.setAttribute('role','status'); ok.textContent='No issues'; issuesEl.appendChild(ok); return;
    }
    arr.forEach(it=>{
      const line=document.createElement('div');
      const sev=(it.severity||it.level||'error').toLowerCase(); line.className = (sev==='warning'?'text-warning':(sev==='info'?'':'text-error'));
      const loc = it.path || it.instancePath || it.field || '';
      const msg = it.message || it.error || String(it);
      const strong = document.createElement('span'); strong.className='fw-600'; strong.textContent = loc ? (loc+': ') : '';
      const text = document.createElement('span'); text.textContent = msg;
      if (loc) line.appendChild(strong); line.appendChild(text);
      issuesEl.appendChild(line);
    });
  }
  window.hydreqEditorIssues = window.hydreqEditorIssues || { renderIssues };
})();
