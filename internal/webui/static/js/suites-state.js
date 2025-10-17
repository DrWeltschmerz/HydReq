// suites-state.js — state holder for suites selection and results
(function(){
  // Selection and open suites (persisted)
  let selected = new Set();
  let openSuites = new Set();
  try{ selected = new Set(JSON.parse(localStorage.getItem('hydreq.sel')||'[]')); }catch(e){ selected = new Set(); }
  try{ openSuites = new Set(JSON.parse(localStorage.getItem('hydreq.openSuites')||'[]')); }catch(e){ openSuites = new Set(); }

  function persistSelected(){ try{ localStorage.setItem('hydreq.sel', JSON.stringify(Array.from(selected))); }catch(e){} }
  function persistOpen(){ try{ localStorage.setItem('hydreq.openSuites', JSON.stringify(Array.from(openSuites))); }catch(e){} }

  // Per-suite last status and summary
  const lastStatus = new Map(); // path -> Map(name=>status)
  const lastSuiteSummary = new Map(); // path -> { summary, tests }
  let currentSuitePath = null;

  function getSelected(){ return selected; }
  function setSelected(arrOrSet){ selected = new Set(Array.isArray(arrOrSet) ? arrOrSet : Array.from(arrOrSet||[])); persistSelected(); return selected; }
  function toggleSelected(path){ if (selected.has(path)) selected.delete(path); else selected.add(path); persistSelected(); return selected; }

  function getOpenSuites(){ return openSuites; }
  function toggleOpen(path, isOpen){ if (isOpen) openSuites.add(path); else openSuites.delete(path); persistOpen(); return openSuites; }

  function getLastStatus(path){ return lastStatus.get(path) || new Map(); }
  function setTestStatus(path, name, status){ if (!path||!name) return; const m = lastStatus.get(path) || new Map(); m.set(name, (status||'').toLowerCase()); lastStatus.set(path, m); }

  function getSuiteSummary(path){ return lastSuiteSummary.get(path) || null; }
  function setSuiteSummary(path, summary, tests){ if (!path) return; lastSuiteSummary.set(path, { summary: summary||null, tests: Array.isArray(tests)? tests: [] }); }
  function upsertTest(path, name, status, durationMs, messages){
    if (!path || !name) return;
    const rec = lastSuiteSummary.get(path) || { summary: null, tests: [] };
    const tests = Array.isArray(rec.tests) ? rec.tests : [];
    const idx = tests.findIndex(t=> (t.name||t.Name) === name);
    const testRec = { name, status: (status||'').toLowerCase(), durationMs: durationMs||0, messages: Array.isArray(messages)? messages: [] };
    if (idx>=0) tests[idx] = testRec; else tests.push(testRec);
    rec.tests = tests; lastSuiteSummary.set(path, rec);
  }

  function getCurrentSuitePath(){ return currentSuitePath; }
  function setCurrentSuitePath(path){ currentSuitePath = path || null; }

  window.hydreqSuitesState = window.hydreqSuitesState || {
    getSelected, setSelected, toggleSelected,
    getOpenSuites, toggleOpen,
    getLastStatus, setTestStatus,
    getSuiteSummary, setSuiteSummary, upsertTest,
    getCurrentSuitePath, setCurrentSuitePath
  };
})();
