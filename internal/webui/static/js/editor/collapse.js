(function(){
  function setup(modal, yamlCtl){
    function wire(buttonId, columnId){
      const collapseBtn = modal.querySelector(buttonId);
      const column = modal.querySelector(columnId);
      if (!collapseBtn || !column) return;
      collapseBtn.addEventListener('click', () => {
        column.classList.toggle('collapsed');
        const collapsed = column.classList.contains('collapsed');
        collapseBtn.textContent = collapsed ? '▶' : '◀';
        collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
        if (columnId === '#col-yaml' && !collapsed) {
          setTimeout(() => { try{ yamlCtl && yamlCtl.ensure && yamlCtl.ensure(); }catch{} }, 10);
        }
      });
    }
    wire('#ed_collapse_tests', '#col-tests');
    wire('#ed_collapse_visual', '#col-visual');
    wire('#ed_collapse_yaml', '#col-yaml');
    wire('#ed_collapse_results', '#col-results');
  }
  window.hydreqEditorCollapse = window.hydreqEditorCollapse || { setup };
})();
