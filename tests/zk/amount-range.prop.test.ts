import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FieldRangeError } from '../../src/zk/errors';
import { AMOUNT_BOUND_CENTS, CAPACITY, FIELD_MODULUS } from '../../src/zk/field';
import type { Hasher } from '../../src/zk/hash';
import type { Posting } from '../../src/zk/posting';
import { assembleCircuitInputs } from '../../src/zk/witness-builder';
import { PROPERTY_SEEDS, runProperty } from '../support/pbt';
import {
  OUT_OF_RANGE_KINDS,
  expandToSlots,
  outOfRangeAmountArb,
  slotIndexArb,
  validWitnessArb,
} from '../support/zk-arbitraries';
import type { OutOfRangeKind } from '../support/zk-arbitraries';

// Property 3 (Requirements 6.4, 3.10, 6.7; security.md section 3).
//
// An amount of 2^40 or more in ANY of the 64 slots (padding slots included) makes
// `assembleCircuitInputs` throw `FieldRangeError('amountCents', slot)` BEFORE any hash call, so
// no circuit input is built. The tested ranges are 2^40 to 2^64 - 1, 2^53 - 2 to 2^53 + 2 and
// the field modulus minus 2 to the field modulus plus 2. Values at or above the field modulus
// are rejected, not wrapped.
//
// The hasher is a counting fake. It is never meant to be called for a rejected amount, and the
// property reads both counters as zero. All values are synthetic. Nothing is printed except the
// seed lines from `runProperty`.

const RUNS_PER_KIND = 100;
const PROPERTY_TIMEOUT_MS = 30_000;

/** A hasher that counts calls and returns deterministic field elements. */
interface CountingHasher extends Hasher {
  readonly counts: { leaf: number; node: number };
}

function createCountingHasher(): CountingHasher {
  const counts = { leaf: 0, node: 0 };
  return {
    counts,
    hashLeaf: (): Promise<bigint> => {
      counts.leaf += 1;
      return Promise.resolve(BigInt(counts.leaf) % FIELD_MODULUS);
    },
    hashNode: (): Promise<bigint> => {
      counts.node += 1;
      return Promise.resolve(BigInt(1000 + counts.node) % FIELD_MODULUS);
    },
  };
}

/** The decimal and hexadecimal spellings of an amount that an error message must not contain. */
function forbiddenForms(amount: bigint): readonly string[] {
  const hex = amount.toString(16);
  return [String(amount), hex, `0x${hex}`, hex.padStart(64, '0'), `0x${hex.padStart(64, '0')}`];
}

/** All string forms of the error that a caller could read: message, stack and own property values. */
function errorTexts(error: Error): readonly string[] {
  const texts: string[] = [error.message, error.stack ?? ''];
  for (const key of Object.getOwnPropertyNames(error)) {
    texts.push(String(Reflect.get(error, key)));
  }
  return texts;
}

/** Calls `assembleCircuitInputs` and returns the thrown error, or `undefined` if it did not throw. */
async function captureError(
  hasher: Hasher,
  slots: readonly Posting[],
  recordCount: number,
  limitCents: bigint,
): Promise<Error | undefined> {
  try {
    await assembleCircuitInputs(hasher, slots, recordCount, limitCents);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error : new Error('NON-ERROR THROWN');
  }
}

/** Returns a copy of `slots` with the amount of one slot replaced. */
function withAmount(slots: readonly Posting[], slot: number, amountCents: bigint): Posting[] {
  return slots.map((p, i) => (i === slot ? { ...p, amountCents } : p));
}

/** Asserts a rejection with the right class, field, slot, no hasher call and no value in any text. */
function expectRejected(
  error: Error | undefined,
  hasher: CountingHasher,
  slot: number,
  amount: bigint,
): void {
  expect(error).toBeDefined();
  expect(error).toBeInstanceOf(FieldRangeError);
  expect(error).not.toBeInstanceOf(RangeError);
  if (!(error instanceof FieldRangeError)) throw new Error('UNREACHABLE');
  expect(error.field).toBe('amountCents');
  expect(error.slot).toBe(slot);
  expect(hasher.counts.leaf).toBe(0);
  expect(hasher.counts.node).toBe(0);
  for (const text of errorTexts(error)) {
    for (const form of forbiddenForms(amount)) {
      expect(text.includes(form)).toBe(false);
    }
  }
}

const KIND_LABELS: Readonly<Record<OutOfRangeKind, string>> = {
  aboveBound: 'P3 amount-range aboveBound',
  near2p53: 'P3 amount-range near2p53',
  nearModulus: 'P3 amount-range nearModulus',
};

const TWO_POW_53 = 2n ** 53n;
const TWO_POW_64 = 2n ** 64n;
const MAX_CENTS = AMOUNT_BOUND_CENTS - 1n;

/** Boundary amounts that must be rejected. Wrapped values (for example modulus + 1 gives 1) never build. */
const REJECTED_BOUNDARIES: readonly bigint[] = [
  AMOUNT_BOUND_CENTS,
  TWO_POW_53 - 2n,
  TWO_POW_53 - 1n,
  TWO_POW_53,
  TWO_POW_53 + 1n,
  TWO_POW_53 + 2n,
  FIELD_MODULUS - 2n,
  FIELD_MODULUS - 1n,
  FIELD_MODULUS,
  FIELD_MODULUS + 1n,
  FIELD_MODULUS + 2n,
  TWO_POW_64 - 1n,
  TWO_POW_64,
];

// Feature: zk-spike, Property 3: Out-of-range amounts are rejected before any input is built
// **Validates: Requirements 6.4, 3.10, 6.7**
describe('Property 3: Out-of-range amounts are rejected before any input is built', () => {
  it(
    'rejects amounts from 2^40 in any of the 64 slots with FieldRangeError and zero hasher calls',
    async () => {
      // 1. The property, three times, 100 runs each, same seed.
      for (const kind of OUT_OF_RANGE_KINDS) {
        await runProperty(
          KIND_LABELS[kind],
          { seed: PROPERTY_SEEDS.P3, numRuns: RUNS_PER_KIND },
          fc.asyncProperty(
            validWitnessArb,
            slotIndexArb,
            outOfRangeAmountArb(kind),
            async (witness, slot, amount) => {
              const slots = withAmount(expandToSlots(witness), slot, amount);
              const hasher = createCountingHasher();
              const error = await captureError(hasher, slots, witness.recordCount, witness.limitCents);
              expectRejected(error, hasher, slot, amount);
            },
          ),
        );
      }

      // 2. Boundary table: every listed amount is rejected in the first, a middle and the last slot.
      const base = fc.sample(validWitnessArb, { seed: PROPERTY_SEEDS.P3, numRuns: 1 })[0];
      if (base === undefined) throw new Error('NO WITNESS SAMPLED');
      const baseSlots = expandToSlots(base);
      for (const amount of REJECTED_BOUNDARIES) {
        for (const slot of [0, 31, CAPACITY - 1]) {
          const hasher = createCountingHasher();
          const error = await captureError(
            hasher,
            withAmount(baseSlots, slot, amount),
            base.recordCount,
            base.limitCents,
          );
          expectRejected(error, hasher, slot, amount);
        }
      }

      // 3. Negative control: 2^40 - 1 is accepted and hashes 64 leaves and 63 nodes, so the
      //    property above tells in-range from out-of-range.
      for (const slot of [0, 31, CAPACITY - 1]) {
        const hasher = createCountingHasher();
        const built = await assembleCircuitInputs(
          hasher,
          withAmount(baseSlots, slot, MAX_CENTS),
          base.recordCount,
          base.limitCents,
        );
        expect(built.recordCount).toBe(base.recordCount);
        expect(hasher.counts.leaf).toBe(CAPACITY);
        expect(hasher.counts.node).toBe(CAPACITY - 1);
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
