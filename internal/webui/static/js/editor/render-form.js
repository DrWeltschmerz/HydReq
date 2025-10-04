(function(){
  // render-form.js — wires suite/test forms and returns getter functions
  function render(modal, working, selIndex, onChange, prev){
    if (!modal || !working) return prev || {};
    var suiteVarsGet = prev && prev.suiteVarsGet || null;
    var suitePreGet = prev && prev.suitePreGet || null;
    var suitePostGet = prev && prev.suitePostGet || null;
    var headersGet = prev && prev.headersGet || null;
    var queryGet = prev && prev.queryGet || null;
    var extractGet = prev && prev.extractGet || null;
    var matrixGet = prev && prev.matrixGet || null;
    var testPreGet = prev && prev.testPreGet || null;
    var testPostGet = prev && prev.testPostGet || null;
    var assertHeaderGet = prev && prev.assertHeaderGet || null;
    var assertJsonEqGet = prev && prev.assertJsonEqGet || null;
    var assertJsonContainsGet = prev && prev.assertJsonContainsGet || null;
    var assertBodyContainsGet = prev && prev.assertBodyContainsGet || null;

    // Suite-level fields and hooks
    try{
      if (window.hydreqEditorForms && window.hydreqEditorForms.suite && typeof window.hydreqEditorForms.suite.wire === 'function'){
        var suiteFns = window.hydreqEditorForms.suite.wire(modal, working, function(){ try{ onChange && onChange(); }catch{} });
        // Preserve previously returned getters across renders when possible
        suiteVarsGet = suiteVarsGet || suiteFns.suiteVarsGet || null;
        suitePreGet = suitePreGet || suiteFns.suitePreGet || null;
        suitePostGet = suitePostGet || suiteFns.suitePostGet || null;
      }
    }catch{}

    // Test-specific wiring
    if (Array.isArray(working.tests) && selIndex >= 0 && selIndex < working.tests.length){
      var test = working.tests[selIndex];
      try{
        if (window.hydreqEditorForms && window.hydreqEditorForms.testmeta && typeof window.hydreqEditorForms.testmeta.wire === 'function'){
          window.hydreqEditorForms.testmeta.wire(modal, test, function(){ try{ onChange && onChange(); }catch{} });
        }
      }catch{}
      var extractEl = modal.querySelector('#ed_extract');
      var matrixEl = modal.querySelector('#ed_matrix');
      // Request (headers/query)
      try{
        if (window.hydreqEditorForms && window.hydreqEditorForms.request && typeof window.hydreqEditorForms.request.wire === 'function'){
          var reqFns = window.hydreqEditorForms.request.wire(modal, test, function(){ try{ onChange && onChange(); }catch{} });
          headersGet = reqFns.headersGet || headersGet;
          queryGet = reqFns.queryGet || queryGet;
        }
      }catch{}
      if (extractEl){
        try{
          var exFn = (window.hydreqEditorTables && window.hydreqEditorTables.extractTable) ? window.hydreqEditorTables.extractTable : null;
          extractGet = exFn ? exFn(extractEl, test.extract || {}, function(){ try{ onChange && onChange(); }catch{} }) : null;
        }catch{}
      }
      if (matrixEl){
        try{
          if (window.hydreqEditorForms && window.hydreqEditorForms.matrix && typeof window.hydreqEditorForms.matrix.render === 'function'){
            matrixGet = window.hydreqEditorForms.matrix.render(modal, matrixEl, test.matrix || {}, function(){ try{ onChange && onChange(); }catch{} });
          } else {
            matrixGet = function(){ return (test.matrix || {}); };
            while (matrixEl.firstChild) matrixEl.removeChild(matrixEl.firstChild);
            var note = document.createElement('div'); note.className='dim'; note.textContent='Matrix editor unavailable.'; matrixEl.appendChild(note);
          }
        }catch{}
      }
      // OpenAPI override
      try{ if (window.hydreqEditorForms?.openapi?.wire) window.hydreqEditorForms.openapi.wire(modal, test, function(){ try{ onChange && onChange(); }catch{} }); }catch{}
      // Assertions
      try{
        if (window.hydreqEditorForms && window.hydreqEditorForms.assert && typeof window.hydreqEditorForms.assert.wire === 'function'){
          var asFns = window.hydreqEditorForms.assert.wire(modal, test, function(){ try{ onChange && onChange(); }catch{} });
          assertHeaderGet = asFns.assertHeaderGet || assertHeaderGet;
          assertJsonEqGet = asFns.assertJsonEqGet || assertJsonEqGet;
          assertJsonContainsGet = asFns.assertJsonContainsGet || assertJsonContainsGet;
          assertBodyContainsGet = asFns.assertBodyContainsGet || assertBodyContainsGet;
        }
      }catch{}
      // Hooks
      try{
        var preC = modal.querySelector('#ed_test_prehooks');
        var postC = modal.querySelector('#ed_test_posthooks');
        if (preC){
          if (window.hydreqEditorHooks && typeof window.hydreqEditorHooks.hookList === 'function'){
            testPreGet = window.hydreqEditorHooks.hookList(preC, Array.isArray(test.pre)? test.pre: [], { scope: 'testPre' }, function(){ try{ onChange && onChange(); }catch{} });
          } else {
            while (preC.firstChild) preC.removeChild(preC.firstChild);
            var ph = document.createElement('div'); ph.className='dim'; ph.textContent='Hooks module not loaded.'; preC.appendChild(ph);
            testPreGet = function(){ return Array.isArray(test.pre) ? test.pre : []; };
          }
        }
        if (postC){
          if (window.hydreqEditorHooks && typeof window.hydreqEditorHooks.hookList === 'function'){
            testPostGet = window.hydreqEditorHooks.hookList(postC, Array.isArray(test.post)? test.post: [], { scope: 'testPost' }, function(){ try{ onChange && onChange(); }catch{} });
          } else {
            while (postC.firstChild) postC.removeChild(postC.firstChild);
            var po = document.createElement('div'); po.className='dim'; po.textContent='Hooks module not loaded.'; postC.appendChild(po);
            testPostGet = function(){ return Array.isArray(test.post) ? test.post : []; };
          }
        }
      }catch{}
      // Retry
      try{ if (window.hydreqEditorForms?.retry?.wire) window.hydreqEditorForms.retry.wire(modal, test, function(){ try{ onChange && onChange(); }catch{} }); }catch{}
    }

    return {
      suiteVarsGet, suitePreGet, suitePostGet,
      headersGet, queryGet, extractGet, matrixGet,
      testPreGet, testPostGet,
      assertHeaderGet, assertJsonEqGet, assertJsonContainsGet, assertBodyContainsGet
    };
  }
  window.hydreqEditorRenderForm = window.hydreqEditorRenderForm || { render };
})();
