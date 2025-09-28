const { chromium } = require('playwright');
(async ()=>{
  const url = process.env.APP_URL || 'http://127.0.0.1:8787/';
  console.log('PROBE: opening', url);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => {
    try { console.log('PAGE_CONSOLE['+msg.type()+']', msg.text()); } catch(e) { console.log('PAGE_CONSOLE err', e); }
  });
  page.on('pageerror', err => { console.log('PAGE_ERROR', err && err.stack ? err.stack : String(err)); });
  page.on('requestfailed', r => { console.log('PAGE_REQFAIL', r.url(), r.failure() && r.failure().errorText); });
  try{
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('PROBE: goto status', resp && resp.status());
  }catch(e){ console.log('PROBE: goto failed', String(e)); }
  // wait a bit for any client-side fetches
  await page.waitForTimeout(2500);
  try{
    const count = await page.evaluate(()=> document.querySelectorAll('#suites li').length);
    console.log('PROBE: #suites li count =', count);
  }catch(e){ console.log('PROBE: eval count error', String(e)); }
  try{
    const hy = await page.evaluate(()=> (window.__HYDREQ_REFRESH ? { status: window.__HYDREQ_REFRESH.status, len: window.__HYDREQ_REFRESH.len, err: window.__HYDREQ_REFRESH.err } : null));
    console.log('PROBE: __HYDREQ_REFRESH =', JSON.stringify(hy));
  }catch(e){ console.log('PROBE: eval hy error', String(e)); }
  try{
    const html = await page.evaluate(()=>{
      const el = document.querySelector('#suites'); if(!el) return null; return el.innerHTML.slice(0, 4000);
    });
    console.log('PROBE: #suites innerHTML (truncated)\n', html || '<none>');
  }catch(e){ console.log('PROBE: eval html error', String(e)); }
  await page.waitForTimeout(500);
  await browser.close();
  console.log('PROBE: done');
  process.exit(0);
})();
