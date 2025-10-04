const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-state basics', function(){
  it('manages selection, open sets, and test status', function(){
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { runScripts:'outside-only', url:'http://localhost/' });
    const { window } = dom; global.window = window; global.document = window.document;
    // preload empty LS
    window.localStorage.clear();

    const code = fs.readFileSync('internal/webui/static/js/suites-state.js','utf8');
    window.eval(code);

    const s = window.hydreqSuitesState;
    // selection
    s.setSelected(['a.yaml']);
    assert.ok(s.getSelected().has('a.yaml'));
    s.toggleSelected('b.yaml');
    assert.ok(s.getSelected().has('b.yaml'));
    // open suites
    s.toggleOpen('a.yaml', true);
    assert.ok(s.getOpenSuites().has('a.yaml'));
    s.toggleOpen('a.yaml', false);
    assert.ok(!s.getOpenSuites().has('a.yaml'));
    // status and summary
    s.setTestStatus('p.yaml','T','failed');
    assert.strictEqual(s.getLastStatus('p.yaml').get('T'), 'failed');
    s.upsertTest('p.yaml','T','passed', 12, ['ok']);
    const sum = s.getSuiteSummary('p.yaml');
    assert.ok(sum && Array.isArray(sum.tests) && sum.tests.length===1);
    assert.strictEqual(sum.tests[0].status, 'passed');
  });
});
