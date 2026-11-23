import { existsSync } from 'node:fs';
import { chromium, defineConfig, devices } from '@playwright/test';

// Prover e2e setup (terminal-ui design section J). The browser is the Chromium that is already in
// the Playwright cache. Nothing here downloads a browser: if it is missing, stop and ask.
if (!existsSync(chromium.executablePath())) {
  throw new Error('CHROMIUM NOT CACHED: STOP AND ASK');
}

const ORIGIN = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        baseURL: ORIGIN,
        // context.route does not see service-worker traffic, so none is allowed.
        serviceWorkers: 'block',
      },
    },
  ],
  // The built app, served by vite preview on loopback. No COOP/COEP header is set anywhere.
  webServer: {
    command: 'npm run build && npm run preview:e2e',
    url: `${ORIGIN}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
