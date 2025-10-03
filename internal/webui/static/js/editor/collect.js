(function(){
  function collect(modal, working, selIndex, getters){
    if (!modal || !working) return working;
    const out = working; // mutate existing for now to keep references stable

    // Suite-level
    const suiteNameEl = modal.querySelector('#ed_suite_name');
    const baseUrlEl = modal.querySelector('#ed_suite_baseurl');
    const authBearerEl = modal.querySelector('#ed_auth_bearer');
    const authBasicEl = modal.querySelector('#ed_auth_basic');
    const suiteVarsEl = modal.querySelector('#ed_suite_vars');
    if (suiteNameEl) out.name = suiteNameEl.value;
    if (baseUrlEl) out.baseUrl = baseUrlEl.value;
    try{ if (suiteVarsEl && typeof getters.suiteVarsGet==='function'){ const v = getters.suiteVarsGet(); if (v && Object.keys(v).length) out.vars=v; else delete out.vars; } }catch{}
    const bearerVal = authBearerEl ? (authBearerEl.value||'').trim() : '';
    const basicVal = authBasicEl ? (authBasicEl.value||'').trim() : '';
    if (bearerVal || basicVal){ out.auth = out.auth || {}; if (bearerVal) out.auth.bearerEnv=bearerVal; else delete out.auth.bearerEnv; if (basicVal) out.auth.basicEnv=basicVal; else delete out.auth.basicEnv; delete out.auth.bearer; delete out.auth.basic; if (!out.auth.bearerEnv && !out.auth.basicEnv) delete out.auth; } else { delete out.auth; }

    // Suite hooks
    try{ if (typeof getters.suitePreGet==='function'){ const arr=getters.suitePreGet(); if (Array.isArray(arr)&&arr.length) out.preSuite=arr; else delete out.preSuite; } }catch{}
    try{ if (typeof getters.suitePostGet==='function'){ const arr=getters.suitePostGet(); if (Array.isArray(arr)&&arr.length) out.postSuite=arr; else delete out.postSuite; } }catch{}

    // Test-level
    if (!(Array.isArray(out.tests) && selIndex>=0 && selIndex<out.tests.length)) return out;
    const test = out.tests[selIndex] = out.tests[selIndex] || {};
    const testNameEl = modal.querySelector('#ed_test_name');
    const methodEl = modal.querySelector('#ed_method');
    const urlEl = modal.querySelector('#ed_url');
    const timeoutEl = modal.querySelector('#ed_timeout');
    const bodyEl = modal.querySelector('#ed_body');
    const skipEl = modal.querySelector('#ed_skip');
    const onlyEl = modal.querySelector('#ed_only');
    const stageEl = modal.querySelector('#ed_stage');
    const statusEl = modal.querySelector('#ed_assert_status');
    const maxDurationEl = modal.querySelector('#ed_assert_maxDuration');
    const dependsEl = modal.querySelector('#ed_test_depends');
    const tagsEl = modal.querySelector('#ed_tags');
    const oapiEl = modal.querySelector('#ed_oapi_enabled');

    if (testNameEl && testNameEl.value) test.name = testNameEl.value;
    test.request = test.request || {};
    if (methodEl) test.request.method = methodEl.value;
    if (urlEl) test.request.url = urlEl.value;
    if (timeoutEl){ const to = timeoutEl.value ? parseInt(timeoutEl.value,10) : NaN; if (!isNaN(to)) test.request.timeout = to; else delete test.request.timeout; }
    if (bodyEl){ try{ const bodyValue = bodyEl.value.trim(); if (bodyValue){ test.request.body = JSON.parse(bodyValue); } else { delete test.request.body; } }catch(e){ if ((bodyEl.value||'').trim()) test.request.body = bodyEl.value; else delete test.request.body; } }
    try{ if (typeof getters.headersGet==='function'){ const hv=getters.headersGet(); if (hv && Object.keys(hv).length) test.request.headers=hv; else delete test.request.headers; } }catch{}
    try{ if (typeof getters.queryGet==='function'){ const qv=getters.queryGet(); if (qv && Object.keys(qv).length) test.request.query=qv; else delete test.request.query; } }catch{}

    if (statusEl || maxDurationEl){ test.assert = test.assert || {}; }
    if (statusEl){ const st = statusEl.value ? parseInt(statusEl.value,10) : NaN; if (!isNaN(st)) test.assert.status=st; else if (test.assert) delete test.assert.status; }
    if (maxDurationEl){ const md = maxDurationEl.value ? parseInt(maxDurationEl.value,10) : NaN; if (!isNaN(md)) test.assert.maxDurationMs = md; else if (test.assert) delete test.assert.maxDurationMs; }
    function tryParse(s){ try{ return JSON.parse(s); }catch{ return s; } }
    try{ if (!test.assert) test.assert = {}; if (typeof getters.assertHeaderGet==='function'){ const hv = getters.assertHeaderGet(); if (hv && Object.keys(hv).length) test.assert.headerEquals = hv; else delete test.assert.headerEquals; } if (typeof getters.assertJsonEqGet==='function'){ const jv = getters.assertJsonEqGet(); const outMap={}; Object.keys(jv||{}).forEach(k=>{ const v=jv[k]; if (v!=='' && v!=null) outMap[k]=tryParse(v); }); if (Object.keys(outMap).length) test.assert.jsonEquals=outMap; else delete test.assert.jsonEquals; } if (typeof getters.assertJsonContainsGet==='function'){ const jc=getters.assertJsonContainsGet(); const outMap={}; Object.keys(jc||{}).forEach(k=>{ const v=jc[k]; if (v!=='' && v!=null) outMap[k]=tryParse(v); }); if (Object.keys(outMap).length) test.assert.jsonContains=outMap; else delete test.assert.jsonContains; } if (typeof getters.assertBodyContainsGet==='function'){ const bc=getters.assertBodyContainsGet(); if (Array.isArray(bc) && bc.length) test.assert.bodyContains=bc; else delete test.assert.bodyContains; } }catch{}
    if (test.assert && Object.keys(test.assert).length===0) delete test.assert;
    if (skipEl){ if (skipEl.checked) test.skip = true; else delete test.skip; }
    if (onlyEl){ if (onlyEl.checked) test.only = true; else delete test.only; }
    if (stageEl){ const stg = stageEl.value ? parseInt(stageEl.value,10) : NaN; if (!isNaN(stg)) test.stage=stg; else delete test.stage; }
    if (dependsEl){ const arr=(dependsEl.value||'').split(',').map(s=>s.trim()).filter(Boolean); if (arr.length) test.dependsOn=arr; else delete test.dependsOn; }
    if (tagsEl){ const tg=(tagsEl.value||'').split(',').map(s=>s.trim()).filter(Boolean); if (tg.length) test.tags=tg; else delete test.tags; }
    try{ if (typeof getters.extractGet==='function'){ const ex=getters.extractGet(); if (ex && Object.keys(ex).length) test.extract=ex; else delete test.extract; } }catch{}
    try{ if (typeof getters.matrixGet==='function'){ const mx=getters.matrixGet(); if (mx && Object.keys(mx).length) test.matrix=mx; else delete test.matrix; } }catch{}
    if (oapiEl){ const v=(oapiEl.value||'inherit'); if (v==='inherit'){ delete test.openApi; } else { test.openApi = { enabled: (v==='true') }; } }
    try{ if (typeof getters.testPreGet==='function'){ const arr=getters.testPreGet(); if (Array.isArray(arr)&&arr.length) test.pre=arr; else delete test.pre; } if (typeof getters.testPostGet==='function'){ const arr=getters.testPostGet(); if (Array.isArray(arr)&&arr.length) test.post=arr; else delete test.post; } }catch{}
    try{ const en=modal.querySelector('#ed_retry_enable'); const mx=modal.querySelector('#ed_retry_max'); const bo=modal.querySelector('#ed_retry_backoff'); const ji=modal.querySelector('#ed_retry_jitter'); const enabled=!!(en && en.checked); const r={}; if (mx && mx.value){ const n=parseInt(mx.value,10); if (!isNaN(n)) r.max=n; } if (bo && bo.value){ const n=parseInt(bo.value,10); if (!isNaN(n)) r.backoffMs=n; } if (ji && ji.value){ const n=parseInt(ji.value,10); if (!isNaN(n)) r.jitterPct=n; } if (enabled || Object.keys(r).length){ test.retry=r; } else { delete test.retry; } }catch{}

    return out;
  }
  window.hydreqEditorCollect = window.hydreqEditorCollect || { collect };
})();
