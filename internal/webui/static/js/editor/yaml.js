// editor/yaml.js — CodeMirror setup, parse/serialize, theme sync
(function(){
  let cm = null;
  let hydrated = false;

  function mount(el){
    if (!el) return null;
    try{
      cm = CodeMirror.fromTextArea(el, {
        mode: 'yaml',
        theme: getCMTheme(),
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        indentWithTabs: false,
        extraKeys: {
          Tab: function(cm){ if (cm.somethingSelected()) cm.indentSelection('add'); else cm.replaceSelection('  ', 'end'); },
          'Shift-Tab': function(cm){ cm.indentSelection('subtract'); }
        }
      });
      // Move wrapper into dedicated container if present so CSS can scope by #ed_yaml_editor
      try{
        const wrap = cm.getWrapperElement ? cm.getWrapperElement() : null;
        const host = document.getElementById('ed_yaml_editor');
        if (wrap && host && wrap.parentNode !== host){ while (host.firstChild) host.removeChild(host.firstChild); host.appendChild(wrap); }
      }catch{}
      // Best-effort beforeChange: replace tabs with spaces if editor exposes hook
      try{
        if (typeof cm.on === 'function'){
          cm.on('beforeChange', function(_cm, change){
            if (!change || !Array.isArray(change.text)) return;
            let changed = false;
            const out = change.text.map(function(line){ if (line.indexOf('\t') !== -1){ changed = true; return line.replace(/\t/g, '  '); } return line; });
            if (changed && typeof change.update === 'function') change.update(change.from, change.to, out, change.origin);
          });
        }
      }catch{}
  if (cm.getWrapperElement) { try{ cm.getWrapperElement().classList.add('h-100'); }catch{} }
      cm.on('change', debounce(handleChange, 200));
      // Defer handling changes until after initial hydration
      hydrated = false;
      setTimeout(()=>{ hydrated = true; }, 120);
      return cm;
    }catch(e){ return null; }
  }

  function handleChange(){
    try{
      if (!hydrated){ return; }
      // Ignore programmatic updates during suppression window
      try{
        if (window.__ed_yamlSuppressUntil && Date.now() < window.__ed_yamlSuppressUntil){
          return;
        }
        if (window.__ed_yamlSuppressUntil && Date.now() >= window.__ed_yamlSuppressUntil){
          // Clear expired window
          window.__ed_yamlSuppressUntil = null;
        }
      }catch{}
      if (window.__ed_yamlSuppress || window.__ed_initializing){ return; }
      const text = cm ? cm.getValue() : '';
      const parsed = tryParseYaml(text);
      if (parsed){
        if (!window.__ed_initializing && window.hydreqEditorState && window.hydreqEditorState.setWorking) window.hydreqEditorState.setWorking(parsed);
        if (window.hydreqEditorState && window.hydreqEditorState.setDirty) window.hydreqEditorState.setDirty(true);
      } else {
        // Even if YAML is temporarily invalid, mark as dirty to reflect user edits
        if (window.hydreqEditorState && window.hydreqEditorState.setDirty) window.hydreqEditorState.setDirty(true);
      }
    }catch(e){}
  }

  function tryParseYaml(text){
    try{ return jsyaml && jsyaml.load ? (text ? jsyaml.load(text) : {}) : null; }catch(e){ return null; }
  }

  function setText(text){ if (cm) cm.setValue(text||''); }
  function getText(){ return cm ? cm.getValue() : ''; }

  function getCMTheme(){
    try{
      // Allow host to map UI theme to a specific CodeMirror theme
      let themeName = null;
      try{
        const body = document.body;
        if (body){
          const known = [
            'dark','synthwave','hack','catppuccin-mocha','catppuccin-latte',
            'catppuccin-frappe','catppuccin-macchiato','nord','dracula','monokai',
            'gruvbox-dark','gruvbox-light','solarized-dark','solarized-light',
            'tokyo-night','one-dark-pro','palenight','rose-pine','everforest-dark',
            'everforest-light','ayu-dark'
          ];
          themeName = known.find(c=> body.classList.contains(c)) || null;
        }
      }catch{}
      if (typeof window.getCodeMirrorTheme === 'function' && themeName){
        const mapped = window.getCodeMirrorTheme(themeName);
        if (mapped) return mapped;
      }
      if (typeof window.isDocDark === 'function') return window.isDocDark() ? 'material-darker' : 'default';
      if (typeof window.getCurrentTheme === 'function') return window.getCurrentTheme() === 'dark' ? 'material-darker' : 'default';
      return 'default';
    }catch(e){ return 'default'; }
  }

  function syncTheme(){ try{ if (!cm) return; cm.setOption('theme', getCMTheme()); }catch(e){} }
  // Enhanced theme sync: mirror body theme classes onto CodeMirror wrapper
  ;(function(){
    const knownThemes = new Set([
      'dark','synthwave','hack','catppuccin-mocha','catppuccin-latte',
      'catppuccin-frappe','catppuccin-macchiato','nord','dracula','monokai',
      'gruvbox-dark','gruvbox-light','solarized-dark','solarized-light',
      'tokyo-night','one-dark-pro','palenight','rose-pine','everforest-dark',
      'everforest-light','ayu-dark'
    ]);
    function applyWrapperTheme(){
      try{
        if (!cm || !cm.getWrapperElement) return;
        const wrap = cm.getWrapperElement();
        // Clear previous marks
        wrap.classList.remove('cm-dark','cm-light');
        knownThemes.forEach(c=> wrap.classList.remove(c));
        // Add dark/light marker
        const dark = (typeof window.isDocDark==='function') ? !!window.isDocDark() : false;
        wrap.classList.add(dark ? 'cm-dark' : 'cm-light');
        // Mirror specific theme classes from body
        const body = document.body || null;
        if (!body) return;
        body.classList.forEach(c=>{ if (knownThemes.has(c)) wrap.classList.add(c); });
      }catch(e){}
    }
    // Patch syncTheme to also apply wrapper theme
    const _origSync = syncTheme;
    syncTheme = function(){ try{ _origSync && _origSync(); }catch(e){} applyWrapperTheme(); };
  })();

  // small debounce
  function debounce(fn, ms){ let t=null; return function(){ clearTimeout(t); t=setTimeout(fn, ms); }; }

  window.hydreqEditorYAML = window.hydreqEditorYAML || { mount, setText, getText, syncTheme };
})();
