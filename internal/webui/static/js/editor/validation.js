(function(){
  function validateField(fieldName, value, parentType){
    const errors = [];
    const v = (value==null)? '': String(value);
    const t = parentType || 'suite';
    if (t === 'suite'){
      if (fieldName==='name' && (!v || v.trim()==='')) errors.push('Suite name is required');
      if (fieldName==='baseUrl' && (!v || v.trim()==='')) errors.push('Base URL is required');
    }
    if (t === 'test'){
      if (fieldName==='name' && (!v || v.trim()==='')) errors.push('Test name is required');
    }
    if (t === 'request'){
      if (fieldName==='method' && (!v || v.trim()==='')) errors.push('HTTP method is required');
      if (fieldName==='url' && (!v || v.trim()==='')) errors.push('URL path is required');
    }
    if (t === 'assert'){
      if (fieldName==='status' && (!v || isNaN(parseInt(v,10)))) errors.push('Status code must be a valid number');
      if (fieldName==='status' && v && (parseInt(v,10) < 100 || parseInt(v,10) > 599)) errors.push('Status code must be between 100-599');
    }
    if (fieldName==='baseUrl' && v && v.trim()){
      try{ new URL(v.trim()); }catch{ errors.push('Base URL must be a valid URL'); }
    }
    if (['timeout','maxDurationMs','stage','repeat'].includes(fieldName) && v && v.trim()){
      if (isNaN(parseInt(v,10)) || parseInt(v,10) < 0) errors.push(`${fieldName} must be a positive number`);
    }
    return errors;
  }

  function showFieldValidation(element, errors){
    try{
      element.classList.remove('border-red-500','border-green-500','border-2','border');
      const existing = element.parentNode && element.parentNode.querySelector ? element.parentNode.querySelector('.validation-error') : null;
      if (existing) existing.remove();
      if (errors.length){
        element.classList.add('border-red-500','border-2');
        const div = document.createElement('div');
        div.className='validation-error text-error text-12 mt-2';
        div.textContent = errors[0];
        if (element.parentNode) element.parentNode.insertBefore(div, element.nextSibling);
      } else {
        element.classList.add('border-green-500','border');
      }
    }catch{}
  }

  function wire(modal){
    if (!modal) return;
    try{
      if (modal.dataset && modal.dataset.validationWired === '1') return;
      if (modal.dataset) modal.dataset.validationWired = '1';
    }catch{}
    const fields = [
      '#ed_suite_name','#ed_suite_baseurl','#ed_auth_bearer','#ed_auth_basic',
      '#ed_test_name','#ed_url','#ed_method','#ed_timeout','#ed_body',
      '#ed_assert_status','#ed_assert_maxDuration','#ed_stage'
    ];
    fields.forEach(sel=>{
      const el = modal.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', ()=>{
        try{
          if (typeof window.__ed_mirrorYamlFromVisual==='function') window.__ed_mirrorYamlFromVisual();
        }catch{}
      });
    });
    ['#ed_skip','#ed_only'].forEach(sel=>{
      const el = modal.querySelector(sel);
      if (!el) return;
      el.addEventListener('change', ()=>{
        try{
          if (typeof window.__ed_mirrorYamlFromVisual==='function') window.__ed_mirrorYamlFromVisual();
        }catch{}
      });
    });
  }

  window.hydreqEditorValidation = window.hydreqEditorValidation || { wire, validateField, showFieldValidation };
})();
