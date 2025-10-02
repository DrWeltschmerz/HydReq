// editor/state.js — working model state, dirty flag, selection
(function(){
  let working = { tests: [] };
  let dirty = false;
  let selIndex = 0;

  function setWorking(obj){ working = obj || { tests: [] }; emit('state:changed', { working }); return working; }
  function getWorking(){ return working; }
  function setDirty(v){ dirty = !!v; emit('dirty:changed', { dirty }); return dirty; }
  function isDirty(){ return dirty; }
  function setSelIndex(i){ selIndex = Math.max(0, parseInt(i||0,10)); emit('selection:changed', { selIndex }); return selIndex; }
  function getSelIndex(){ return selIndex; }

  function emit(type, data){ try{ document.dispatchEvent(new CustomEvent('hydreq:editor:'+type, { detail: data||{} })); }catch(e){} }

  window.hydreqEditorState = window.hydreqEditorState || {
    setWorking,
    getWorking,
    setDirty,
    isDirty,
    setSelIndex,
    getSelIndex
  };
})();
