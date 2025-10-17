(function(){
  function normalize(inObj){
    if (!inObj || typeof inObj !== 'object') return { tests: [] };
    const out = {};
    out.name = inObj.Name || inObj.name || '';
    out.baseUrl = inObj.BaseURL || inObj.baseUrl || '';
    out.vars = inObj.Variables || inObj.vars || {};
    const au = inObj.Auth || inObj.auth || null;
    out.auth = au ? { bearerEnv: (au.BearerEnv || au.bearerEnv || ''), basicEnv: (au.BasicEnv || au.basicEnv || '') } : null;
    out.preSuite = inObj.PreSuite || inObj.preSuite || [];
    out.postSuite = inObj.PostSuite || inObj.postSuite || [];
    // Suite-level OpenAPI
    (function(){
      const oa = inObj.OpenAPI || inObj.openApi || null;
      if (oa && (oa.File || oa.file)){
        out.openApi = { file: (oa.File || oa.file) };
        if (oa.Enabled !== undefined || oa.enabled !== undefined) out.openApi.enabled = (oa.Enabled ?? oa.enabled);
      }
    })();
    const testsArr = Array.isArray(inObj.Tests) ? inObj.Tests : (Array.isArray(inObj.tests) ? inObj.tests : []);
    if (Array.isArray(testsArr)){
      out.tests = testsArr.map(function(tc){
        const t = {};
        t.name = tc.Name || tc.name || '';
        const rq = tc.Request || tc.request || {};
        t.request = {
          method: rq.Method || rq.method || 'GET',
          url: rq.URL || rq.url || '',
          headers: rq.Headers || rq.headers || {},
          query: rq.Query || rq.query || {},
          body: (rq.Body !== undefined ? rq.Body : rq.body)
        };
        const as = tc.Assert || tc.assert || {};
        const aOut = {};
        if (as.Status !== undefined || as.status !== undefined) aOut.status = (as.Status !== undefined ? as.Status : as.status);
        if (as.HeaderEquals || as.headerEquals) aOut.headerEquals = as.HeaderEquals || as.headerEquals;
        if (as.JSONEquals || as.jsonEquals) aOut.jsonEquals = as.JSONEquals || as.jsonEquals;
        if (as.JSONContains || as.jsonContains) aOut.jsonContains = as.JSONContains || as.jsonContains;
        if (as.BodyContains || as.bodyContains) aOut.bodyContains = as.BodyContains || as.bodyContains;
        if (as.MaxDurationMs !== undefined || as.maxDurationMs !== undefined) aOut.maxDurationMs = (as.MaxDurationMs !== undefined ? as.MaxDurationMs : as.maxDurationMs);
        if (Object.keys(aOut).length) t.assert = aOut;
        const ex = tc.Extract || tc.extract || {};
        const exOut = {};
        Object.keys(ex||{}).forEach(function(k){
          const v = ex[k]||{}; exOut[k] = { jsonPath: v.JSONPath || v.jsonPath || '' };
        });
        t.extract = exOut;
        if ((tc.Skip ?? tc.skip) === true) t.skip = true;
        if ((tc.Only ?? tc.only) === true) t.only = true;
        if ((tc.TimeoutMs ?? tc.timeoutMs) !== undefined) t.timeoutMs = (tc.TimeoutMs ?? tc.timeoutMs);
        if ((tc.Repeat ?? tc.repeat) !== undefined) t.repeat = (tc.Repeat ?? tc.repeat);
        t.tags = tc.Tags || tc.tags || [];
        const __stg = (tc.Stage ?? tc.stage);
        if (__stg !== undefined && __stg !== 0) t.stage = __stg;
        t.vars = tc.Vars || tc.vars || {};
        t.dependsOn = tc.DependsOn || tc.dependsOn || [];
        t.pre = tc.Pre || tc.pre || [];
        t.post = tc.Post || tc.post || [];
        const rt = tc.Retry || tc.retry || null;
        if (rt){
          const rOut = {};
          if (rt.Max !== undefined || rt.max !== undefined) rOut.max = (rt.Max ?? rt.max);
          if (rt.BackoffMs !== undefined || rt.backoffMs !== undefined) rOut.backoffMs = (rt.BackoffMs ?? rt.backoffMs);
          if (rt.JitterPct !== undefined || rt.jitterPct !== undefined) rOut.jitterPct = (rt.JitterPct ?? rt.jitterPct);
          if (Object.keys(rOut).length) t.retry = rOut;
        }
        t.matrix = tc.Matrix || tc.matrix || {};
        const oa = tc.OpenAPI || tc.openApi || null;
        if (oa && (oa.Enabled !== undefined || oa.enabled !== undefined)) t.openApi = { enabled: (oa.Enabled ?? oa.enabled) };
        return t;
      });
    } else {
      out.tests = [];
    }
    return out;
  }

  window.hydreqEditorNormalize = window.hydreqEditorNormalize || { normalize };
})();
