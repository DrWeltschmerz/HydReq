// suites-view.js — view wrappers for suites list
(function(){
  function render(list){ try{ if (typeof window.renderSuites==='function') window.renderSuites(list); }catch(e){} }
  function expandAll(){ try{ if (typeof window.expandAll==='function') return window.expandAll(); }catch(e){} }
  function collapseAll(){ try{ if (typeof window.collapseAll==='function') return window.collapseAll(); }catch(e){} }
  function refresh(){ try{ if (typeof window.refresh==='function') return window.refresh(); }catch(e){} }
  window.hydreqSuitesView = window.hydreqSuitesView || { render, expandAll, collapseAll, refresh };
})();
