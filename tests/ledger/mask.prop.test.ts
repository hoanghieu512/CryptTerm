import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ID_MAX } from '../../src/ledger/field';
import { MASK_CHAR, MASK_WIDTH, VISIBLE_DIGITS, maskAccount } from '../../src/ledger/mask';
import { runProperty } from '../support/pbt';

// Feature: terminal-ui, Property 8: A masked account shows only its last four digits
// **Validates: Requirements 4.1**
//
// Seed 20264008, 200 runs. The expected text is built here from literals: 16 'X' characters
// followed by the last 4 digits of the 20-digit zero-padded decimal form. Out-of-range values and
// non-bigint values give 20 mask characters and never throw.

const ALL_MASKED = 'X'.repeat(20);

/** Reference: 16 mask characters, then the last 4 digits of the zero-padded 20-digit form. */
function expectedMask(account: bigint): string {
  return `${'X'.repeat(16)}${account.toString().padStart(20, '0').slice(-4)}`;
}

/** Accounts 0 to ID_MAX, small values (leading zeros hidden) and both ends boosted. */
const accountArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom<bigint>(0n, 1n, 9999n, 10000n, ID_MAX - 1n, ID_MAX) },
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: 99_999n }) },
  { weight: 5, arbitrary: fc.bigInt({ min: 0n, max: ID_MAX }) },
);

/** Bigints outside 0 .. ID_MAX. */
const outOfRangeArb: fc.Arbitrary<bigint> = fc.oneof(
  fc.constantFrom<bigint>(-1n, ID_MAX + 1n, 2n ** 64n, 2n ** 128n),
  fc.bigInt({ min: ID_MAX + 1n, max: 2n ** 200n }),
  fc.bigInt({ min: -(2n ** 200n), max: -1n }),
);

describe('mask_account', () => {
  it('mask_account: constants match the column layout', () => {
    expect(MASK_CHAR).toBe('X');
    expect(MASK_WIDTH).toBe(20);
    expect(VISIBLE_DIGITS).toBe(4);
  });

  it('mask_account: 16 mask characters then the last 4 digits, for any account in range', () => {
    runProperty('mask_account', { seed: 20264008, numRuns: 200 }, fc.property(accountArb, (account) => {
      const masked = maskAccount(account);
      expect(masked).toHaveLength(20);
      expect(masked.slice(0, 16)).toBe('X'.repeat(16));
      expect(masked.slice(16)).toBe(account.toString().padStart(20, '0').slice(-4));
      expect(masked).toBe(expectedMask(account));
    }));
  });

  it('mask_account: an out-of-range bigint gives 20 mask characters and does not throw', () => {
    runProperty('mask_account out of range', { seed: 20264008, numRuns: 200 }, fc.property(outOfRangeArb, (account) => {
      expect(maskAccount(account)).toBe(ALL_MASKED);
    }));
  });

  it('mask_account: a non-bigint gives 20 mask characters and does not throw', () => {
    const values: readonly unknown[] = [7, 7.5, NaN, '7', '0000000000000000007', null, undefined, {}, [], true];
    for (const value of values) {
      // The cast is the point of the test: the function must fail closed on any runtime value.
      expect(maskAccount(value as bigint)).toBe(ALL_MASKED);
    }
  });

  it.each([
    [0n, 'XXXXXXXXXXXXXXXX0000'],
    [7n, 'XXXXXXXXXXXXXXXX0007'],
    [9999n, 'XXXXXXXXXXXXXXXX9999'],
    [10000n, 'XXXXXXXXXXXXXXXX0000'],
    [ID_MAX, 'XXXXXXXXXXXXXXXX1615'],
  ] as const)('mask_account: example %s', (account, expected) => {
    expect(maskAccount(account)).toBe(expected);
  });

  it('mask_account: the full 20-digit form and any 5-digit tail never appear for accounts of 5 or more digits', () => {
    const account = 918273645n;
    const masked = maskAccount(account);
    expect(masked).not.toContain('918273645');
    expect(masked).not.toContain('73645');
    expect(masked).toBe('XXXXXXXXXXXXXXXX3645');
  });
});
