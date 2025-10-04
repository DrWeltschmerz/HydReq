const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

describe('suites-dom progress + setBar', function(){
  it('ensureStageRow creates elements and setBar updates width/aria', function(){
    const dom = new JSDOM(`<!doctype html><html><body><div id="stages"></div></body></html>`, { runScripts:'outside-only' });
    const { window } = dom; global.window = window; global.document = window.document;

    // Load utils for setBar and suites-dom for ensureStageRow
    const utils = fs.readFileSync('internal/webui/static/js/utils.js','utf8'); window.eval(utils);
    const code = fs.readFileSync('internal/webui/static/js/suites-dom.js','utf8'); window.eval(code);

    const { ensureStageRow } = window.hydreqSuitesDOM;
    const r1 = ensureStageRow(1);
    assert.ok(r1 && r1.barEl && r1.textEl, 'stage row created');
    assert.strictEqual(r1.created, true, 'first call creates');

    // Second call should re-use
    const r2 = ensureStageRow(1);
    assert.strictEqual(r2.created, false, 'second call re-uses');
    assert.strictEqual(r2.barEl.id, r1.barEl.id, 'same barEl');
    assert.strictEqual(r2.textEl.id, r1.textEl.id, 'same textEl');

    // Use setBar to update progress
    window.setBar(r1.barEl, 3, 10);
    // style width should be 30%
    assert.ok(r1.barEl.style.width.includes('30%'), 'width set to 30%');
    // aria attributes present
    assert.strictEqual(r1.barEl.getAttribute('role'), 'progressbar');
    assert.strictEqual(r1.barEl.getAttribute('aria-valuenow'), '3');
    assert.strictEqual(r1.barEl.getAttribute('aria-valuemax'), '10');
  });
});
