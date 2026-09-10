import { spawn } from 'node:child_process';

import { pythonRuntime } from './python-runtime.mjs';

const child = spawn(pythonRuntime(), process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Unable to start Python: ${error.message}`);
  process.exit(1);
});
