(function(){
  function wire(modal, test, onChange){
    if (!modal || !test) return { assertHeaderGet:null, assertJsonEqGet:null, assertJsonContainsGet:null, assertBodyContainsGet:null };
    const statusEl = modal.querySelector('#ed_assert_status');
    const maxDurationEl = modal.querySelector('#ed_assert_maxDuration');
    if (statusEl) statusEl.value = (test.assert && (test.assert.status||'')) || '';
    if (maxDurationEl) maxDurationEl.value = (test.assert && (test.assert.maxDurationMs || test.assert.maxDuration)) || '';

    let assertHeaderGet = null, assertJsonEqGet = null, assertJsonContainsGet = null, assertBodyContainsGet = null;
    try {
      const headerC = modal.querySelector('#ed_assert_headerEquals');
      const jsonEqC = modal.querySelector('#ed_assert_jsonEquals');
      const jsonCtC = modal.querySelector('#ed_assert_jsonContains');
      const bodyCtC = modal.querySelector('#ed_assert_bodyContains');

      if (headerC && typeof kvTable === 'function') {
        assertHeaderGet = kvTable(headerC, (test.assert && test.assert.headerEquals) || {}, onChange);
      }

      if (jsonEqC && typeof kvTable === 'function') {
        const src = (test.assert && test.assert.jsonEquals) || {};
        const flat = {}; Object.keys(src||{}).forEach(k=>{ const v = src[k]; flat[k] = (typeof v === 'object') ? JSON.stringify(v) : String(v); });
        assertJsonEqGet = kvTable(jsonEqC, flat, onChange);
      }

      if (jsonCtC && typeof kvTable === 'function') {
        const src = (test.assert && test.assert.jsonContains) || {};
        const flat = {}; Object.keys(src||{}).forEach(k=>{ const v = src[k]; flat[k] = (typeof v === 'object') ? JSON.stringify(v) : String(v); });
        assertJsonContainsGet = kvTable(jsonCtC, flat, onChange);
      }

      if (bodyCtC && typeof listTable === 'function') {
        const arr = (test.assert && Array.isArray(test.assert.bodyContains)) ? test.assert.bodyContains : (test.assert && typeof test.assert.bodyContains==='string' ? [test.assert.bodyContains] : []);
        assertBodyContainsGet = listTable(bodyCtC, arr, onChange);
      }
    } catch {}

    return { assertHeaderGet, assertJsonEqGet, assertJsonContainsGet, assertBodyContainsGet };
  }

  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.assert = { wire };
})();
