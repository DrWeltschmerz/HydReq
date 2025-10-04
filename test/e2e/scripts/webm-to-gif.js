#!/usr/bin/env node
// Convert a webm video to gif using ffmpeg
// Usage: node webm-to-gif.js input.webm output.gif
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const [,, input, output] = process.argv;
if (!input || !output) {
  console.error('Usage: node webm-to-gif.js <input.webm> <output.gif>');
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error('Input not found:', input);
  process.exit(2);
}
const args = [
  '-y',
  '-i', input,
  '-vf', 'fps=10,scale=960:-1:flags=lanczos',
  '-loop', '0',
  output
];
const p = spawn('ffmpeg', args, { stdio: 'inherit' });
p.on('exit', (code)=> process.exit(code||0));
