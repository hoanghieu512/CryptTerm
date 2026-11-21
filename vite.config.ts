import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

// Spike build only (vite build --mode spike): the spike page is the only HTML entry, so
// Netlify gets its own _redirects that serves it at the site root. The default build keeps
// public/_redirects, which is not copied in spike mode (publicDir is false there).
function spikeRedirects(): Plugin {
  return {
    name: 'spike-redirects',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_redirects',
        source: '/  /spike.html  200\n',
      });
    },
  };
}

const spikeInput = 'spike.html';

export default defineConfig(({ mode }) => {
  const spike = mode === 'spike';
  return {
    plugins: spike ? [spikeRedirects()] : [react()],
    publicDir: spike ? false : 'public',
    build: {
      // bb.js uses top-level await.
      target: 'esnext',
      rolldownOptions: spike ? { input: spikeInput } : {},
    },
    worker: { format: 'es' },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: [...configDefaults.exclude, 'tests/zk/proof/**'],
    },
  };
});
