import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { headersFor } from './scripts/parse-headers';

// The one copy of the response headers is public/_headers. Reading it here makes the preview
// server (used by the local e2e run) send what Netlify sends. A missing file or a file with no
// `/*` block throws at config load, so dev, preview and build never start without the policy.
const previewHeaders = headersFor('/*', readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    // bb.js uses top-level await.
    target: 'esnext',
  },
  worker: { format: 'es' },
  preview: { headers: previewHeaders },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/zk/proof/**'],
  },
});
