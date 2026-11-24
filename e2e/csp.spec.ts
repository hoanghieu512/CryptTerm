import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  VERIFY_WAIT_MS,
  guardLocalOnly,
  loadSample,
  openProveScreen,
  openVerifyTab,
  press,
  proveSample,
  verdictOf,
} from './helpers';

// Tests csp_no_violation (release Requirement 2.6) and the observation of img_src_decision
// (Requirement 2.3). The listeners are registered before any navigation. The context init script
// covers the prover page and the tab that PF11 opens. Samples are synthetic and nothing here
// prints page content.

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

async function violationsOf(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__cspViolations ?? []);
}

test.describe('csp', () => {
  test('csp_no_violation', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);
    await context.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__cspViolations?.push(`${event.effectiveDirective} ${event.blockedURI}`);
      });
    });
    const consoleErrors: string[] = [];
    const faviconRequests: string[] = [];
    const watch = (p: Page): void => {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => consoleErrors.push(err.message));
      p.on('request', (req) => {
        if (new URL(req.url()).pathname === '/favicon.ico') faviconRequests.push(req.url());
      });
    };
    watch(page);
    context.on('page', watch);

    // The judge path: load the clean sample, prove it, open the verifier, see VERIFIED.
    await loadSample(page, '1');
    await openProveScreen(page);
    await proveSample(page);
    const tab = await openVerifyTab(context, page);
    await press(tab, 'Enter');
    await expect.poll(() => verdictOf(tab), { timeout: VERIFY_WAIT_MS }).toBe('VERIFIED');

    const violations = [...(await violationsOf(page)), ...(await violationsOf(tab))];
    // img_src_decision: record what the browser did about /favicon.ico (see the design note).
    process.stdout.write(`FAVICON REQUESTS SEEN: ${faviconRequests.length}\n`);
    expect(violations, 'csp_no_violation: securitypolicyviolation events').toEqual([]);
    expect(consoleErrors, 'csp_no_violation: console errors').toEqual([]);
    expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
  });
});
