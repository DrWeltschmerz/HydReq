// state/env.js — environment overrides read/render wrappers
(function(){
  function read(){
    const env = {};
    try{
      const root = document.getElementById('env_kv_list');
      if (!root) return env;
      const rows = root.querySelectorAll('.env-row');
      rows.forEach(row=>{
        const k = (row.querySelector('.env-k')?.value||'').trim();
        const v = (row.querySelector('.env-v')?.value||'').trim();
        if (k) env[k] = v;
      });
    }catch{}
    return env;
  }
  function renderActive(targetId){
    const env = read();
    try{
      const envActive = document.getElementById(targetId||'env_active');
      if (envActive){
        while (envActive.firstChild) envActive.removeChild(envActive.firstChild);
        Object.keys(env).forEach(k=>{ const b=document.createElement('span'); b.className='pill'; b.textContent=k; envActive.appendChild(b); });
      }
      const topWrap = document.getElementById('activeEnvTopWrap');
      const top = document.getElementById('activeEnvTop');
      if (topWrap && top){
        while (top.firstChild) top.removeChild(top.firstChild);
        const keys = Object.keys(env);
        if (keys.length){ topWrap.classList.remove('invisible'); keys.slice(0,12).forEach(k=>{ const b=document.createElement('span'); b.className='pill text-10'; b.textContent=k; top.appendChild(b); }); }
        else { topWrap.classList.add('invisible'); }
      }
    }catch{}
    return env;
  }
  window.hydreqEnv = window.hydreqEnv || { read, renderActive };
})();
