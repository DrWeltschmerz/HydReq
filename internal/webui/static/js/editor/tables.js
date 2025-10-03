(function(){
  let modal = null;
  function setModal(m){ modal = m; }

  function kvTable(container, obj, onChange){
    const c = (typeof container === 'string') ? (modal && modal.querySelector(container)) : container;
    if (!c) return ()=>({});
    c.innerHTML = '';
    const table = document.createElement('div');
    const addRow = (k='', v='')=>{
      const row = document.createElement('div'); row.className = 'ed-grid-1-1-auto mb-2';
      const ki = document.createElement('input'); ki.type='text'; ki.value=k;
      const vi = document.createElement('input'); vi.type='text'; vi.value=v;
      if (onChange){ ['input','change','blur'].forEach(ev=>{ ki.addEventListener(ev, onChange); vi.addEventListener(ev, onChange); }); }
      const del = document.createElement('button'); del.textContent='×'; del.title='Remove'; del.onclick = ()=>{ row.remove(); if (onChange) onChange(); };
      row.appendChild(ki); row.appendChild(vi); row.appendChild(del);
      table.appendChild(row);
    };
    if (obj){ Object.keys(obj).forEach(k=> addRow(k, obj[k])); }
    const add = document.createElement('button'); add.textContent='Add'; add.onclick = ()=> { addRow(); if (onChange) onChange(); };
    c.appendChild(table); c.appendChild(add);
    return ()=>{
      const rows = Array.from(table.children);
      const out = {};
      rows.forEach(row=>{
        const inputs = row.querySelectorAll('input');
        if (inputs.length>=2){ const k=inputs[0].value.trim(); const v=inputs[1].value; if (k) out[k]=v; }
      });
      return out;
    };
  }

  function listTable(container, arr, onChange){
    const c = (typeof container === 'string') ? (modal && modal.querySelector(container)) : container;
    if (!c) return ()=>[];
    c.innerHTML = '';
    const table = document.createElement('div');
    const addRow = (v='')=>{
      const row = document.createElement('div'); row.className = 'ed-grid-1-auto mb-2';
      const vi=document.createElement('input'); vi.type='text'; vi.value=v;
      if (onChange){ ['input','change','blur'].forEach(ev=> vi.addEventListener(ev, onChange)); }
      const del = document.createElement('button'); del.textContent='×'; del.title='Remove'; del.onclick = ()=>{ row.remove(); if (onChange) onChange(); };
      row.appendChild(vi); row.appendChild(del);
      table.appendChild(row);
    };
    if (Array.isArray(arr)) arr.forEach(v=> addRow(v));
    const add = document.createElement('button'); add.textContent='Add'; add.onclick = ()=> { addRow(); if (onChange) onChange(); };
    c.appendChild(table); c.appendChild(add);
    return ()=>{
      const rows = Array.from(table.children);
      const out = [];
      rows.forEach(row=>{ const inp = row.querySelector('input'); if (inp){ const v = inp.value; if (v!=='' && v!=null) out.push(v); }});
      return out;
    };
  }

  function mapTable(container, obj, valuePlaceholder='value', onChange){
    return kvTable(container, obj||{}, onChange);
  }

  function extractTable(container, obj, onChange){
    const flat = {};
    try{ Object.keys(obj||{}).forEach(k=>{ const v = obj[k]||{}; flat[k] = v.jsonPath || v.JSONPath || ''; }); }catch{}
    const getFlat = kvTable(container, flat, onChange);
    return ()=>{
      const out = {};
      const m = getFlat() || {};
      Object.keys(m).forEach(k=>{ const jp = m[k]; if (String(jp||'').trim()!==''){ out[k] = { jsonPath: jp }; } });
      return out;
    };
  }

  function init(modalEl){ setModal(modalEl); }

  window.hydreqEditorTables = window.hydreqEditorTables || {};
  window.hydreqEditorTables.init = init;
  window.hydreqEditorTables.kvTable = kvTable;
  window.hydreqEditorTables.listTable = listTable;
  window.hydreqEditorTables.mapTable = mapTable;
  window.hydreqEditorTables.extractTable = extractTable;
})();
