(function(){
  function setup(modal, yamlCtl){
    function toggle(column, btn, columnId){
      if (!column) return;
      column.classList.toggle('collapsed');
      const collapsed = column.classList.contains('collapsed');
      if (btn){
        btn.textContent = collapsed ? '▶' : '◀';
        btn.title = collapsed ? 'Expand' : 'Collapse';
        btn.setAttribute('aria-expanded', String(!collapsed));
      }
      if (columnId === '#col-yaml' && !collapsed) {
        setTimeout(() => { try{ yamlCtl && yamlCtl.ensure && yamlCtl.ensure(); }catch{} }, 10);
      }
    }

    function wire(buttonId, columnId){
      const collapseBtn = modal.querySelector(buttonId);
      const column = modal.querySelector(columnId);
      if (!collapseBtn || !column) return;
      const header = column.querySelector('.ed-col-header');
      collapseBtn.setAttribute('role','button');
      collapseBtn.setAttribute('aria-expanded','true');
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle(column, collapseBtn, columnId);
      });
      // Make whole header clickable for better UX
      if (header){
        header.style.cursor = 'pointer';
        header.addEventListener('click', (e)=>{
          // Ignore clicks on other buttons inside header to avoid accidental toggles
          if (e.target && (e.target.closest && e.target.closest('.ed-collapse-btn'))){ return; }
          toggle(column, collapseBtn, columnId);
        });
      }
      // When collapsed, clicking anywhere on the column should expand it
      column.addEventListener('click', (e)=>{
        if (!column.classList.contains('collapsed')) return;
        // Avoid toggling when the tiny collapse button itself is clicked (already handled)
        if (e.target && (e.target.closest && e.target.closest('.ed-collapse-btn'))) return;
        toggle(column, collapseBtn, columnId);
      });
    }
    wire('#ed_collapse_tests', '#col-tests');
    wire('#ed_collapse_visual', '#col-visual');
    wire('#ed_collapse_yaml', '#col-yaml');
    wire('#ed_collapse_results', '#col-results');
  }
  window.hydreqEditorCollapse = window.hydreqEditorCollapse || { setup };
})();
