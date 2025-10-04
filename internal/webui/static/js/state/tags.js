// state/tags.js — central tag state wrappers
(function(){
  function read(){
    let list = [], selected = [];
    try{ list = JSON.parse(localStorage.getItem('hydreq.tags.list')||'[]')||[]; }catch{}
    try{ selected = JSON.parse(localStorage.getItem('hydreq.tags.selected')||'[]')||[]; }catch{}
    return { list: Array.isArray(list)? list: [], selected: Array.isArray(selected)? selected: [] };
  }
  function write(list, selected){
    try{ localStorage.setItem('hydreq.tags.list', JSON.stringify(list||[])); }catch{}
    try{ localStorage.setItem('hydreq.tags.selected', JSON.stringify(selected||[])); }catch{}
    // Back-compat: keep legacy #tags input (if present) in sync
    try{ const legacy = document.getElementById('tags'); if (legacy) legacy.value = (selected||[]).join(','); }catch{}
    // Notify listeners (suites/test chips)
    try{ document.dispatchEvent(new CustomEvent('hydreq:tags-changed')); }catch{}
    // Try to re-render chips and sync rows if helpers exist
    try{ typeof window.__hydreq_renderActiveTags==='function' && window.__hydreq_renderActiveTags(); }catch{}
    try{ typeof window.__hydreq_syncTagRows==='function' && window.__hydreq_syncTagRows(); }catch{}
  }
  function getSelected(){ return read().selected; }
  function setSelected(arr){
    const st = read();
    const uniq = Array.from(new Set((arr||[]).filter(Boolean)));
    const list = st.list;
    // ensure list contains all selected
    const merged = Array.from(new Set([...(list||[]), ...uniq]));
    write(merged, uniq);
  }
  function toggle(tag){
    if (!tag) return;
    const st = read();
    const s = new Set(st.selected);
    if (s.has(tag)) s.delete(tag); else s.add(tag);
    const newSel = Array.from(s);
    const newList = st.list.includes(tag) ? st.list : st.list.concat([tag]);
    write(newList, newSel);
  }
  // Expose cohesive API and back-compat globals if not provided elsewhere
  window.hydreqTags = window.hydreqTags || { read, write, getSelected, setSelected, toggle };
  if (!window.getSelectedTags) window.getSelectedTags = getSelected;
  if (!window.setSelectedTags) window.setSelectedTags = setSelected;
  if (!window.toggleSelectedTag) window.toggleSelectedTag = toggle;
})();
