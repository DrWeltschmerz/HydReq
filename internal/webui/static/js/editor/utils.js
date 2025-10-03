(function(){
  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }
  function safeJSONParse(txt, fallback){ try{ return JSON.parse(txt); }catch{ return fallback; } }
  function textEquals(a,b){ return String(a||'').trim() === String(b||'').trim(); }
  function qs(){ try{ return new URLSearchParams(window.location.search||''); }catch{ return new URLSearchParams(); } }
  function hide(el){ try{ if (el) el.style.display='none'; }catch{} }
  function show(el){ try{ if (el) el.style.display=''; }catch{} }
  window.hydreqEditorUtils = window.hydreqEditorUtils || { isObj, safeJSONParse, textEquals, qs, hide, show };
})();
