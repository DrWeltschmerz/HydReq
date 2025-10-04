(function(){
  function runTest(modal, ctx){
    return (async () => {
      const w = ctx.getWorking();
      const sel = ctx.getSelIndex();
      ctx.collectFormData();
      if (!w.tests || !w.tests[sel]){
        ctx.appendQuickRunLine('No test selected', 'text-warning');
        return;
      }
      const includeDeps = !!(modal.querySelector('#ed_run_with_deps')?.checked);
      const includePrevStages = !!(modal.querySelector('#ed_run_with_prevstages')?.checked);
      const label = w.tests[sel].name || `test ${sel+1}`;
      ctx.clearQuickRun();
      ctx.appendQuickRunLine('Starting test...', 'dim');
      let started = false;
      try { if (window.hydreqEditorState?.setWorking) window.hydreqEditorState.setWorking(w); } catch {}
      try{
        if (window.hydreqEditorRun?.quickRun){
          const runId = await window.hydreqEditorRun.quickRun({
            runAll: false,
            includeDeps,
            includePrevStages,
            testIndex: sel
          });
          if (runId){
            ctx.prepareQuickRun(label);
            window.hydreqEditorRun.listen(runId, ctx.makeRunHandlers());
            started = true;
          }
        }
      }catch{}
      if (started) return;
      const env = ctx.parseEnvFromPage();
      const payload = {
        parsed: w,
        testIndex: sel,
        env,
        runAll: false,
        includeDeps,
        includePrevStages
      };
      const res = await fetch('/api/editor/testrun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok){
        let txt=''; try{ txt=await res.text(); }catch{}
        throw new Error('HTTP '+res.status+(txt?(': '+txt):''));
      }
      const data = await res.json();
      if (data && data.runId){
        ctx.prepareQuickRun(label);
        window.hydreqEditorRun.listen(data.runId, ctx.makeRunHandlers());
      } else {
        window.hydreqEditorRun.dispatchImmediate(
          data,
          ctx.makeRunHandlers(),
          label
        );
      }
    })().catch(e => {
      console.error(e);
      try{ ctx.appendQuickRunLine('Run failed: '+e.message, 'text-error'); }catch{}
    });
  }

  function runSuite(modal, ctx){
    return (async () => {
      const w = ctx.getWorking();
      ctx.collectFormData();
      const label = w.name || 'suite';
      ctx.clearQuickRun();
      ctx.appendQuickRunLine('Starting suite...', 'dim');
      let started = false;
      try { if (window.hydreqEditorState?.setWorking) window.hydreqEditorState.setWorking(w); } catch {}
      try{
        if (window.hydreqEditorRun?.quickRun){
          const runId = await window.hydreqEditorRun.quickRun({ runAll: true, includeDeps: true });
          if (runId){
            ctx.prepareQuickRun(label);
            window.hydreqEditorRun.listen(runId, ctx.makeRunHandlers());
            started = true;
          }
        }
      }catch{}
      if (started) return;
      const env = ctx.parseEnvFromPage();
      const res = await fetch('/api/editor/testrun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: w, env, runAll: true, includeDeps: true })
      });
      if (!res.ok){
        let txt=''; try{ txt=await res.text(); }catch{}
        throw new Error('HTTP '+res.status+(txt?(': '+txt):''));
      }
      const data = await res.json();
      if (data && data.runId){
        ctx.prepareQuickRun(label);
        window.hydreqEditorRun.listen(data.runId, ctx.makeRunHandlers());
      } else {
        window.hydreqEditorRun.dispatchImmediate(
          data,
          ctx.makeRunHandlers(),
          label
        );
      }
    })().catch(e => {
      console.error(e);
      try{ ctx.appendQuickRunLine('Suite run failed: '+e.message, 'text-error'); }catch{}
    });
  }

  async function validate(modal, ctx){
    try{
      ctx.collectFormData();
      let raw = await ctx.getYamlText();
      // fallback handled in getYamlText
      const v = await window.hydreqEditorRun.validate(raw);
      ctx.renderIssues(v.issues || v.errors || [], v.yaml || raw);
      const vb = modal.querySelector('#ed_validation_box');
      if (vb) vb.open = true;
    }catch(e){ console.error(e); ctx.renderIssues([{ message: e.message }]); }
  }

  async function save(modal, ctx){
    try{
      ctx.collectFormData();
      let yamlData = await ctx.getYamlText();
      if (!yamlData || !yamlData.trim()){
        yamlData = await ctx.serializeWorkingToYamlImmediate();
      }
      if (!yamlData || !yamlData.trim()){
        alert('Nothing to save: YAML is empty.');
        return false;
      }
      try{
        if (modal.dataset.isNew === '1'){
          const path = ctx.getPath();
          const ck = await fetch('/api/editor/checkpath', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
          });
          if (ck.ok){
            const info = await ck.json();
            if (info.exists && !confirm('File was created on disk since you opened the editor. Overwrite?')){
              return false;
            }
          }
        }
      }catch{}
      try{
        const v = await window.hydreqEditorRun.validate(yamlData);
        const issues = v.issues || v.errors || [];
        if (Array.isArray(issues) && issues.length){
          const txt = issues
            .slice(0,8)
            .map(i=> i.message || JSON.stringify(i))
            .join('\n');
          if (!confirm('Validation returned issues:\n' + txt + '\n\nProceed and save anyway?')){
            return false;
          }
        }
      }catch(e){ if(!confirm('Validation failed to run. Proceed to save?')) return false; }
      const response = await fetch('/api/editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: ctx.getPath(), raw: yamlData })
      });
      if (!response.ok){
        const error = await response.text();
        alert('✗ Save failed: ' + error);
        return false;
      }
      alert('✓ Suite saved successfully');
      try{ ctx.afterSaved(yamlData); }catch{}
      // Update new → normal mode
      try{
        const saveBtn = modal.querySelector('#ed_save');
        const saveCloseBtn = modal.querySelector('#ed_save_close');
        if (modal.dataset.isNew === '1'){
          modal.dataset.isNew = '0';
          if (saveBtn) saveBtn.textContent = 'Save';
          if (saveCloseBtn) saveCloseBtn.textContent = 'Save & Close';
        }
      }catch{}
      return true;
    }catch(e){ console.error('Save failed:', e); alert('Save error: ' + e.message); return false; }
  }

  async function saveClose(modal, ctx){
    const ok = await save(modal, ctx);
    if (ok && !ctx.isDirty()) ctx.attemptClose();
  }

  window.hydreqEditorControls = window.hydreqEditorControls || {
    runTest,
    runSuite,
    validate,
    save,
    saveClose
  };
})();
