(function(){
  function wire(modal, suite, onChange){
    if (!modal || !suite) return {};
    const evs = ['input','change','blur'];
    try{
      const suiteNameEl = modal.querySelector('#ed_suite_name');
      const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
      const authBearerEl = modal.querySelector('#ed_auth_bearer');
      const authBasicEl = modal.querySelector('#ed_auth_basic');
      const suiteVarsEl = modal.querySelector('#ed_suite_vars');

      if (suiteNameEl) suiteNameEl.value = suite.name || '';
      if (baseUrlEl) baseUrlEl.value = suite.baseUrl || suite.baseURL || '';
      if (authBearerEl) authBearerEl.value = (suite.auth && (suite.auth.bearerEnv || suite.auth.bearer)) || '';
      if (authBasicEl) authBasicEl.value = (suite.auth && (suite.auth.basicEnv || suite.auth.basic)) || '';

      [suiteNameEl, baseUrlEl, authBearerEl, authBasicEl].forEach(el=>{
        if (!el) return;
        if (!el.dataset.boundSuite){ evs.forEach(ev=> el.addEventListener(ev, ()=>{ try{ onChange && onChange(); }catch{} })); el.dataset.boundSuite='1'; }
      });

      let suiteVarsGet = null;
      if (suiteVarsEl){
        try{
          const kv = (window.hydreqEditorTables && window.hydreqEditorTables.kvTable) ? window.hydreqEditorTables.kvTable : null;
          suiteVarsGet = kv ? kv(suiteVarsEl, suite.vars || {}, ()=>{ try{ onChange && onChange(); }catch{} }) : null;
        }catch{}
      }

      // Suite hooks (pre/post)
      let suitePreGet = null, suitePostGet = null;
      try{
        const preC = modal.querySelector('#ed_suite_presuite');
        const postC = modal.querySelector('#ed_suite_postsuite');
        if (preC && window.hydreqEditorHooks && typeof window.hydreqEditorHooks.hookList === 'function'){
          suitePreGet = window.hydreqEditorHooks.hookList(preC, Array.isArray(suite.preSuite)? suite.preSuite: [], { scope:'suitePre' }, ()=>{ try{ onChange && onChange(); }catch{} });
        }
        if (postC && window.hydreqEditorHooks && typeof window.hydreqEditorHooks.hookList === 'function'){
          suitePostGet = window.hydreqEditorHooks.hookList(postC, Array.isArray(suite.postSuite)? suite.postSuite: [], { scope:'suitePost' }, ()=>{ try{ onChange && onChange(); }catch{} });
        }
      }catch{}

      return { suiteVarsGet, suitePreGet, suitePostGet };
    }catch{}
    return {};
  }

  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.suite = { wire };
})();
