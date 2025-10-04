(function(){
  function mount(modal){
    var api = {};
    var yamlEditor = null;
    var inMemoryYaml = '';
    var baselineYaml = '';
    var suppressDirty = false;

    function ensureYamlEditor(){
      if (yamlEditor) return yamlEditor;
      var rawEl = modal.querySelector('#ed_raw');
      if (!rawEl) return null;
      if (window.hydreqEditorYAML && typeof window.hydreqEditorYAML.mount === 'function'){
        yamlEditor = window.hydreqEditorYAML.mount(rawEl);
        try{ var el = yamlEditor && yamlEditor.getWrapperElement ? yamlEditor.getWrapperElement() : null; if (el) el.classList.add('h-100'); }catch{}
        setTimeout(function(){ try{ yamlEditor && yamlEditor.refresh && yamlEditor.refresh(); }catch{} }, 0);
        return yamlEditor;
      }
      return null;
    }

    function getText(){
      try{
        if (window.hydreqEditorYAML && window.hydreqEditorYAML.getText) return window.hydreqEditorYAML.getText();
        if (yamlEditor && yamlEditor.getValue) return yamlEditor.getValue();
        return inMemoryYaml;
      }catch(e){ return inMemoryYaml; }
    }

    function setText(txt){
      try{
        suppressDirty = true; window.__ed_yamlSuppress = true;
        // Establish a brief suppression window so CM change handler ignores this programmatic update
        try{ window.__ed_yamlSuppressUntil = Date.now() + 250; }catch{}
        if (window.hydreqEditorYAML && window.hydreqEditorYAML.setText) window.hydreqEditorYAML.setText(txt||'');
        else if (yamlEditor && yamlEditor.setValue) yamlEditor.setValue(txt||'');
        else { var rawEl = modal.querySelector('#ed_raw'); if (rawEl) rawEl.value = txt||''; inMemoryYaml = txt||''; }
      }finally{ suppressDirty = false; window.__ed_yamlSuppress = false; }
    }

    function markDirty(){
  if (suppressDirty || window.__ed_initializing) { return; }
      try{
        var cur = getText();
        var isDirty = (baselineYaml || '') !== (cur || '');
        var di = modal.querySelector('#ed_dirty_indicator');
        if (di){ if (isDirty){ di.classList.remove('hidden'); } else { di.classList.add('hidden'); } }
        if (window.hydreqEditorState && window.hydreqEditorState.setDirty) window.hydreqEditorState.setDirty(isDirty);
        
      }catch{}
    }

    function resetBaseline(){
      try{ 
        baselineYaml = getText() || ''; 
        var di = modal.querySelector('#ed_dirty_indicator'); if (di) di.classList.add('hidden');
        try{ if (window.hydreqEditorState && window.hydreqEditorState.setDirty) window.hydreqEditorState.setDirty(false); }catch{}
        
      }catch{}
    }

    function mirrorFromWorking(working, force){
      try{
        if (!working) return false;
        var yamlText = (window.hydreqEditorSerialize && window.hydreqEditorSerialize.toYaml) ? window.hydreqEditorSerialize.toYaml(working) : '';
        var cur = getText();
        var nonEmpty = function(t){ return !!(t && String(t).trim() !== ''); };
        var toSet = nonEmpty(yamlText) ? yamlText : cur;
        if ((force && nonEmpty(toSet) && toSet !== cur) || (!force && nonEmpty(yamlText) && cur !== yamlText)){
          suppressDirty = true; window.__ed_yamlSuppress = true; try{ window.__ed_yamlSuppressUntil = Date.now() + 250; }catch{}; setText(toSet); suppressDirty = false; window.__ed_yamlSuppress = false;
        }
        markDirty();
        return true;
      }catch(e){ return false; }
    }

    function parseToWorking(){
      try{
        var txt = getText();
        var parsed = (window.hydreqEditorSerialize && window.hydreqEditorSerialize.fromYaml) ? window.hydreqEditorSerialize.fromYaml(txt) : {};
        return parsed;
      }catch(e){ return {}; }
    }

    function syncTheme(){ try{ if (window.hydreqEditorYAML && window.hydreqEditorYAML.syncTheme) window.hydreqEditorYAML.syncTheme(); }catch{} }

    api.ensure = ensureYamlEditor;
    api.getText = getText;
    api.setText = setText;
    api.markDirty = markDirty;
    api.resetBaseline = resetBaseline;
    api.mirrorFromWorking = mirrorFromWorking;
    api.parseToWorking = parseToWorking;
    api.syncTheme = syncTheme;
    return api;
  }

  window.hydreqEditorYAMLControl = window.hydreqEditorYAMLControl || { mount };
})();
