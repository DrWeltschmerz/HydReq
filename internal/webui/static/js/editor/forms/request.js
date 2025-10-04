(function(){
  function wire(modal, test, onChange){
    if (!modal || !test) return { headersGet: null, queryGet: null };
    const methodEl = modal.querySelector('#ed_method');
    const urlEl = modal.querySelector('#ed_url');
    const timeoutEl = modal.querySelector('#ed_timeout');
    const bodyEl = modal.querySelector('#ed_body');
    const headersEl = modal.querySelector('#ed_headers');
    const queryEl = modal.querySelector('#ed_query');

    // Populate primitives
    if (methodEl && test.request) methodEl.value = test.request.method || 'GET';
    if (urlEl && test.request) urlEl.value = test.request.url || '';
    if (timeoutEl && test.request) timeoutEl.value = test.request.timeout || '';
    if (bodyEl && test.request) {
      try {
        const body = test.request.body;
        if (body && typeof body === 'object') {
          bodyEl.value = JSON.stringify(body, null, 2);
        } else {
          bodyEl.value = body || '';
        }
      } catch (e) {
        bodyEl.value = (test.request && test.request.body) || '';
      }
    }

    // kv tables
    let headersGet = null, queryGet = null;
    try { if (headersEl && typeof kvTable === 'function') headersGet = kvTable(headersEl, (test.request && test.request.headers) || {}, onChange); } catch{}
    try { if (queryEl && typeof kvTable === 'function') queryGet = kvTable(queryEl, (test.request && test.request.query) || {}, onChange); } catch{}

    return { headersGet, queryGet };
  }

  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.request = { wire };
})();
