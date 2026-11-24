import { expect, test } from '@playwright/test';
import { guardLocalOnly, proveSample } from './helpers';

// After a proof on CTM300 at 1280 by 860, the OPEN VERIFIER anchor is inside the viewport without
// any page scroll. The check reads the bounding box, so it does not depend on timing.

test.describe('verify anchor', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('verify_anchor_in_viewport', async ({ page, context }) => {
    test.setTimeout(240_000);
    const nonLocalOrigins = await guardLocalOnly(context);
    await proveSample(page, '1');

    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const box = await page.getByTestId('verify-link').boundingBox();
    expect(box, 'OPEN VERIFIER HAS NO BOX').not.toBeNull();
    if (box === null) return;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(860);

    expect(nonLocalOrigins, 'non-local origins').toEqual([]);
  });
});
