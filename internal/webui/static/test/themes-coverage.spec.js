const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Ensure each theme defines all variables required by the UI/editor
// Variables expected by editor/layout/styles and CodeMirror overrides
const REQUIRED_VARS = [
  '--hdr-bg','--hdr-fg','--bd','--li-hov','--li-sel','--pill','--pg-bg','--txt','--bg',
  '--btn-bg','--btn-bd','--btn-hov','--link',
  '--input-bg','--input-bd','--input-fg','--input-focus',
  '--success','--error','--warning','--info',
  '--grad1','--grad2'
];

// Themes directory
const THEMES_DIR = path.join(__dirname, '..', 'themes');

function parseVars(css){
  const out = new Set();
  const re = /--[a-zA-Z0-9\-]+\s*:/g;
  let m;
  while ((m = re.exec(css)) !== null){
    const name = m[0].replace(/:/,'').trim();
    out.add(name);
  }
  return out;
}

describe('themes coverage', function(){
  it('every theme defines required variables', function(){
    const files = fs.readdirSync(THEMES_DIR).filter(f=> f.endsWith('.css'));
    assert.ok(files.length > 0, 'no theme files found');
    const problems = [];
    for (const file of files){
      const css = fs.readFileSync(path.join(THEMES_DIR, file), 'utf8');
      const vars = parseVars(css);
      const missing = REQUIRED_VARS.filter(v=> !vars.has(v));
      if (missing.length){
        problems.push({ file, missing });
      }
    }
    if (problems.length){
      const msg = problems.map(p=> `${p.file}: missing ${p.missing.join(', ')}`).join('\n');
      assert.fail('Theme variables missing:\n' + msg);
    }
  });
});
