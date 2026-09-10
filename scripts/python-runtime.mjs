import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function pythonRuntime() {
  const configured = process.env.HOUSING_EXPLORER_PYTHON;
  if (configured) return configured;

  if (process.platform === 'win32') {
    const profile = process.env.USERPROFILE;
    const candidates = profile
      ? [
          join(profile, 'anaconda3', 'python.exe'),
          join(profile, 'miniconda3', 'python.exe'),
        ]
      : [];
    const available = candidates.find((candidate) => existsSync(candidate));
    if (available) return available;
    return 'python';
  }

  return 'python3';
}
