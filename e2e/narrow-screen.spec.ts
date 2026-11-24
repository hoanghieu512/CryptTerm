import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { guardLocalOnly, proveSample } from './helpers';

// narrow_screen (release Requirement 4). A 375 by 812 viewport, three screens: CTM000, the Prove
// screen after a proof, and the Verify screen. Each one is checked for page width, grid font size,
// the frame as its own scroll container, and the PF bar buttons.

const VIEWPORT_WIDTH = 375;
const MIN_FONT_PX = 11;
const MIN_BUTTON_PX = 24;

// CTM000 defines no PF keys, so `expectPfButtons` is false there and the bar must be empty.
async function expectNarrowLayout(page: Page, expectPfButtons: boolean): Promise<void> {
  // 4.1: the page itself never gets wider than the viewport.
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(VIEWPORT_WIDTH);

  // 4.2: computed grid font size, and the frame scrolls inside itself.
  const fontPx = await page
    .locator('.ct-grid pre')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontPx).toBeGreaterThanOrEqual(MIN_FONT_PX);

  const frame = await page.locator('.ct-frame').evaluate((el) => {
    const before = el.scrollLeft;
    el.scrollLeft = 40;
    const moved = el.scrollLeft;
    el.scrollLeft = before;
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      overflowX: getComputedStyle(el).overflowX,
      moved,
    };
  });
  expect(frame.clientWidth).toBeLessThanOrEqual(VIEWPORT_WIDTH);
  expect(frame.scrollWidth).toBeGreaterThan(frame.clientWidth);
  expect(['auto', 'scroll']).toContain(frame.overflowX);
  expect(frame.moved).toBeGreaterThan(0);

  // 4.3: every PF bar button is inside the viewport and at least 24 by 24.
  const buttons = page.locator('.ct-pf');
  const count = await buttons.count();
  if (expectPfButtons) expect(count).toBeGreaterThan(0);
  else expect(count).toBe(0);
  for (let i = 0; i < count; i += 1) {
    const box = await buttons.nth(i).boundingBox();
    expect(box, `PF BUTTON ${i} HAS NO BOX`).not.toBeNull();
    if (box === null) continue;
    expect(box.x, `PF BUTTON ${i} LEFT`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `PF BUTTON ${i} RIGHT`).toBeLessThanOrEqual(VIEWPORT_WIDTH);
    expect(box.width, `PF BUTTON ${i} WIDTH`).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
    expect(box.height, `PF BUTTON ${i} HEIGHT`).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
  }
}

test.describe('narrow screen', () => {
  test.use({ viewport: { width: VIEWPORT_WIDTH, height: 812 } });

  test('narrow_screen', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);

    // CTM000.
    await page.goto('/');
    await expect(page.locator('pre').filter({ hasText: 'PRESS ENTER' }).first()).toBeVisible();
    await expectNarrowLayout(page, false);

    // Prove screen, after a proof.
    await proveSample(page, '1');
    await expect(page.locator('pre').filter({ hasText: 'PROOF GENERATED' }).first()).toBeVisible();
    await expectNarrowLayout(page, true);

    // The OPEN VERIFIER anchor reads at the grid font size, not a small link font.
    const anchorFontPx = await page
      .getByTestId('verify-link')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(anchorFontPx).toBeGreaterThanOrEqual(MIN_FONT_PX);

    // Verify screen.
    await page.goto('/verify');
    await expect(page.locator('pre').filter({ hasText: /CTM900\s+VERIFY/ }).first()).toBeVisible();
    await expectNarrowLayout(page, true);

    expect(nonLocalOrigins, 'non-local origins').toEqual([]);
  });
});
