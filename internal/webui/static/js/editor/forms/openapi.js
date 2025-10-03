(function(){
  function wire(modal, test, onChange){
    if (!modal || !test) return;
    try{
      const oapiEl = modal.querySelector('#ed_oapi_enabled');
      if (!oapiEl) return;
      const enabled = (test.openApi && typeof test.openApi.enabled !== 'undefined') ? String(!!test.openApi.enabled) : 'inherit';
      oapiEl.value = enabled === 'true' ? 'true' : (enabled === 'false' ? 'false' : 'inherit');
      if (!oapiEl.dataset.bound){ oapiEl.addEventListener('change', ()=>{ try{ onChange && onChange(); }catch{} }); oapiEl.dataset.bound='1'; }
    }catch{}
  }
  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.openapi = { wire };
})();
