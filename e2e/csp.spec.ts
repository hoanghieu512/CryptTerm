import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { isBadgeFrameCspError, unexpectedConsoleErrors } from './csp-filter';
import type { ConsoleErrorRecord, FrameInfo } from './csp-filter';
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
    // Console errors are recorded with their source URL and page. Each one is checked against the
    // frame that produced it at the end of the run (see csp-filter.ts).
    const consoleRecords: ConsoleErrorRecord[] = [];
    const pageErrors: string[] = [];
    const faviconRequests: string[] = [];
    const watch = (p: Page): void => {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleRecords.push({ page: p, sourceUrl: msg.location().url, text: msg.text() });
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
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
    const consoleErrors = [...(await unexpectedConsoleErrors(consoleRecords)), ...pageErrors];
    expect(consoleErrors, 'csp_no_violation: console errors').toEqual([]);
    expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
  });
});

// Checks of the badge filter. The first six need no network and no app page.
const CSP_STYLE = "Applying inline style violates the following Content Security Policy directive 'style-src 'self''.";
const MAIN: FrameInfo = { url: 'https://example.test/', elementId: null };
const BADGE: FrameInfo = { url: 'about:srcdoc', elementId: 'nl-badge-frame' };
const OTHER: FrameInfo = { url: 'about:srcdoc', elementId: 'other-frame' };
test.describe('csp badge filter', () => {
  test('ignores a CSP error from the nl-badge-frame', () => {
    expect(isBadgeFrameCspError('about:srcdoc', CSP_STYLE, [MAIN, BADGE])).toBe(true);
  });
  test('keeps a CSP error from the main frame', () => {
    expect(isBadgeFrameCspError(MAIN.url, CSP_STYLE, [MAIN, BADGE])).toBe(false);
  });
  test('keeps a CSP error from a srcdoc frame with another id', () => {
    expect(isBadgeFrameCspError('about:srcdoc', CSP_STYLE, [MAIN, OTHER])).toBe(false);
  });
  test('keeps an ambiguous srcdoc source shared with another frame', () => {
    expect(isBadgeFrameCspError('about:srcdoc', CSP_STYLE, [MAIN, BADGE, OTHER])).toBe(false);
  });
  test('keeps a non-CSP error from the badge frame', () => {
    expect(isBadgeFrameCspError('about:srcdoc', 'Uncaught TypeError: x is undefined', [MAIN, BADGE])).toBe(false);
  });
  test('keeps an error when no frame matches', () => {
    expect(isBadgeFrameCspError('about:srcdoc', CSP_STYLE, [])).toBe(false);
  });
  // Real browser: confirms that Chromium reports about:srcdoc for a srcdoc frame and that the
  // frame id lookup separates the badge frame from another srcdoc frame.
  test('in a browser, only the nl-badge-frame error is dropped', async ({ page }) => {
    const records: ConsoleErrorRecord[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') records.push({ page, sourceUrl: msg.location().url, text: msg.text() });
    });
    const frameHtml = (id: string, label: string): string =>
      `<iframe id="${id}" srcdoc="<script>console.error('Content Security Policy ${label}')</script>"></iframe>`;
    await page.setContent(
      `${frameHtml('nl-badge-frame', 'BADGE')}<script>console.error('Content Security Policy MAIN')</script>`,
    );
    await expect.poll(() => records.length).toBe(2);
    expect(await unexpectedConsoleErrors(records)).toEqual(['Content Security Policy MAIN']);
    records.length = 0;
    await page.setContent(`${frameHtml('nl-badge-frame', 'BADGE')}${frameHtml('other-frame', 'OTHER')}`);
    await expect.poll(() => records.length).toBe(2);
    expect((await unexpectedConsoleErrors(records)).length).toBe(2);
  });
});

