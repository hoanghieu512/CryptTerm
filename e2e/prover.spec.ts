import { expect, test } from '@playwright/test';
import { decodeBundle } from '../src/zk/bundle';
import {
  PROOF_WAIT_MS,
  amountText,
  expectVerdictRowInverse,
  gridText,
  guardLocalOnly,
  loadSample,
  openProveScreen,
  postingRows,
  press,
  statusRow,
} from './helpers';
import type { GridPosting } from './helpers';

// Prover e2e (terminal-ui Requirement 10, design section J). Runs against the production build
// that `vite preview` serves on loopback. The shared helpers live in `./helpers`. The screen is
// driven with the keyboard and the PF buttons (`data-testid="pf-N"`). Samples are synthetic and the
// only data read from the page is what the screen shows.

const LIMIT_CENTS = 1_000_000n; // the default policy limit, in cents
const LINK_PREFIX = '/verify#b=';

test.describe('prover', () => {
  test('prover_clean_to_link', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);
    await loadSample(page, '1');
    await openProveScreen(page);
    await press(page, 'F5');
    await expect(statusRow(page)).toContainText('PROOF GENERATED', { timeout: PROOF_WAIT_MS });

    const anchor = page.getByTestId('verify-link');
    await expect(anchor).toBeVisible();
    const link = (await anchor.getAttribute('href')) ?? '';
    expect(link.startsWith(LINK_PREFIX)).toBe(true);
    expect(((await anchor.textContent()) ?? '').trim()).toBe('OPEN VERIFIER');
    // The anchor is the only element with an href, and the full link is shown nowhere as text.
    await expect(page.locator('a[href]')).toHaveCount(1);
    await expect(page.locator('a[href]').first()).toHaveAttribute('data-testid', 'verify-link');
    expect(await page.locator('body').innerText()).not.toContain(link);
    const bundle = decodeBundle(link.slice(LINK_PREFIX.length));
    expect(bundle.limitCents).toBe(LIMIT_CENTS);
    expect(bundle.recordCount).toBe(12);
    expect(await statusRow(page).textContent()).not.toContain('VERIFIED');
    // Verdict_Row of CTM300 (body row 8) has the colors of the title row.
    await expect(page.locator('.ct-grid pre').nth(7)).toHaveText('PROOF GENERATED');
    await expectVerdictRowInverse(page, 8);

    // The same on CTM900: open the link, verify, and compare the verdict row (body row 17).
    await page.goto(link);
    await expect(page.locator('pre').filter({ hasText: /CTM900\s+VERIFY/ }).first()).toBeVisible();
    await press(page, 'Enter');
    await expect(page.locator('.ct-grid pre').nth(16)).toHaveText('VERIFIED', { timeout: PROOF_WAIT_MS });
    await expectVerdictRowInverse(page, 17);

    expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
  });

  test('prover_unbalanced_no_worker', async ({ page, context }) => {
    const nonLocalOrigins = await guardLocalOnly(context);
    let workers = 0;
    page.on('worker', () => {
      workers += 1;
    });
    await loadSample(page, '3');
    await openProveScreen(page);
    await press(page, 'F5');
    await expect(statusRow(page)).toContainText('REJECTED: UNBALANCED');
    await expect(page.locator('.ct-grid pre').nth(8)).toHaveText('REJECTED: UNBALANCED');
    await expectVerdictRowInverse(page, 9);
    expect(workers).toBe(0);
    await expect(page.getByTestId('verify-link')).toHaveCount(0);

    expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
  });

  test('prover_f5_no_reload', async ({ page, context }) => {
    const nonLocalOrigins = await guardLocalOnly(context);
    // The unbalanced sample is rejected on the page, so no proof runs.
    await loadSample(page, '3');
    await openProveScreen(page);
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: string }).__noReloadMarker = 'SET';
    });
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });
    await press(page, 'F5');
    await expect(statusRow(page)).toContainText('REJECTED: UNBALANCED');
    const marker = await page.evaluate(() => (window as unknown as { __noReloadMarker?: string }).__noReloadMarker);
    expect(marker).toBe('SET');
    expect(navigations).toBe(0);

    expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
  });

  test('prover_move_cent_makes_bundle', async ({ page, context }) => {
    const nonLocalOrigins = await guardLocalOnly(context);
    await loadSample(page, '1');

    // Two debit postings: one gives up 1 cent, the other takes it. The totals stay equal. The
    // receiver stays within the limit, or carries the review flag, so the proof still exists.
    const rows = postingRows(await gridText(page));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const giver = rows.find((r) => r.side === 'D' && r.cents >= 1n);
    const receiver = rows.find(
      (r) => r.side === 'D' && r !== giver && (r.cents + 1n <= LIMIT_CENTS || r.flag === 'Y'),
    );
    if (giver === undefined || receiver === undefined) throw new Error('NO SAME-SIDE PAIR ON PAGE 1');
    const first = giver.index < receiver.index ? giver : receiver;
    const second = first === giver ? receiver : giver;
    const newCents = (r: GridPosting): bigint => (r === giver ? r.cents - 1n : r.cents + 1n);

    await page.getByTestId('pf-12').click();
    await expect(statusRow(page)).toContainText('TAMPER MODE ON');
    // The cursor starts in the first amount field. Tab moves down one posting row per press.
    for (let i = 0; i < first.index; i += 1) await press(page, 'Tab');
    await page.keyboard.type(newCents(first).toString());
    for (let i = first.index; i < second.index; i += 1) await press(page, 'Tab');
    await page.keyboard.type(newCents(second).toString());
    await press(page, 'Enter');
    await expect(statusRow(page)).toContainText('AMOUNTS UPDATED');
    await expect(statusRow(page)).toContainText('TAMPERED');
    const edited = await gridText(page);
    expect(edited).toContain(amountText(newCents(giver)));
    expect(edited).toContain(amountText(newCents(receiver)));

    await page.getByTestId('pf-12').click();
    await expect(statusRow(page)).toContainText('TAMPER MODE OFF');
    await openProveScreen(page);
    await press(page, 'F5');
    await expect(statusRow(page)).toContainText('PROOF GENERATED', { timeout: PROOF_WAIT_MS });
    await expect(statusRow(page)).toContainText('TAMPERED');

    const link = (await page.getByTestId('verify-link').getAttribute('href')) ?? '';
    expect(link.startsWith(LINK_PREFIX)).toBe(true);
    decodeBundle(link.slice(LINK_PREFIX.length));

    expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
  });
});
