(function(){
  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }
  function safeJSONParse(txt, fallback){ try{ return JSON.parse(txt); }catch{ return fallback; } }
  function textEquals(a,b){ return String(a||'').trim() === String(b||'').trim(); }
  function qs(){ try{ return new URLSearchParams(window.location.search||''); }catch{ return new URLSearchParams(); } }
  function hide(el){ try{ if (el) { el.classList.add('hidden'); el.classList.remove('open'); el.style && (el.style.display = 'none'); } }catch{} }
  function show(el){ try{ if (el) { el.classList.remove('hidden'); el.classList.add('open'); el.style && (el.style.display = ''); } }catch{} }
  function debounce(fn, wait){ let t=null; return function(){ const args=arguments; clearTimeout(t); t=setTimeout(()=> fn.apply(this,args), wait); } }
  window.hydreqEditorUtils = window.hydreqEditorUtils || { isObj, safeJSONParse, textEquals, qs, hide, show, debounce };
})();
