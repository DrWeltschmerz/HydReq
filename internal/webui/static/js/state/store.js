// state/store.js — tiny central state store for suites/tests
(function(){
  if (window.hydreqStore) return; // singleton guard
  const _suites = Object.create(null); // path -> { summary, badge, tests: { [name]: { status, durationMs, messages, ts } } }
  let _seq = 1;
  const _listeners = new Map(); // id -> fn

  function _emit(evt){
    try{ _listeners.forEach(fn=>{ try{ fn(evt); }catch(e){} }); }catch(e){}
  }

  function getSuite(path){
    if (!path) return null;
    const s = _suites[path];
    if (!s) return null;
    // return a shallow clone to prevent accidental mutation
    return { summary: s.summary || null, badge: s.badge || 'unknown', tests: Object.assign({}, s.tests||{}) };
  }

  function getAll(){
    const out = {};
    Object.keys(_suites).forEach(p=>{ out[p] = getSuite(p); });
    return out;
  }

  function setTest(path, name, patch){
    if (!path || !name) return;
    const now = Date.now();
    const suite = _suites[path] || (_suites[path] = { summary:null, badge:'unknown', tests:{} });
    const cur = suite.tests[name] || { status:'', durationMs:0, messages:[], ts: now };
    const next = {
      status: (patch && patch.status ? String(patch.status).toLowerCase() : cur.status || ''),
      durationMs: (patch && typeof patch.durationMs==='number') ? patch.durationMs : cur.durationMs || 0,
      messages: Array.isArray(patch && patch.messages) ? patch.messages : (Array.isArray(cur.messages)? cur.messages: []),
      ts: now
    };
    suite.tests[name] = next;
    // Optionally compute badge if failed passed etc.
    try{
      const vals = Object.values(suite.tests);
      const anyFailed = vals.some(t => t.status === 'failed');
      const anyPassed = vals.some(t => t.status === 'passed');
      suite.badge = anyFailed ? 'failed' : (anyPassed ? 'passed' : suite.badge || 'unknown');
    }catch(e){}
    _emit({ type:'test', path, name, data: next });
  }

  function setSummary(path, summary){
    if (!path) return;
    const suite = _suites[path] || (_suites[path] = { summary:null, badge:'unknown', tests:{} });
    suite.summary = summary || null;
    // derive badge from summary if available
    try{
      if (summary){
        suite.badge = (summary.failed>0) ? 'failed' : ((summary.passed>0) ? 'passed' : (summary.skipped>0 ? 'skipped' : 'unknown'));
      }
    }catch(e){}
    _emit({ type:'summary', path, data: suite.summary });
  }

  function setBadge(path, status){
    if (!path) return;
    const suite = _suites[path] || (_suites[path] = { summary:null, badge:'unknown', tests:{} });
    suite.badge = (status||'unknown').toLowerCase();
    _emit({ type:'badge', path, data: suite.badge });
  }

  function subscribe(fn){
    if (typeof fn !== 'function') return null;
    const id = _seq++; _listeners.set(id, fn); return id;
  }
  function unsubscribe(id){ if (id && _listeners.has(id)) _listeners.delete(id); }

  window.hydreqStore = { getSuite, getAll, setTest, setSummary, setBadge, subscribe, unsubscribe };
})();
