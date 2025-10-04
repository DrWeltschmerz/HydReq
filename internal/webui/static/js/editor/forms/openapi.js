(function(){
  function wire(modal, test, onChange){
    if (!modal || !test) return;
    try{
      // Ensure the OpenAPI panel is present and visible
      const oapiForm = modal.querySelector('#ed_oapi_form');
      if (oapiForm) {
        // Remove any accidental hidden state and ensure its parent details is open
        try { oapiForm.classList.remove('hidden'); } catch {}
        try {
          const panel = oapiForm.closest('details');
          if (panel) { panel.open = true; panel.classList.remove('hidden'); }
        } catch {}
      }
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
