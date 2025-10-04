(function(){
  function wire(modal, test, onChange){
    if (!modal || !test) return;
    try{
      const en = modal.querySelector('#ed_retry_enable');
      const mx = modal.querySelector('#ed_retry_max');
      const bo = modal.querySelector('#ed_retry_backoff');
      const ji = modal.querySelector('#ed_retry_jitter');
      const rt = test.retry || {};
      if (en) en.checked = !!(rt && (rt.max!=null || rt.backoffMs!=null || rt.jitterPct!=null));
      if (mx) mx.value = (rt.max != null) ? String(rt.max) : '';
      if (bo) bo.value = (rt.backoffMs != null) ? String(rt.backoffMs) : '';
      if (ji) ji.value = (rt.jitterPct != null) ? String(rt.jitterPct) : '';
      // Bind events
      const evs = ['input','change','blur'];
      [en,mx,bo,ji].forEach(el=>{ if (!el) return; if (!el.dataset.boundRetry){ evs.forEach(ev=> el.addEventListener(ev, ()=>{ try{ onChange && onChange(); }catch{} })); el.dataset.boundRetry='1'; } });
    }catch{}
  }

  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.retry = { wire };
})();
