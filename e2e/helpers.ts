import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { isLocalOrigin, resolveBaseUrl } from './base-url';

// Helpers shared by the Playwright specs (prover and verifier). This is not a `*.spec.ts` file, so
// Playwright does not run it as a test. The screen is driven with the keyboard and the PF buttons
// (`data-testid="pf-N"`). The grid rows are `<pre>` lines and row 24 is the `status` role. Samples
// are synthetic and the only data read from the page is what the screen shows.

export const ORIGIN = resolveBaseUrl();
export const PROOF_WAIT_MS = 90_000;
// A cold Verify_Worker: SRS, verification key and WASM start before the first proof check.
export const VERIFY_WAIT_MS = 90_000;

// A request is local when it goes to the configured origin, or is a blob: or data: URL.
function isLocal(url: string): boolean {
  return isLocalOrigin(url, ORIGIN);
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'UNPARSEABLE';
  }
}

// Registers the guard before any navigation. Every non-local request is aborted and its origin
// (scheme, host, port) recorded, so each test can assert that the list is empty (e2e_local_only).
export async function guardLocalOnly(context: BrowserContext): Promise<string[]> {
  const nonLocalOrigins: string[] = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (isLocal(url)) {
      await route.continue();
      return;
    }
    nonLocalOrigins.push(originOf(url));
    await route.abort();
  });
  return nonLocalOrigins;
}

export function statusRow(page: Page) {
  return page.getByRole('status');
}

export async function gridText(page: Page): Promise<string> {
  return (await page.locator('pre').allInnerTexts()).join('\n');
}

export async function press(page: Page, ...keys: string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

// CTM000 -> CTM100 -> select the sample -> CTM200 (SAMPLE LOADED).
export async function loadSample(page: Page, sampleNo: string): Promise<void> {
  await page.goto('/');
  // Wait for the logon screen to be drawn before the first key.
  await expect(page.locator('pre').filter({ hasText: 'PRESS ENTER' }).first()).toBeVisible();
  await press(page, 'Enter');
  await page.keyboard.type(sampleNo);
  await press(page, 'Enter');
  await expect(statusRow(page)).toContainText('SAMPLE LOADED');
}

// CTM200 -> CTM300. The limit field is prefilled with the default policy limit.
export async function openProveScreen(page: Page): Promise<void> {
  await press(page, 'Enter');
  await expect(page.locator('pre').filter({ hasText: 'POLICY LIMIT' }).first()).toBeVisible();
}

function centsOf(amountText: string): bigint {
  return BigInt(amountText.replace('.', ''));
}

export function amountText(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export interface GridPosting {
  readonly index: number; // 0-based row on the page
  readonly side: string;
  readonly cents: bigint;
  readonly flag: string;
}

// Posting rows of CTM200: slot, record id, masked account, side, amount as D.CC, flag.
export function postingRows(text: string): GridPosting[] {
  const rows: GridPosting[] = [];
  for (const line of text.split('\n')) {
    const m = /^\s*\d{1,3}\s+\d+\s+\S+\s+([DC])\s+(\d+\.\d{2})\s+([YN])/.exec(line);
    if (m !== null) {
      rows.push({ index: rows.length, side: m[1] ?? '', cents: centsOf(m[2] ?? ''), flag: m[3] ?? '' });
    }
  }
  return rows;
}

// CTM300 -> F5, then waits for PROOF GENERATED. Returns the text of the verify link that the page
// shows. With `sampleNo` it first runs CTM000 -> CTM200 -> CTM300 for that sample, so a test that
// needs no edit can prove in one call. A test that edits the batch first calls the steps itself.
export async function proveSample(page: Page, sampleNo?: string): Promise<string> {
  if (sampleNo !== undefined) {
    await loadSample(page, sampleNo);
    await openProveScreen(page);
  }
  await press(page, 'F5');
  await expect(statusRow(page)).toContainText('PROOF GENERATED', { timeout: PROOF_WAIT_MS });
  const anchor = page.getByTestId('verify-link');
  await expect(anchor).toBeVisible();
  return (await anchor.getAttribute('href')) ?? '';
}

// Presses PF11 on the prover page and returns the tab that opens. PF11 runs `window.open(href,
// '_blank', 'noopener')`, so the new tab has no handle back to the prover page and the test waits
// on the context. The listener is registered before the click, in the same Promise.all.
export async function openVerifyTab(context: BrowserContext, page: Page): Promise<Page> {
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    page.getByTestId('pf-11').click(), // a real click is a user gesture, so the popup blocker allows it
  ]);
  await tab.waitForLoadState('domcontentloaded');
  await tab.bringToFront(); // the document keydown listener needs the focused tab
  return tab;
}

const STEP_NAMES = ['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF'] as const;

// The six Step_Rows as { FORMAT: 'OK' | 'FAIL' | 'NOT RUN', ... }, parsed from the grid text. A step
// whose row is not drawn is absent from the result.
export async function stepsOf(page: Page): Promise<Record<string, string>> {
  const steps: Record<string, string> = {};
  const pattern = new RegExp(`^\\s*(${STEP_NAMES.join('|')})\\s+(OK|FAIL|NOT RUN)\\b`);
  for (const line of (await gridText(page)).split('\n')) {
    const m = pattern.exec(line);
    if (m !== null && m[1] !== undefined && m[2] !== undefined) steps[m[1]] = m[2];
  }
  return steps;
}

// The Verdict_Row text: the grid line that is exactly VERIFIED, REJECTED AT <STEP> or REJECTED:
// VERIFIER ERROR. The status row holds other text, so it never matches. Null when no row matches.
export async function verdictOf(page: Page): Promise<string | null> {
  for (const line of (await gridText(page)).split('\n')) {
    const m = /^\s*(VERIFIED|REJECTED AT [A-Z_]+|REJECTED: VERIFIER ERROR)\s*$/.exec(line);
    if (m !== null && m[1] !== undefined) return m[1];
  }
  return null;
}

// Computed text and background colors of a body row (1-based) of the grid.
export async function rowColors(page: Page, row: number): Promise<{ color: string; background: string }> {
  return page.locator('.ct-grid pre').nth(row - 1).evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, background: style.backgroundColor };
  });
}

// Asserts that body row `row` has the same computed colors as the title row (row 1), and that
// those colors are the inverse video ones: the text color differs from the row's background.
export async function expectVerdictRowInverse(page: Page, row: number): Promise<void> {
  const title = await rowColors(page, 1);
  const verdict = await rowColors(page, row);
  expect(verdict).toEqual(title);
  expect(verdict.color).not.toBe(verdict.background);
  const plain = await rowColors(page, 2);
  expect(plain).not.toEqual(title);
}

// Clears the CTM900 limit field with the screen's own keys, types the digits and confirms the
// field before the caller presses Enter. The cursor starts at offset 0 and typing overwrites, so
// `Tab` moves the cursor to the end of the field text and Backspace deletes back to empty.
export async function setLimit(page: Page, digits: string): Promise<void> {
  const row = page.locator('pre').filter({ hasText: 'POLICY LIMIT (CENTS)' });
  await press(page, 'Tab');
  for (let i = 0; i < 13; i += 1) await press(page, 'Backspace'); // 13 is the field length
  await expect(row).toHaveText(/POLICY LIMIT \(CENTS\)\s+_{13}\s*$/);
  await page.keyboard.type(digits);
  await expect(row).toHaveText(new RegExp(`POLICY LIMIT \\(CENTS\\)\\s+${digits}_{${13 - digits.length}}\\s*$`));
}
