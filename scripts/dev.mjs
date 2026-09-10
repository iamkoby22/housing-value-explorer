import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { pythonRuntime } from './python-runtime.mjs';

const children = [
  spawn(pythonRuntime(), ['inference/valuation_service.py'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }),
  spawn(process.execPath, [resolve('node_modules/vinext/dist/cli.js'), 'dev'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }),
];

let closing = false;

function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.pid || child.killed) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
    } else {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 100).unref();
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`Development process failed to start: ${error.message}`);
    close(1);
  });
  child.on('exit', (code, signal) => {
    if (!closing) {
      console.error(
        `A development process exited (${signal ?? `code ${code ?? 1}`}).`,
      );
      close(code ?? 1);
    }
  });
}

process.on('SIGINT', () => close(0));
process.on('SIGTERM', () => close(0));
