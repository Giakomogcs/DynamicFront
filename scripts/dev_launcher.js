const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const script = isWindows ? path.join('scripts', 'dev.cmd') : path.join('scripts', 'dev.sh');

console.log(`Detected platform: ${process.platform}. Launching ${script}...`);

const child = spawn(script, [], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code);
});
