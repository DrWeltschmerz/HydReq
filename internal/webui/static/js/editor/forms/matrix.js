(function(){
  function render(modal, container, matrix, onChange){
    const c = (typeof container === 'string') ? modal.querySelector(container) : container;
    if (!c) return ()=>({});
    while (c.firstChild) c.removeChild(c.firstChild);
    const table = document.createElement('div'); table.className='ed-matrix-table';
    function addRow(key='', values=[]){
      const row = document.createElement('div'); row.className='ed-matrix-row';
      const keyInput = document.createElement('input'); keyInput.type='text'; keyInput.placeholder='Variable name'; keyInput.value=key; keyInput.className='ed-matrix-key';
      if (onChange){ ['input','change','blur'].forEach(ev=> keyInput.addEventListener(ev, onChange)); }
      const valuesContainer = document.createElement('div'); valuesContainer.className='ed-matrix-values';
      function addValueInput(value=''){ const valueDiv=document.createElement('div'); valueDiv.className='ed-matrix-value'; const valueInput=document.createElement('input'); valueInput.type='text'; valueInput.placeholder='Value'; valueInput.value=value; valueInput.className='w-full'; if (onChange){ ['input','change','blur'].forEach(ev=> valueInput.addEventListener(ev, onChange)); } const removeValueBtn=document.createElement('button'); removeValueBtn.textContent='×'; removeValueBtn.className='btn btn-xs btn-ghost'; removeValueBtn.title='Remove value'; removeValueBtn.onclick=()=>{ valueDiv.remove(); if (onChange) onChange(); }; valueDiv.appendChild(valueInput); valueDiv.appendChild(removeValueBtn); valuesContainer.appendChild(valueDiv); }
      if (Array.isArray(values) && values.length) values.forEach(v=> addValueInput(v)); else addValueInput();
      const addValueBtn=document.createElement('button'); addValueBtn.textContent='+ Value'; addValueBtn.className='btn btn-xs btn-secondary mt-8'; addValueBtn.onclick=()=>{ addValueInput(); if (onChange) onChange(); }; valuesContainer.appendChild(addValueBtn);
      const removeBtn=document.createElement('button'); removeBtn.textContent='×'; removeBtn.className='btn btn-xs btn-ghost'; removeBtn.title='Remove variable'; removeBtn.onclick=()=>{ row.remove(); if (onChange) onChange(); };
      row.appendChild(keyInput); row.appendChild(valuesContainer); row.appendChild(removeBtn); table.appendChild(row);
    }
    if (matrix && typeof matrix==='object'){ Object.keys(matrix).forEach(k=> addRow(k, Array.isArray(matrix[k])?matrix[k]:[])); }
    if (!matrix || Object.keys(matrix).length===0) addRow();
  const addBtn=document.createElement('button'); addBtn.textContent='+ Add Variable'; addBtn.className='btn btn-sm btn-primary mt-8'; addBtn.onclick=()=>{ addRow(); if (onChange) onChange(); };
    c.appendChild(table); c.appendChild(addBtn);
    return ()=>{ const result={}; const rows=table.querySelectorAll('.ed-matrix-row'); rows.forEach(row=>{ const keyInput=row.querySelector('.ed-matrix-key'); const valueInputs=row.querySelectorAll('.ed-matrix-values input[type="text"]'); if (keyInput && keyInput.value.trim()){ const key=keyInput.value.trim(); const values=[]; valueInputs.forEach(input=>{ if (input.value.trim()) values.push(input.value.trim()); }); if (values.length>0) result[key]=values; } }); return result; };
  }
  window.hydreqEditorForms = window.hydreqEditorForms || {};
  window.hydreqEditorForms.matrix = { render };
})();
