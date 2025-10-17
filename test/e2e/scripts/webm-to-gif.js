#!/usr/bin/env node
// Convert a webm video to gif using ffmpeg
// Usage: node webm-to-gif.js input.webm output.gif
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const DEFAULTS = {
  fps: 10,
  scale: '960:-1',
  start: 2.4,
  duration: null
};

function parseArgs(argv){
  const opts = { ...DEFAULTS };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) {
      positional.push(raw);
      continue;
    }
    const [flag, valueFromEq] = raw.split('=', 2);
    const next = () => {
      if (valueFromEq !== undefined) return valueFromEq;
      i++;
      return argv[i];
    };
    switch (flag) {
      case '--start': {
        const val = parseFloat(next());
        if (!Number.isNaN(val) && val >= 0) opts.start = val;
        break;
      }
      case '--duration': {
        const val = parseFloat(next());
        if (!Number.isNaN(val) && val > 0) opts.duration = val;
        break;
      }
      case '--fps': {
        const val = parseInt(next(), 10);
        if (!Number.isNaN(val) && val > 0) opts.fps = val;
        break;
      }
      case '--scale': {
        const val = next();
        if (val) opts.scale = val;
        break;
      }
      case '--no-trim': {
        opts.start = 0;
        break;
      }
      case '--help':
      case '-h': {
        printUsage();
        process.exit(0);
        break;
      }
      default:
        console.error('Unknown option:', flag);
        printUsage();
        process.exit(2);
    }
  }
  return { opts, positional };
}

function printUsage(){
  console.error('Usage: node webm-to-gif.js [--start seconds] [--duration seconds] [--fps n] [--scale WxH] [--no-trim] <input.webm> <output.gif>');
  console.error('Defaults: --start 2.4 --fps 10 --scale 960:-1');
}

const { opts, positional } = parseArgs(process.argv.slice(2));
const [input, output] = positional;

if (!input || !output) {
  printUsage();
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error('Input not found:', input);
  process.exit(2);
}

const filters = [`fps=${opts.fps}`, `scale=${opts.scale}:flags=lanczos`];
const args = ['-y'];

if (opts.start && opts.start > 0) {
  args.push('-ss', String(opts.start));
}

args.push('-i', input, '-vf', filters.join(','));

if (opts.duration && opts.duration > 0) {
  args.push('-t', String(opts.duration));
}

args.push('-loop', '0', output);

console.error(`Converting ${input} → ${output} (start=${opts.start}s, fps=${opts.fps}, scale=${opts.scale}${opts.duration ? `, duration=${opts.duration}s` : ''})`);

const child = spawn('ffmpeg', args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code || 0));
