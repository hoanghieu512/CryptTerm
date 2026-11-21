import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FLAG_NO, SIDE_CREDIT, SIDE_DEBIT } from '../../src/ledger/posting';
import { generateBatch } from '../../src/ledger/generate';
import { LIMIT_CENTS, checkInvariants } from '../../src/ledger/invariants';
import { runProperty } from '../support/pbt';
import { at, batchIdArb } from '../support/ledger-arbitraries';

// Feature: ledger-format, Property violating_kinds_break_exactly_one_invariant: For all seeds and counts, an overLimitUnflagged batch fails only limit-or-flag and an unbalanced batch fails only balance
// **Validates: Requirements 4.1, 4.4, 4.5**
//
// Seed 20262006, 200 runs. Kinds overLimitUnflagged and unbalanced with counts 2 to 64.
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262006;
const NUM_RUNS = 200;

type GenerateOptions = Parameters<typeof generateBatch>[0];
type ViolatingKind = 'overLimitUnflagged' | 'unbalanced';

const seedArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 1_000_000 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1, 2 ** 32 - 1, 2 ** 32, Number.MAX_SAFE_INTEGER) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }) },
);

const countArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom(2, 3, 4, 5, 63, 64) },
  { weight: 4, arbitrary: fc.integer({ min: 2, max: 64 }) },
);

const optsArb: fc.Arbitrary<GenerateOptions & { readonly kind: ViolatingKind }> = fc
  .tuple(fc.constantFrom<ViolatingKind>('overLimitUnflagged', 'unbalanced'), seedArb, countArb, batchIdArb)
  .map(([kind, seed, count, batchId]) => ({ kind, seed, count, batchId }));

describe('violating_kinds_break_exactly_one_invariant', () => {
  it('violating_kinds_break_exactly_one_invariant: overLimitUnflagged fails only limit-or-flag and unbalanced fails only balance', () => {
    runProperty(
      'ledger-format violating_kinds_break_exactly_one_invariant',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(optsArb, (opts) => {
        const batch = generateBatch(opts);
        const result = checkInvariants(batch);
        expect(batch.postings.length).toBe(opts.count);

        if (opts.kind === 'overLimitUnflagged') {
          // Only limit-or-flag fails.
          expect(result).toStrictEqual({ balanced: true, withinLimitOrFlagged: false, inRange: true });
          // Exactly one posting is over the limit with flag N, and it is slot 0.
          const offenders = batch.postings
            .map((p, slot) => ({ p, slot }))
            .filter(({ p }) => p.amountCents > LIMIT_CENTS && p.reviewFlag === FLAG_NO);
          expect(offenders.length).toBe(1);
          expect(at(offenders, 0).slot).toBe(0);
        } else {
          // Only balance fails, and credits exceed debits by exactly 1 cent.
          expect(result).toStrictEqual({ balanced: false, withinLimitOrFlagged: true, inRange: true });
          let debitCents = 0n;
          let creditCents = 0n;
          for (const p of batch.postings) {
            if (p.side === SIDE_DEBIT) debitCents += p.amountCents;
            if (p.side === SIDE_CREDIT) creditCents += p.amountCents;
          }
          expect(creditCents - debitCents).toBe(1n);
        }
      }),
    );
  });

  it('violating_kinds_break_exactly_one_invariant: the smallest batches (count 2) still break exactly one invariant', () => {
    const over = generateBatch({ kind: 'overLimitUnflagged', seed: 1002, count: 2, batchId: 'CTB-20261201-002' });
    expect(checkInvariants(over)).toStrictEqual({ balanced: true, withinLimitOrFlagged: false, inRange: true });

    const unbalanced = generateBatch({ kind: 'unbalanced', seed: 1003, count: 2, batchId: 'CTB-20261201-003' });
    expect(checkInvariants(unbalanced)).toStrictEqual({ balanced: false, withinLimitOrFlagged: true, inRange: true });
  });
});
