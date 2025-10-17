(function(){
  function wire(modal, test, onChange){
    if (!modal || !test) return;
    try{
      const nameEl = modal.querySelector('#ed_test_name');
      const dependsEl = modal.querySelector('#ed_test_depends');
      const stagePrimary = modal.querySelector('#ed_stage');
      const stageAlt = modal.querySelector('#ed_test_stage');
      const skipEl = modal.querySelector('#ed_skip');
      const onlyEl = modal.querySelector('#ed_only');
      const tagsEl = modal.querySelector('#ed_tags');

      if (nameEl) nameEl.value = test.name || '';
      if (dependsEl) dependsEl.value = Array.isArray(test.dependsOn) ? test.dependsOn.join(', ') : '';
      const stageVal = (typeof test.stage === 'number') ? String(test.stage) : '';
      if (stagePrimary) stagePrimary.value = stageVal;
      if (stageAlt) stageAlt.value = stageVal;
      if (skipEl) skipEl.checked = !!test.skip;
      if (onlyEl) onlyEl.checked = !!test.only;
      if (tagsEl) tagsEl.value = Array.isArray(test.tags) ? test.tags.join(', ') : '';

      const evs = ['input','change','blur'];
      [nameEl, dependsEl, stagePrimary, stageAlt, tagsEl].forEach(el=>{
        if (!el) return;
        if (!el.dataset.boundMeta){
          evs.forEach(ev=> el.addEventListener(ev, ()=>{ try{ onChange && onChange(); }catch{} }));
          el.dataset.boundMeta = '1';
        }
      });
      [skipEl, onlyEl].forEach(el=>{
        if (!el) return;
        if (!el.dataset.boundMeta){
          el.addEventListener('change', ()=>{ try{ onChange && onChange(); }catch{} });
          el.dataset.boundMeta = '1';
        }
      });

      // Keep stage fields in sync if both are present
      if (stagePrimary && stageAlt && !stagePrimary.dataset.syncBound){
        stagePrimary.addEventListener('input', ()=>{ stageAlt.value = stagePrimary.value; try{ onChange && onChange(); }catch{} });
        stageAlt.addEventListener('input', ()=>{ stagePrimary.value = stageAlt.value; try{ onChange && onChange(); }catch{} });
        stagePrimary.dataset.syncBound = '1';
        stageAlt.dataset.syncBound = '1';
      }
    }catch{}
  }

  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.testmeta = { wire };
})();
