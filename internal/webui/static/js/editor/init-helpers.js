(function(){
  function beginInit(){ try{ window.__ed_initializing = true; window.__ed_uiSuppressDirty = true; }catch{} }
  function endInit(){ try{ window.__ed_initializing = false; }catch{} }
  function afterSettle(yamlCtl){
    try{
      setTimeout(()=>{
        try{ if (yamlCtl && yamlCtl.resetBaseline) yamlCtl.resetBaseline();
             if (window.hydreqEditorState && window.hydreqEditorState.setDirty) window.hydreqEditorState.setDirty(false);
             window.__ed_uiSuppressDirty = false; }catch{}
      }, 200);
    }catch{}
  }
  function finalizeBaseline(yamlCtl, working, hadRaw){
    try{
      if (!yamlCtl || !yamlCtl.getText) return;
      const current = yamlCtl.getText() || '';
      let serialized = '';
      try{ if (window.hydreqEditorSerialize && window.hydreqEditorSerialize.toYaml) serialized = window.hydreqEditorSerialize.toYaml(working)||''; }catch{}
      // For now we always baseline to current; avoid churn on open
      if (yamlCtl && yamlCtl.resetBaseline) yamlCtl.resetBaseline();
    }catch{}
  }
  window.hydreqEditorInit = window.hydreqEditorInit || { beginInit, endInit, afterSettle, finalizeBaseline };
})();
