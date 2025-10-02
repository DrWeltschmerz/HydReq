const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-dom helpers', function(){
  it('builds test row and updates badges/details', function(){
    const dom = new JSDOM(`<!doctype html><html><body><div id="tests"></div></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;

    // Load the helpers
    const code = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8');
    window.eval(code);

    // Build a row
    const cont = window.hydreqSuitesDOM.buildTestContainer({ name:'T1', tags:['smoke','auth'] }, 'unknown', { selectedTags:['smoke'] });
    assert.ok(cont, 'container should be created');
    const nameEl = cont.querySelector('.suite-test-name');
    const badgeEl = cont.querySelector('.suite-test-status');
    assert.strictEqual(nameEl.dataset.name, 'T1');
    assert.strictEqual(badgeEl.textContent, '·');

    // Update badge to passed
    window.hydreqSuitesDOM.updateTestBadge(badgeEl, 'passed');
    assert.strictEqual(badgeEl.textContent, '✓');

    // Add details for failure
    window.hydreqSuitesDOM.updateTestDetails(cont, 'failed', ['boom']);
    const pre = cont.querySelector('pre.message-block.fail');
    assert.ok(pre, 'fail message block should exist');
    assert.ok(pre.textContent.includes('boom'));

    // Suite-level badge
    const sb = document.createElement('span'); sb.className='status-badge suite-badge';
    window.hydreqSuitesDOM.updateSuiteBadge(sb, 'skipped');
    assert.strictEqual(sb.textContent, '○');
    assert.strictEqual(sb.dataset.status, 'skipped');
  });

  it('finds test container by name', function(){
    const dom = new JSDOM(`<!doctype html><html><body><div id="tests"></div></body></html>`, { runScripts:'outside-only' });
    const window = dom.window; global.window = window; global.document = window.document;
    const code = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8');
    window.eval(code);

    const testsDiv = document.getElementById('tests');
    const a = window.hydreqSuitesDOM.buildTestContainer({ name:'A' }, '', {});
    const b = window.hydreqSuitesDOM.buildTestContainer({ name:'B' }, '', {});
    testsDiv.appendChild(a); testsDiv.appendChild(b);
    const found = window.hydreqSuitesDOM.findTestContainer(testsDiv, 'B');
    assert.ok(found, 'should find B');
    const nm = found.querySelector('.suite-test-name');
    assert.strictEqual(nm.dataset.name, 'B');
  });
});
