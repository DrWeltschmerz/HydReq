// test-run-listener.js - lightweight browser test harness for run-listener
(function(){
  // Install fake EventSource for deterministic testing
  window._fakeESinstances = window._fakeESinstances || [];
  const RealEventSource = window.EventSource;
  function FakeEventSource(url){
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this.closed = false;
    const self = this;
    window._fakeESinstances.push(self);
    this.emit = function(data){ if (self.onmessage) { self.onmessage({ data: JSON.stringify(data) }); } };
    this.close = function(){ self.closed = true; };
  }
  window.EventSource = FakeEventSource;

  // Simple assertion recorder
  const calls = [];
  function pushCall(name, payload){ calls.push({name, payload}); }

  // Subscribe using run-listener
  const unsub = window.hydreqRunListener.subscribe('fake-run', {
    batchStart: (p)=> { pushCall('batchStart', p); },
    suiteStart: async (p)=> { pushCall('suiteStart', p); /* simulate async work */ await new Promise(r=>setTimeout(r,10)); },
    testStart: (p)=> { pushCall('testStart', p); },
    test: (p)=> { pushCall('test', p); },
    suiteEnd: (p)=> { pushCall('suiteEnd', p); },
    batchEnd: (p)=> { pushCall('batchEnd', p); },
    error: (p)=> { pushCall('error', p); },
    done: (p)=> { pushCall('done', p); }
  });

  // Grab the FakeEventSource we installed
  const es = window._fakeESinstances[0];
  // Emit a sequence of events
  const seq = [
    {type:'batchStart', payload:{total:1}},
    {type:'suiteStart', payload:{name:'s1', path:'p1', total:2, stages:{}}},
    {type:'testStart', payload:{Name:'t1', Stage:0, path:'p1'}},
    {type:'test', payload:{Name:'t1', Status:'passed', DurationMs:5, Stage:0, path:'p1'}},
    {type:'testStart', payload:{Name:'t2', Stage:0, path:'p1'}},
    {type:'test', payload:{Name:'t2', Status:'failed', DurationMs:2, Stage:0, path:'p1', Messages:['boom']}},
    {type:'suiteEnd', payload:{name:'s1', path:'p1', summary:{passed:1, failed:1, skipped:0, total:2, durationMs:7}, tests:[{name:'t1', status:'passed'},{name:'t2', status:'failed'}]}},
    {type:'batchEnd', payload:{}},
    {type:'done', payload:{}}
  ];

  (async function(){
    for (const ev of seq){
      es.emit(ev);
      // small pause to let any awaited handlers run
      await new Promise(r=>setTimeout(r,5));
    }

    // Validate sequence
    const names = calls.map(c=>c.name);
    const expected = ['batchStart','suiteStart','testStart','test','testStart','test','suiteEnd','batchEnd','done'];
    const ok = names.join(',') === expected.join(',');
    const out = document.getElementById('run-listener-test-output');
    if (ok){ out.textContent = 'run-listener test passed'; out.style.color='green'; console.log('run-listener test passed'); }
    else { out.textContent = 'run-listener test FAILED: got ' + names.join(','); out.style.color='red'; console.error('run-listener test FAILED', names); }
    // restore original EventSource
    window.EventSource = RealEventSource;
    if (typeof unsub === 'function') unsub();
  })();
})();
