import { expect, test } from '@playwright/test';
import { ORIGIN, guardLocalOnly } from './helpers';

// Test route_guard_records_foreign_origin (release Requirement 2.7). A foreign request is aborted
// and its origin recorded, and the assertion that every spec ends with then fails with the origin
// in its message. The same-origin /favicon.ico request is not flagged.

const FOREIGN_ORIGIN = 'https://foreign.example.invalid';

test.describe('route guard', () => {
  test('route_guard_records_foreign_origin', async ({ page, context }) => {
    const nonLocalOrigins = await guardLocalOnly(context);

    // The favicon is same-origin, so the guard lets it through and records nothing.
    await page.goto(`${ORIGIN}/favicon.ico`).catch(() => undefined);
    expect(nonLocalOrigins).toEqual([]);

    // A navigation to a foreign origin is aborted and recorded.
    await expect(page.goto(`${FOREIGN_ORIGIN}/path?q=1`)).rejects.toThrow();
    expect(nonLocalOrigins).toEqual([FOREIGN_ORIGIN]);

    // The closing assertion of a spec fails and names the origin.
    let message = '';
    try {
      expect(nonLocalOrigins, 'e2e_local_only: non-local origins').toEqual([]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain(FOREIGN_ORIGIN);
  });
});
