import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'next/link': fileURLToPath(
        new URL('./tests/next-link.tsx', import.meta.url),
      ),
      'next/image': fileURLToPath(
        new URL('./tests/next-image.tsx', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
  },
});
