import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import fc from 'fast-check';
import { encodeBundleForUrl } from '../src/zk/bundle';
import { CIRCUIT_VERSION } from '../src/zk/circuit-identity';
import { proofBundleArb } from '../tests/support/bundle-arbitraries';
import {
  ORIGIN,
  VERIFY_WAIT_MS,
  amountText,
  gridText,
  guardLocalOnly,
  loadSample,
  openProveScreen,
  openVerifyTab,
  postingRows,
  press,
  proveSample,
  setLimit,
  statusRow,
  stepsOf,
  verdictOf,
} from './helpers';
import type { GridPosting } from './helpers';

// Verifier e2e (verifier Requirement 7, design "E2E design"). Runs against the production build
// that `vite preview` serves on loopback. Every test registers the Local_Guard on the context before
// any navigation (the context also covers the tab that PF11 opens) and ends with the
// `verifier_local_only` assertion. Samples are synthetic and the only data read from the page is
// what the screen shows.

const LIMIT_CENTS = 1_000_000n; // the default policy limit, in cents
const LINK_PREFIX = '/verify#b=';
const SIX = ['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF'] as const;

async function expectVerifyScreen(page: Page, source: 'LINK' | 'NONE'): Promise<void> {
  await expect(page.locator('pre').filter({ hasText: /CTM900\s+VERIFY/ }).first()).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: new RegExp(`BUNDLE SOURCE\\s+${source}`) }).first()).toBeVisible();
}

// Moves 1 cent between two debit postings of the loaded sample, in tamper mode, then leaves tamper
// mode and opens CTM300. The totals stay equal, and the receiver stays within the limit or carries
// the review flag, so a proof still exists. This is the video case.
async function moveOneCentBetweenDebits(page: Page): Promise<void> {
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
  const edited = await gridText(page);
  expect(edited).toContain(amountText(newCents(giver)));
  expect(edited).toContain(amountText(newCents(receiver)));

  await page.getByTestId('pf-12').click();
  await expect(statusRow(page)).toContainText('TAMPER MODE OFF');
  await openProveScreen(page);
}

test.describe('verifier', () => {
  test('verifier_clean_verified', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);
    await loadSample(page, '1');
    await openProveScreen(page);
    const link = await proveSample(page);
    expect(link.startsWith(LINK_PREFIX)).toBe(true);
    const proverUrl = page.url();

    const tab = await openVerifyTab(context, page);
    // The link opened in a new tab, and the prover page stayed where it was.
    expect(new URL(tab.url()).pathname).toBe('/verify');
    expect(tab.url()).toBe(ORIGIN + link);
    expect(page.url()).toBe(proverUrl);
    await expect(page.locator('pre').filter({ hasText: 'CTM300' }).first()).toBeVisible();
    await expect(statusRow(page)).toContainText('OPENING VERIFIER');

    await expectVerifyScreen(tab, 'LINK');
    await press(tab, 'Enter');
    await expect.poll(() => verdictOf(tab), { timeout: VERIFY_WAIT_MS }).toBe('VERIFIED');
    const steps = await stepsOf(tab);
    for (const name of SIX) expect(steps[name], name).toBe('OK');
    const text = await gridText(tab);
    expect(text).toMatch(/SOURCE KEY\s+DEMO-/);
    expect(text).toContain('DEMO KEY');
    expect(text).toContain(CIRCUIT_VERSION);
    // The encoded bundle is never drawn.
    expect(text.includes(link.slice(LINK_PREFIX.length, LINK_PREFIX.length + 40))).toBe(false);

    expect(nonLocalOrigins, 'verifier_local_only: non-local origins').toEqual([]);
  });

  test('verifier_policy_500000', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);
    await loadSample(page, '1');
    await openProveScreen(page);
    await proveSample(page);

    const tab = await openVerifyTab(context, page);
    await expectVerifyScreen(tab, 'LINK');
    await setLimit(tab, '500000');
    await press(tab, 'Enter');
    // The run stops at POLICY, before the proof check, so it is fast.
    await expect.poll(() => verdictOf(tab), { timeout: VERIFY_WAIT_MS }).toBe('REJECTED AT POLICY');
    expect(await stepsOf(tab)).toEqual({
      FORMAT: 'OK',
      SIGNATURE: 'OK',
      DIGEST_MATCH: 'OK',
      POLICY: 'FAIL',
      CIRCUIT: 'NOT RUN',
      PROOF: 'NOT RUN',
    });

    expect(nonLocalOrigins, 'verifier_local_only: non-local origins').toEqual([]);
  });

  test('verifier_move_cent_digest_match', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);
    await loadSample(page, '1');
    await moveOneCentBetweenDebits(page);
    await proveSample(page);
    await expect(statusRow(page)).toContainText('TAMPERED');

    const tab = await openVerifyTab(context, page);
    await expectVerifyScreen(tab, 'LINK');
    await press(tab, 'Enter');
    await expect.poll(() => verdictOf(tab), { timeout: VERIFY_WAIT_MS }).toBe('REJECTED AT DIGEST_MATCH');
    expect(await stepsOf(tab)).toEqual({
      FORMAT: 'OK',
      SIGNATURE: 'OK',
      DIGEST_MATCH: 'FAIL',
      POLICY: 'NOT RUN',
      CIRCUIT: 'NOT RUN',
      PROOF: 'NOT RUN',
    });

    expect(nonLocalOrigins, 'verifier_local_only: non-local origins').toEqual([]);
  });

  test('verifier_truncated_format', async ({ page, context }) => {
    const nonLocalOrigins = await guardLocalOnly(context);
    const fixture = fc.sample(proofBundleArb, { seed: 20264701, numRuns: 1 })[0];
    if (fixture === undefined) throw new Error('FIXTURE: NO BUNDLE');
    const encoded = encodeBundleForUrl(fixture);
    expect(encoded.length).toBeGreaterThan(200);
    const cut = encoded.slice(0, 200);

    await page.goto(`/verify#b=${cut}`);
    await expectVerifyScreen(page, 'LINK');
    await press(page, 'Enter');
    await expect.poll(() => verdictOf(page), { timeout: 15_000 }).toBe('REJECTED AT FORMAT');
    expect(await stepsOf(page)).toEqual({
      FORMAT: 'FAIL',
      SIGNATURE: 'NOT RUN',
      DIGEST_MATCH: 'NOT RUN',
      POLICY: 'NOT RUN',
      CIRCUIT: 'NOT RUN',
      PROOF: 'NOT RUN',
    });

    expect(nonLocalOrigins, 'verifier_local_only: non-local origins').toEqual([]);
  });

  test('verifier_direct_visit', async ({ page, context }) => {
    const nonLocalOrigins = await guardLocalOnly(context);
    await page.goto('/verify');
    await expectVerifyScreen(page, 'NONE');
    expect(await gridText(page)).not.toContain('VERIFIED');

    await page.reload();
    await expectVerifyScreen(page, 'NONE');
    expect(await gridText(page)).not.toContain('VERIFIED');

    expect(nonLocalOrigins, 'verifier_local_only: non-local origins').toEqual([]);
  });
});
