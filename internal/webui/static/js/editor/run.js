// editor/run.js — quick-run integration and status propagation
(function(){
  async function quickRun(opts){
    try{
      const working = (window.hydreqEditorState && window.hydreqEditorState.getWorking && window.hydreqEditorState.getWorking()) || {};
      const env = (typeof window.parseEnv==='function') ? window.parseEnv() : {};
      const payload = {
        parsed: working,
        env,
        runAll: !!(opts && opts.runAll),
        includeDeps: !!(opts && opts.includeDeps),
        includePrevStages: !!(opts && opts.includePrevStages)
      };
      if (opts && typeof opts.testIndex === 'number') payload.testIndex = opts.testIndex;
      if (window.hydreqRun && typeof window.hydreqRun.start==='function'){
        const runId = await window.hydreqRun.start(payload);
        return runId || null;
      }
    }catch(e){ console.error('quickRun failed', e); }
    return null;
  }

  window.hydreqEditorRun = window.hydreqEditorRun || { quickRun };
})();
