import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { formatCents } from '../../src/ui/model/amount-input';
import { runProperty } from '../support/pbt';

// Feature: terminal-ui, Property 12: Formatted cents convert back to the same amount
// **Validates: Requirements 4.4**
//
// Seed 20264012, 200 runs. Amounts 0 to 2^40 - 1, plus any non-negative bigint (totals can pass
// 2^40). The text is `<whole>.<two digits>`. Removing the dot and reading it with BigInt gives
// the amount back. Only integer arithmetic and string handling are used on the way out.

const FORMAT_PATTERN = /^(0|[1-9][0-9]*)\.[0-9]{2}$/;

const amountArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom<bigint>(0n, 1n, 9n, 10n, 99n, 100n, 101n, AMOUNT_BOUND_CENTS - 1n) },
  { weight: 4, arbitrary: fc.bigInt({ min: 0n, max: AMOUNT_BOUND_CENTS - 1n }) },
  { weight: 2, arbitrary: fc.bigInt({ min: 0n, max: 2n ** 80n }) },
);

describe('format_cents_roundtrip', () => {
  it('format_cents_roundtrip: matches the pattern and converts back to the same bigint', () => {
    runProperty('format_cents_roundtrip', { seed: 20264012, numRuns: 200 }, fc.property(amountArb, (cents) => {
      const text = formatCents(cents);
      expect(text).toMatch(FORMAT_PATTERN);
      expect(BigInt(text.replace('.', ''))).toBe(cents);
    }));
  });

  it.each([
    [0n, '0.00'],
    [5n, '0.05'],
    [99n, '0.99'],
    [100n, '1.00'],
    [1234n, '12.34'],
    [1_000_000n, '10000.00'],
    [AMOUNT_BOUND_CENTS - 1n, '10995116277.75'],
  ] as const)('format_cents_roundtrip: example %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it('format_cents_roundtrip: a value near 2^53 keeps every digit', () => {
    expect(formatCents(2n ** 53n + 1n)).toBe('90071992547409.93');
  });

  it('format_cents_roundtrip: a negative or non-bigint value gives INVALID', () => {
    expect(formatCents(-1n)).toBe('INVALID');
    expect(formatCents(-100n)).toBe('INVALID');
    for (const value of [12, 12.5, '12', null, undefined]) {
      // The cast is the point: the display function must fail closed on any runtime value.
      expect(formatCents(value as unknown as bigint)).toBe('INVALID');
    }
  });
});
