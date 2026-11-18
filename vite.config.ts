import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    // bb.js (added in the spike) uses top-level await.
    target: 'esnext',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
