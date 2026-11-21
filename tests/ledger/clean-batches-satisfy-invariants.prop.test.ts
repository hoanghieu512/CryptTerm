import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FLAG_NO, FLAG_YES } from '../../src/ledger/posting';
import { generateBatch } from '../../src/ledger/generate';
import { LIMIT_CENTS, checkInvariants } from '../../src/ledger/invariants';
import { parseBatch } from '../../src/ledger/parse';
import { serializeBatch } from '../../src/ledger/serialize';
import { runProperty } from '../support/pbt';
import { at, batchIdArb } from '../support/ledger-arbitraries';

// Feature: ledger-format, Property clean_batches_satisfy_invariants: For all seeds and counts, clean and large batches satisfy balance, limit-or-flag and range, and large has exactly 64 postings
// **Validates: Requirements 4.1, 4.3, 4.6**
//
// Seed 20262005, 200 runs. Kind clean with counts 2 to 64 and kind large with count 64.
// Besides the three invariant results the test checks the shape the design fixes: round trip
// through the codec, count equals postings length, recordId = 100000 + slot, 12-digit accounts,
// flag Y exactly on postings above the limit, and the always-over-limit group 1.
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262005;
const NUM_RUNS = 200;

const FIRST_RECORD_ID = 100000n;
const ACCOUNT_MIN = 100000000000n; // 12 digits
const ACCOUNT_MAX = 999999999999n;

type GenerateOptions = Parameters<typeof generateBatch>[0];

const seedArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 1_000_000 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1, 2 ** 32 - 1, 2 ** 32, Number.MAX_SAFE_INTEGER) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }) },
);

const cleanCountArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom(2, 3, 4, 5, 6, 7, 63, 64) },
  { weight: 4, arbitrary: fc.integer({ min: 2, max: 64 }) },
);

/** Clean batches with counts 2 to 64, and large batches with count 64. */
const optsArb: fc.Arbitrary<GenerateOptions> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc
      .tuple(seedArb, cleanCountArb, batchIdArb)
      .map(([seed, count, batchId]): GenerateOptions => ({ kind: 'clean', seed, count, batchId })),
  },
  {
    weight: 1,
    arbitrary: fc
      .tuple(seedArb, batchIdArb)
      .map(([seed, batchId]): GenerateOptions => ({ kind: 'large', seed, count: 64, batchId })),
  },
);

describe('clean_batches_satisfy_invariants', () => {
  it('clean_batches_satisfy_invariants: clean and large batches balance, respect the limit rule and stay in range', () => {
    runProperty(
      'ledger-format clean_batches_satisfy_invariants',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(optsArb, (opts) => {
        const batch = generateBatch(opts);

        // The three invariant results (Requirement 4.3, 4.6).
        expect(checkInvariants(batch)).toStrictEqual({
          balanced: true,
          withinLimitOrFlagged: true,
          inRange: true,
        });

        // Count and id.
        expect(batch.batchId).toBe(opts.batchId);
        expect(batch.postings.length).toBe(opts.count);
        if (opts.kind === 'large') expect(batch.postings.length).toBe(64);

        // The batch is a valid Batch_File: it serializes and parses back unchanged.
        expect(parseBatch(serializeBatch(batch))).toStrictEqual(batch);

        batch.postings.forEach((posting, slot) => {
          // recordId = 100000 + slot.
          expect(posting.recordId).toBe(FIRST_RECORD_ID + BigInt(slot));
          // Synthetic 12-digit account (never a card number of 13 or more digits).
          expect(posting.account >= ACCOUNT_MIN).toBe(true);
          expect(posting.account <= ACCOUNT_MAX).toBe(true);
          expect(posting.account.toString().length).toBe(12);
          // Flag Y exactly when the amount is above the limit.
          expect(posting.reviewFlag).toBe(posting.amountCents > LIMIT_CENTS ? FLAG_YES : FLAG_NO);
        });

        // Group 1 is always over-limit when it exists (count 4 or more). Slots 2 and 3 are its
        // two postings when group 1 is a pair, which is every count except 5. For count 5 the
        // last group is a triple (D a, C b, C a-b) and only its debit, slot 2, is certain to be
        // over the limit.
        if (opts.count >= 4) {
          const debit = at(batch.postings, 2);
          expect(debit.amountCents > LIMIT_CENTS).toBe(true);
          expect(debit.reviewFlag).toBe(FLAG_YES);
          if (opts.count !== 5) {
            const credit = at(batch.postings, 3);
            expect(credit.amountCents > LIMIT_CENTS).toBe(true);
            expect(credit.reviewFlag).toBe(FLAG_YES);
          }
        }
      }),
    );
  });

  it('clean_batches_satisfy_invariants: the large kind has exactly 64 postings and the smallest clean batch has 2', () => {
    const large = generateBatch({ kind: 'large', seed: 1004, count: 64, batchId: 'CTB-20261201-004' });
    expect(large.postings.length).toBe(64);
    expect(checkInvariants(large)).toStrictEqual({ balanced: true, withinLimitOrFlagged: true, inRange: true });

    const small = generateBatch({ kind: 'clean', seed: 1001, count: 2, batchId: 'CTB-20261201-001' });
    expect(small.postings.length).toBe(2);
    expect(checkInvariants(small)).toStrictEqual({ balanced: true, withinLimitOrFlagged: true, inRange: true });
  });
});
